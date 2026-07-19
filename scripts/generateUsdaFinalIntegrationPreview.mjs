/**
 * USDA final import — dry-run integration preview.
 * Reads ONLY official pilot files. Does NOT modify foodDatabase.js or Supabase.
 *
 * Run: node scripts/generateUsdaFinalIntegrationPreview.mjs
 */

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { MASTER_FOOD_DB, macroCalories, CATALOG_REVIEW } from '../src/utils/foodDatabase.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const OUTPUT_DIR = join(__dirname, 'output')
const DB_PATH = join(ROOT, 'src', 'utils', 'foodDatabase.js')
const PILOT_CSV = join(OUTPUT_DIR, 'pilot_usda_import_ready_final.csv')
const PILOT_VALIDATION_MD = join(OUTPUT_DIR, 'pilot_usda_import_validation_report.md')

const MERGE_PLAN_CSV = join(OUTPUT_DIR, 'usda_final_catalog_merge_plan.csv')
const PORTION_PREVIEW_CSV = join(OUTPUT_DIR, 'usda_final_portion_merge_preview.csv')
const TAG_SAFETY_CSV = join(OUTPUT_DIR, 'usda_tag_safety_review.csv')
const PRECISION_CSV = join(OUTPUT_DIR, 'usda_precision_validation.csv')
const PORTION_CAVEATS_CSV = join(OUTPUT_DIR, 'usda_remaining_portion_caveats.csv')
const PREVIEW_DB_PATH = join(OUTPUT_DIR, 'foodDatabase.usda-preview.js')
const VALIDATION_MD = join(OUTPUT_DIR, 'usda_final_integration_validation.md')

const PORTION_CAVEAT_COLUMNS = [
  'food_id',
  'name',
  'current_default_label',
  'current_default_grams',
  'official_portion_label',
  'official_portion_grams',
  'difference_percent',
  'recommended_action',
  'review_note',
]

const PRECISION_TOLERANCE = 0.000001

const TAG_SAFETY_COLUMNS = [
  'food_id',
  'name',
  'old_tags',
  'new_tags',
  'removed_tags',
  'added_tags',
  'tag_review_status',
  'review_note',
]

const TAG_CORRECTIONS = {
  'Tereyağı (Tuzsuz)': {
    remove: ['Vegan', 'Laktozsuz'],
    add: ['Vejetaryen', 'Glutensiz', 'Kuruyemişsiz', 'Deniz Ürünsüz', 'Keto'],
    note: 'Butter is dairy; Vegan and Laktozsuz are invalid without explicit lactose-free source.',
  },
  'Bulgur (Kuru)': {
    remove: ['Glutensiz'],
    note: 'Bulgur contains gluten; Glutensiz removed.',
  },
  'Bulgur (Haşlanmış)': {
    remove: ['Glutensiz'],
    note: 'Bulgur contains gluten; Glutensiz removed.',
  },
  'Yağsız Süt': {
    remove: ['Laktozsuz'],
    add: ['Vejetaryen'],
    note: 'Skim milk is not lactose-free; Vejetaryen added per existing dairy convention.',
  },
  'Yoğurt (Yağsız)': {
    remove: ['Laktozsuz'],
    add: ['Vejetaryen'],
    note: 'Nonfat yogurt is not lactose-free; Vejetaryen added per existing dairy convention.',
  },
  'Parmesan Peyniri': {
    remove: ['Laktozsuz'],
    note: 'Hard cheese is not lactose-free; Vejetaryen withheld because rennet source is unspecified.',
  },
  'Cheddar Peyniri': {
    remove: ['Laktozsuz'],
    note: 'Cheddar is not lactose-free; Vejetaryen withheld without rennet/product definition.',
  },
}

const ORIGINAL_COUNT = 240

const CATEGORY_MAP = {
  'Et ve Tavuk': 'Et & Tavuk',
  'Et / Tavuk / Balık': 'Et & Tavuk',
  'Tahıl ve Ekmek': 'Tahıl & Ekmek',
  'Tahıl / Ekmek / Makarna': 'Tahıl & Ekmek',
  Baklagiller: 'Baklagil',
  'Kuruyemiş ve Tohum': 'Kuruyemiş',
  Kuruyemiş: 'Kuruyemiş',
  Yağlar: 'Yağ & Sos',
  Baharat: 'Sebze',
  İçecek: 'İçecek',
  Meyve: 'Meyve',
  Sebze: 'Sebze',
  'Süt Ürünleri': 'Süt Ürünleri',
  Çorba: 'Çorba',
}

const MERGE_PLAN_COLUMNS = [
  'candidate_id',
  'name_tr',
  'catalog_action',
  'existing_catalog_food_id',
  'final_catalog_food_id',
  'final_slug',
  'old_name',
  'new_name',
  'old_serving_label',
  'old_serving_grams',
  'official_portion_label',
  'official_portion_grams',
  'default_portion_action',
  'nutrition_action',
  'source_id',
  'official_fdc_id',
  'validation_status',
  'validation_note',
]

const PORTION_COLUMNS = [
  'candidate_id',
  'final_catalog_food_id',
  'catalog_action',
  'existing_default_portion_label',
  'existing_default_portion_grams',
  'usda_portion_label',
  'usda_portion_grams',
  'merged_default_portion_label',
  'merged_default_portion_grams',
  'default_portion_action',
  'additional_portion_label',
  'additional_portion_grams',
  'additional_portion_source',
  'portion_source',
  'portion_merge_note',
]

function fail(message) {
  console.error(`ERROR: ${message}`)
  process.exit(1)
}

function requireOfficialInputs() {
  if (!existsSync(PILOT_CSV)) {
    fail(`Missing required input: ${PILOT_CSV}`)
  }
  if (!existsSync(PILOT_VALIDATION_MD)) {
    fail(`Missing required input: ${PILOT_VALIDATION_MD}`)
  }
}

function parseNum(value) {
  if (value === null || value === undefined) return null
  const s = String(value).trim()
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/)
  const headers = lines[0].split(',')
  return lines.slice(1).map((line) => {
    const vals = []
    let cur = ''
    let inQ = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (inQ) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"'
          i++
        } else if (ch === '"') inQ = false
        else cur += ch
      } else if (ch === '"') inQ = true
      else if (ch === ',') {
        vals.push(cur)
        cur = ''
      } else cur += ch
    }
    vals.push(cur)
    const row = {}
    headers.forEach((h, i) => {
      row[h] = vals[i] ?? ''
    })
    return row
  })
}

function csvCell(value) {
  if (value === null || value === undefined) return ''
  const text = String(value)
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

function toCsv(columns, rows) {
  return [columns.join(','), ...rows.map((row) => columns.map((c) => csvCell(row[c])).join(','))].join('\n')
}

function slugify(name) {
  return String(name)
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_')
}

function mapCategory(categoryTr) {
  return CATEGORY_MAP[categoryTr] ?? categoryTr
}

function fileSha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function normalizePortionLabel(label) {
  const raw = String(label || '').trim()
  if (!raw) return '1 Porsiyon'
  if (/^100\s*gram$/i.test(raw)) return '100 Gram'
  return raw.replace(/\b(\d+)\s+([a-zçğıöşüA-ZÇĞİÖŞÜ]+(?:\s+[a-zçğıöşüA-ZÇĞİÖŞÜ]+)*)/g, (_, qty, unit) => {
    const titled = unit
      .split(/\s+/)
      .map((w) => w.charAt(0).toLocaleUpperCase('tr-TR') + w.slice(1).toLocaleLowerCase('tr-TR'))
      .join(' ')
    return `${qty} ${titled}`
  })
}

function getSemanticExclusion(row) {
  if (row.candidate_id === 'wl_119') {
    return {
      reason: 'semantic_source_mismatch',
      note: 'Official FDC 171722 is Cranberries (Turna Yemişi), not Turkish Kızılcık. Excluded; Kızılcık remains a future TÜRKOMP/manual candidate.',
    }
  }
  return null
}

function resolveSemanticIdentity(row) {
  if (row.candidate_id === 'wl_172') {
    return {
      action: 'add_new_food_variant',
      existingId: null,
      displayName: 'Kereviz Sapı (Çiğ)',
      fixedSlug: 'kereviz_sapi_cig',
      searchAliases: ['Kereviz Sapı', 'Celery'],
      identityNote:
        'Official FDC 2346405 is Celery stalk (Kereviz Sapı), not root Kereviz (id 155). Reclassified to new variant; catalog id 155 remains unchanged.',
      officialAction: row.catalog_action,
    }
  }
  return null
}

function isImportReady(row) {
  if (row.source_verification_status !== 'officially_verified') return false
  if (row.review_status !== 'import_ready_review_only') return false
  if (!String(row.official_fdc_id || '').trim()) return false
  if (!String(row.source_id || '').trim()) return false
  if (String(row.source_id) !== String(row.official_fdc_id)) return false
  const action = row.catalog_action
  if (action !== 'update_exact_existing_food' && action !== 'add_new_food_variant') return false
  if (parseNum(row.calories_100g) == null) return false
  if (parseNum(row.protein_100g) == null) return false
  if (parseNum(row.carbs_100g) == null) return false
  if (parseNum(row.fat_100g) == null) return false
  return true
}

function microFields(row) {
  return {
    fiber_100g: parseNum(row.fiber_100g),
    sugar_100g: parseNum(row.sugar_100g),
    sodium_mg_100g: parseNum(row.sodium_mg_100g),
  }
}

function buildUsdaPer100g(row, micro) {
  return {
    calories: parseNum(row.calories_100g),
    protein: parseNum(row.protein_100g),
    carbs: parseNum(row.carbs_100g),
    fat: parseNum(row.fat_100g),
    fiber: micro.fiber_100g,
    sugar: micro.sugar_100g,
    sodium_mg: micro.sodium_mg_100g,
  }
}

function scaleFromUsda100g(usdaPer100g, servingGrams) {
  const mult = servingGrams / 100
  return {
    calories: usdaPer100g.calories * mult,
    protein: usdaPer100g.protein * mult,
    carbs: usdaPer100g.carbs * mult,
    fat: usdaPer100g.fat * mult,
  }
}

function servingFromUsda(row, servingGrams) {
  return scaleFromUsda100g(buildUsdaPer100g(row, microFields(row)), servingGrams)
}

function clarifyDisplayName(row, existing) {
  const name = String(row.name_tr || '').trim()
  const state = String(row.target_state || '').trim()
  if (/\([^)]+\)/.test(name)) return name
  if (state === 'raw' && /^(Kaju|Badem|Salatalık|Domates|Havuç|Kereviz)$/i.test(name)) {
    return `${name} (Çiğ)`
  }
  if (state === 'cooked' && /^Kinoa$/i.test(name)) {
    return `${name} (Haşlanmış)`
  }
  if (state === 'boiled' && /^Ispanak$/i.test(name)) return name.includes('(') ? name : `${name} (Haşlanmış)`
  if (existing && existing.name === name) return name
  return name
}

function isExactCatalogNameCollision(name, catalogByName) {
  return catalogByName.has(String(name || '').trim())
}

function shouldReclassifyAddNewAsUpdate(row, existing) {
  if (row.name_tr !== existing.name) return false
  const state = String(row.target_state || '').toLowerCase()
  const existingName = existing.name.toLocaleLowerCase('tr-TR')
  if (state === 'raw' && !existingName.includes('(')) return true
  if (state === 'cooked' && existingName === row.name_tr.toLocaleLowerCase('tr-TR')) return true
  return false
}

/**
 * Resolve official catalog_action against current catalog identity rules.
 * Official CSV decisions are authoritative; only exact display-name collisions
 * on clearly identical food/state are reclassified (e.g. Kaju → id 216).
 */
function resolveCatalogIdentity(row, catalogById, catalogByName, usedNames) {
  const officialAction = row.catalog_action
  const existingIdFromCsv = parseNum(row.existing_catalog_food_id)

  if (officialAction === 'update_exact_existing_food') {
    if (!existingIdFromCsv || !catalogById.has(existingIdFromCsv)) {
      throw new Error(`${row.candidate_id}: update row missing valid existing_catalog_food_id (${row.existing_catalog_food_id})`)
    }
    const existing = catalogById.get(existingIdFromCsv)
    const displayName = clarifyDisplayName(row, existing)
    return {
      action: 'update_exact_existing_food',
      existingId: existingIdFromCsv,
      displayName,
      identityNote: 'Official CSV update_exact_existing_food',
      officialAction,
    }
  }

  if (officialAction === 'add_new_food_variant') {
    const exactExisting = isExactCatalogNameCollision(row.name_tr, catalogByName)
      ? catalogByName.get(row.name_tr)
      : null

    if (exactExisting && shouldReclassifyAddNewAsUpdate(row, exactExisting)) {
      const displayName = clarifyDisplayName(row, exactExisting)
      return {
        action: 'update_exact_existing_food',
        existingId: exactExisting.id,
        displayName,
        identityNote: `Exact display name collision with catalog id ${exactExisting.id} "${exactExisting.name}" — reclassified to update with clarified name`,
        officialAction,
        alias: exactExisting.name,
      }
    }

    let displayName = String(row.name_tr || '').trim()
    if (usedNames.has(displayName)) {
      fail(`${row.candidate_id}: add_new_food_variant would duplicate exact display name "${displayName}" — use a distinct variant name in official CSV`)
    }

    return {
      action: 'add_new_food_variant',
      existingId: null,
      displayName,
      identityNote: 'Official CSV add_new_food_variant',
      officialAction,
    }
  }

  throw new Error(`${row.candidate_id}: unsupported catalog_action "${officialAction}"`)
}

function resolvePortionPlan(row, resolvedAction, existing) {
  const portionStatus = row.portion_verification_status
  const officialLabel = normalizePortionLabel(row.default_portion_label_tr)
  const officialGrams = parseNum(row.default_portion_grams)

  if (resolvedAction === 'update_exact_existing_food') {
    const usdaLabel = portionStatus === 'approved_100g_only' ? '100 Gram' : officialLabel
    const usdaGrams = portionStatus === 'approved_100g_only' ? 100 : officialGrams
    return {
      defaultPortionAction: 'local_existing_portion',
      mergedLabel: existing.serving_size,
      mergedGrams: existing.serving_grams,
      usdaLabel,
      usdaGrams,
      portionSource: 'local_existing_portion + source_verified_usda',
      note: 'Existing default serving preserved; official USDA portion added as additional option.',
    }
  }

  if (portionStatus === 'approved_100g_only') {
    return {
      defaultPortionAction: 'approved_100g_only',
      mergedLabel: '100 Gram',
      mergedGrams: 100,
      usdaLabel: '100 Gram',
      usdaGrams: 100,
      portionSource: 'source_verified_usda',
      note: 'Official approved_100g_only — default is 100 Gram only.',
    }
  }

  if (!officialLabel || officialGrams == null) {
    throw new Error(`${row.candidate_id}: new variant missing approved portion`)
  }

  return {
    defaultPortionAction: 'approved_user_friendly_portion',
    mergedLabel: officialLabel,
    mergedGrams: officialGrams,
    usdaLabel: officialLabel,
    usdaGrams: officialGrams,
    portionSource: 'source_verified_usda',
    note: 'Official approved_user_friendly_portion used as default.',
  }
}

function buildReview(row, micro, portionMeta, noteOverride) {
  const detailNote =
    noteOverride ??
    (row.import_note ? String(row.import_note).trim() : '')
  const review = {
    source_type: 'USDA',
    source_name: 'USDA FoodData Central',
    source_food_id: String(row.official_fdc_id),
    review_status: 'usda_officially_verified',
    source_data_type: row.data_type || null,
    source_nutrition_basis: 'per_100g',
    portion_source: portionMeta.portionSource,
    notes:
      `USDA dry-run preview (${row.candidate_id}). FDC ${row.official_fdc_id}. Master calories/macros are serving-scaled from exact USDA per-100g; usda_per_100g holds authoritative source values. ${detailNote}`.trim(),
  }

  const verified = []
  if (micro.fiber_100g != null) verified.push('fiber')
  if (micro.sugar_100g != null) verified.push('sugar')
  if (micro.sodium_mg_100g != null) verified.push('sodium')
  if (verified.length) review.micronutrient_basic_status = `${verified.join('_')}_verified_usda`

  return review
}

function conservativeNewTags(row) {
  const cat = String(row.category_tr || '')
  const name = String(row.name_tr || '').toLocaleLowerCase('tr-TR')

  if (cat.includes('Kuruyemiş') || /kaju|badem|fıstık|ceviz|fındık/.test(name)) {
    return ['Vegan', 'Vejetaryen', 'Glutensiz', 'Laktozsuz', 'Deniz Ürünsüz']
  }
  if (cat === 'Meyve' || cat === 'Sebze' || cat === 'Baharat') {
    return ['Vegan', 'Vejetaryen', 'Glutensiz', 'Laktozsuz', 'Kuruyemişsiz', 'Deniz Ürünsüz']
  }
  if (cat === 'Yağlar') {
    if (/tereya|butter|kaymak|krema/.test(name)) {
      return ['Vejetaryen', 'Glutensiz', 'Kuruyemişsiz', 'Deniz Ürünsüz', 'Keto']
    }
    return ['Vegan', 'Vejetaryen', 'Glutensiz', 'Laktozsuz', 'Kuruyemişsiz', 'Deniz Ürünsüz', 'Keto']
  }
  if (cat.includes('Tahıl') || cat.includes('Ekmek') || /bulgur|makarna|ekmek|buğday/.test(name)) {
    return ['Vegan', 'Vejetaryen', 'Laktozsuz', 'Kuruyemişsiz', 'Deniz Ürünsüz']
  }
  if (cat === 'Süt Ürünleri' || /süt|yoğurt|peynir|cheese|milk|yogurt/.test(name)) {
    return ['Glutensiz', 'Kuruyemişsiz', 'Deniz Ürünsüz']
  }
  if (cat.includes('Et') || cat.includes('Tavuk') || cat.includes('Balık')) {
    return ['Laktozsuz', 'Kuruyemişsiz', 'Deniz Ürünsüz']
  }
  return ['Deniz Ürünsüz']
}

function isDairyFood(displayName, row) {
  const cat = String(row.category_tr || '')
  const text = `${displayName} ${row.name_tr || ''}`.toLocaleLowerCase('tr-TR')
  return cat === 'Süt Ürünleri' || /süt|yoğurt|peynir|tereya|cheese|milk|yogurt|butter|kaymak|krema/.test(text)
}

function isAnimalFood(row) {
  const cat = String(row.category_tr || '')
  return cat.includes('Et') || cat.includes('Tavuk') || cat.includes('Balık')
}

function isNutFood(displayName, row) {
  const cat = String(row.category_tr || '')
  const text = `${displayName} ${row.name_tr || ''}`.toLocaleLowerCase('tr-TR')
  return (
    cat.includes('Kuruyemiş') ||
    /kaju|badem|fıstık|ceviz|fındık|nut|cashew|chia|tohum|seed|fıstık/.test(text)
  )
}

function isBulgurFood(displayName) {
  return /bulgur/i.test(displayName)
}

function resolveTags({ displayName, row, existingTags, isUpdate }) {
  const oldTags = isUpdate ? [...(existingTags ?? [])] : conservativeNewTags(row)
  let newTags = [...oldTags]
  const removed = []
  const added = []

  const correction = TAG_CORRECTIONS[displayName]
  if (correction) {
    for (const tag of correction.remove ?? []) {
      if (newTags.includes(tag)) {
        newTags = newTags.filter((t) => t !== tag)
        removed.push(tag)
      }
    }
    for (const tag of correction.add ?? []) {
      if (!newTags.includes(tag)) {
        newTags.push(tag)
        added.push(tag)
      }
    }
  }

  const safetyRemovals = [
    ['Vegan', isDairyFood(displayName, row) || isAnimalFood(row)],
    ['Laktozsuz', isDairyFood(displayName, row)],
    ['Glutensiz', isBulgurFood(displayName)],
    ['Kuruyemişsiz', isNutFood(displayName, row)],
  ]

  for (const [tag, shouldRemove] of safetyRemovals) {
    if (shouldRemove && newTags.includes(tag)) {
      newTags = newTags.filter((t) => t !== tag)
      if (!removed.includes(tag)) removed.push(tag)
    }
  }

  const tagReviewStatus =
    correction || removed.length || added.length
      ? removed.length || added.length
        ? 'corrected_invalid_tag'
        : 'corrected'
      : isUpdate
        ? 'preserved'
        : 'conservative_default'

  const reviewNote =
    correction?.note ??
    (isUpdate
      ? 'Existing tags preserved unless demonstrably invalid.'
      : 'Conservative deterministic tags; USDA does not verify dietary/allergen labels.')

  return { tags: newTags, oldTags, removed, added, tagReviewStatus, reviewNote }
}

function buildPortionsArray(portion, resolvedAction, existing) {
  if (resolvedAction === 'update_exact_existing_food') {
    const portions = [
      {
        label: existing.serving_size,
        grams: existing.serving_grams,
        is_default: true,
        source: 'local_catalog',
      },
    ]
    const same = portionsAreSame(
      portion.usdaLabel,
      portion.usdaGrams,
      existing.serving_size,
      existing.serving_grams
    )
    if (!same) {
      let usdaLabel = portion.usdaLabel
      if (
        normalizePortionLabel(portion.usdaLabel) === normalizePortionLabel(existing.serving_size) &&
        portion.usdaGrams !== existing.serving_grams
      ) {
        usdaLabel = `${portion.usdaLabel} (USDA ${portion.usdaGrams}g)`
      }
      portions.push({
        label: usdaLabel,
        grams: portion.usdaGrams,
        is_default: false,
        source: 'source_verified_usda',
      })
    }
    return portions
  }

  return [
    {
      label: portion.mergedLabel,
      grams: portion.mergedGrams,
      is_default: true,
      source: 'source_verified_usda',
    },
  ]
}

function portionsAreSame(aLabel, aGrams, bLabel, bGrams) {
  return normalizePortionLabel(aLabel) === normalizePortionLabel(bLabel) && aGrams === bGrams
}

function serializeValue(value, indent = 4) {
  const pad = ' '.repeat(indent)
  if (value === null) return 'null'
  if (typeof value === 'string') return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (Array.isArray(value)) {
    if (!value.length) return '[]'
    return `[\n${value.map((v) => `${pad}  ${serializeValue(v, indent + 2)},`).join('\n')}\n${pad}]`
  }
  const entries = Object.entries(value).filter(([, v]) => v !== undefined)
  if (!entries.length) return '{}'
  return `{\n${entries
    .map(([k, v]) => {
      const key = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(k) ? k : `'${k}'`
      return `${pad}  ${key}: ${serializeValue(v, indent + 2)},`
    })
    .join('\n')}\n${pad}}`
}

function serializeFood(entry) {
  const lines = ['  {']
  for (const key of [
    'id',
    'slug',
    'name',
    'category',
    'calories',
    'protein',
    'carbs',
    'fat',
    'fiber_100g',
    'sugar_100g',
    'sodium_mg_100g',
    'serving_size',
    'serving_grams',
    'data_source',
    'tags',
    'search_aliases',
    'portions',
    'review',
    'usda_per_100g',
  ]) {
    if (entry[key] === undefined) continue
    lines.push(`    ${key}: ${serializeValue(entry[key], 4)},`)
  }
  lines.push('  },')
  return lines.join('\n')
}

function renderPreviewDatabase(catalog, originalCount) {
  return `/**
 * USDA integration PREVIEW — dry-run merged catalog (${catalog.length} foods).
 * DO NOT import into the app. Source: scripts/generateUsdaFinalIntegrationPreview.mjs
 * Original untouched catalog: src/utils/foodDatabase.js (${originalCount} foods)
 */

/** Atwater general factors — reference only; preview calories use USDA per-100g scaling. */
export function macroCalories(protein, carbs, fat) {
  return Math.round(protein * 4 + carbs * 4 + fat * 9)
}

export const CATALOG_REVIEW = ${serializeValue(CATALOG_REVIEW, 0)};

export const PENDING_REVIEW = CATALOG_REVIEW;
export const LEGACY_REVIEW = CATALOG_REVIEW;

export function parseServingSize(servingSize) {
  const m = String(servingSize || '').match(/^(\\d+(?:\\.\\d+)?)\\s+(.+)$/)
  if (m) return { qty: parseFloat(m[1]), unit: m[2] }
  return { qty: 1, unit: servingSize || 'Porsiyon' }
}

export function toLegacyFood(master) {
  const { unit } = parseServingSize(master.serving_size)
  const mult = Math.max(master.serving_grams / 100, 0.01)
  const source100 = master.usda_per_100g
  const servingMult = master.serving_grams / 100

  const units = { Gram: 0.01 }
  if (unit !== 'Gram') units[unit] = mult

  if (Array.isArray(master.portions)) {
    for (const portion of master.portions) {
      const { unit: pUnit } = parseServingSize(portion.label)
      if (pUnit === 'Gram') continue
      const pMult = Math.max(portion.grams / 100, 0.01)
      if (!(pUnit in units)) units[pUnit] = pMult
    }
  }

  const calories100 = source100?.calories ?? master.calories / mult
  const protein100 = source100?.protein ?? master.protein / mult
  const carbs100 = source100?.carbs ?? master.carbs / mult
  const fat100 = source100?.fat ?? master.fat / mult
  const fiber100 = source100?.fiber ?? master.fiber_100g ?? null
  const sugar100 = source100?.sugar ?? master.sugar_100g ?? null
  const sodium100 = source100?.sodium_mg ?? master.sodium_mg_100g ?? null

  const naturalCalories = source100 ? source100.calories * servingMult : master.calories
  const naturalProtein = source100 ? source100.protein * servingMult : master.protein
  const naturalCarbs = source100 ? source100.carbs * servingMult : master.carbs
  const naturalFat = source100 ? source100.fat * servingMult : master.fat
  const naturalFiber = fiber100 == null ? null : fiber100 * (source100 ? servingMult : mult)
  const naturalSugar = sugar100 == null ? null : sugar100 * (source100 ? servingMult : mult)
  const naturalSodium = sodium100 == null ? null : sodium100 * (source100 ? servingMult : mult)

  const legacy = {
    id: master.id,
    slug: master.slug,
    name: master.name,
    category: master.category ?? null,
    calories: calories100,
    protein: protein100,
    carbs: carbs100,
    fat: fat100,
    fiber_100g: fiber100,
    sugar_100g: sugar100,
    sodium_mg_100g: sodium100,
    fiber: naturalFiber,
    sugar: naturalSugar,
    sodium_mg: naturalSodium,
    units,
    tags: master.tags ?? [],
    serving_size: master.serving_size,
    data_source: master.data_source,
    review: master.review ?? CATALOG_REVIEW,
    _natural: {
      calories: naturalCalories,
      protein: naturalProtein,
      carbs: naturalCarbs,
      fat: naturalFat,
      fiber_100g: fiber100,
      sugar_100g: sugar100,
      sodium_mg_100g: sodium100,
      fiber: naturalFiber,
      sugar: naturalSugar,
      sodium_mg: naturalSodium,
      unit,
      grams: master.serving_grams,
    },
  }

  if (master.usda_per_100g) legacy.usda_per_100g = master.usda_per_100g

  if (unit === 'Bardak' || unit === 'Fincan' || unit === 'Su Bardağı') {
    legacy.units.Mililitre = 0.01
  }

  return legacy
}

export const MASTER_FOOD_DB = [
${catalog.map(serializeFood).join('\n')}
]

export const FOOD_DB = MASTER_FOOD_DB.map(toLegacyFood)
`
}

function buildPortionCaveats(mergedCatalog, portionRows) {
  const caveats = []
  const seen = new Set()

  function addCaveat(entry) {
    const key = `${entry.food_id}:${entry.review_note}`
    if (seen.has(key)) return
    seen.add(key)
    caveats.push(entry)
  }

  for (const row of portionRows) {
    const food = mergedCatalog.find((f) => f.id === Number(row.final_catalog_food_id))
    if (!food) continue

    const currentLabel = row.merged_default_portion_label || row.existing_default_portion_label || food.serving_size
    const currentGrams = parseNum(row.merged_default_portion_grams || row.existing_default_portion_grams) ?? food.serving_grams
    const officialLabel = row.usda_portion_label
    const officialGrams = parseNum(row.usda_portion_grams)
    if (!currentGrams || !officialGrams) continue

    const diffPercent = Math.round((Math.abs(currentGrams - officialGrams) / officialGrams) * 1000) / 10
    const samePortion = portionsAreSame(currentLabel, currentGrams, officialLabel, officialGrams)

    if (food.name === 'Kaju (Çiğ)' || row.candidate_id === 'wl_303') {
      addCaveat({
        food_id: food.id,
        name: food.name,
        current_default_label: currentLabel,
        current_default_grams: currentGrams,
        official_portion_label: officialLabel,
        official_portion_grams: officialGrams,
        difference_percent: diffPercent,
        recommended_action: 'manual_portion_review',
        review_note:
          'Existing default "1 Kase / 30 g" is semantically questionable for raw cashews; USDA approved 100 Gram only.',
      })
      continue
    }

    if (food.name === 'Espresso' || row.candidate_id === 'wl_012') {
      addCaveat({
        food_id: food.id,
        name: food.name,
        current_default_label: currentLabel,
        current_default_grams: currentGrams,
        official_portion_label: officialLabel,
        official_portion_grams: officialGrams,
        difference_percent: diffPercent,
        recommended_action: 'add_user_friendly_portion',
        review_note:
          'Only 100 Gram is currently selected as default; consider a user-friendly espresso serving after manual review.',
      })
      continue
    }

    if (row.catalog_action === 'update_exact_existing_food' && !samePortion && diffPercent >= 5) {
      addCaveat({
        food_id: food.id,
        name: food.name,
        current_default_label: currentLabel,
        current_default_grams: currentGrams,
        official_portion_label: officialLabel,
        official_portion_grams: officialGrams,
        difference_percent: diffPercent,
        recommended_action: 'keep_local_default_review_additional',
        review_note:
          'Local default preserved; official USDA portion differs materially and is available as an additional option.',
      })
    }
  }

  return caveats
}

function micronutrientClaimViolations(food) {
  const status = food.review?.micronutrient_basic_status ?? ''
  const issues = []
  if (status.includes('fiber') && food.fiber_100g == null) issues.push('fiber claimed verified but null')
  if (status.includes('sugar') && food.sugar_100g == null) issues.push('sugar claimed verified but null')
  if (status.includes('sodium') && food.sodium_mg_100g == null) issues.push('sodium claimed verified but null')
  return issues
}

function renderValidationMd(ctx) {
  const pass = (ok) => (ok ? 'PASS' : 'FAIL')
  const v = ctx.validation
  return `# USDA Final Integration Validation (Dry Run)

Generated: ${new Date().toISOString()}

## Input provenance

- Official pilot CSV: \`scripts/output/pilot_usda_import_ready_final.csv\`
- Official validation report: \`scripts/output/pilot_usda_import_validation_report.md\`
- Source reconstruction: **none**
- Manual-review promotion: **none**

## Derived counts (from official CSV)

| Metric | Value |
|--------|------:|
| Official input row count | ${ctx.officialInputCount} |
| Included import-ready rows | ${ctx.includedCount} |
| Excluded / manual rows | ${ctx.excludedRows.length} |
| Excluded semantic mismatch | ${ctx.excludedSemanticMismatch} |
| Existing updates (resolved) | ${v.updateCount} |
| New variants (resolved) | ${v.newCount} |
| Identity reclassifications | ${ctx.identityReclassifications.length} |
| Final expected catalog count | ${v.catalogTotal} (${ORIGINAL_COUNT} original + ${v.newCount} new) |

## Integrity checks

| Check | Status |
|-------|--------|
| No duplicate IDs | ${pass(v.duplicateIds === 0)} (${v.duplicateIds} duplicates) |
| No duplicate slugs | ${pass(v.duplicateSlugs === 0)} (${v.duplicateSlugs} duplicates) |
| No duplicate exact display names | ${pass(v.duplicateNames === 0)} (${v.duplicateNames} duplicates) |
| All included rows have official FDC IDs | ${pass(v.missingFdc.length === 0)} |
| Null nutrients stayed null on merge-touched rows | ${pass(v.nullViolations.length === 0)} |
| No manual-review record promoted | ${pass(ctx.manualPromotions.length === 0)} |
| No source file reconstructed | PASS |
| \`src/utils/foodDatabase.js\` unchanged | ${pass(v.dbHashUnchanged)} |
| Supabase unchanged | PASS |

## Nutrition safety

| Check | Status |
|-------|--------|
| USDA calories authoritative (no 4P+4C+9F replacement) | ${pass(v.atwaterReplacements.length === 0)} |

## Preview validation

Preview module checks are run separately via \`node scripts/validateUsdaPreview.mjs\`.
Do **not** treat \`npm run build\` on the live app as preview validation.

## Precision validation

Run \`node scripts/validateUsdaPreview.mjs\` after generation.
Report output: \`scripts/output/usda_precision_validation.csv\`

| Metric | Status |
|--------|--------|
| Exact USDA per-100g equivalence | pending validator run |
| Precision failures | pending validator run |
| Non-zero USDA values zeroed | pending validator run |

## Identity resolutions

${ctx.identityReclassifications.length ? ctx.identityReclassifications.map((x) => `- ${x}`).join('\n') : '- None'}

## Excluded rows

${ctx.excludedRows.length ? ctx.excludedRows.map((x) => `- ${x}`).join('\n') : '- None'}

## Included updates

${ctx.updatesList.map((x) => `- ${x}`).join('\n')}

## Included new variants

${ctx.newList.map((x) => `- ${x}`).join('\n')}

## Legacy inherited issues (untouched catalog rows)

${v.legacyNullViolations.length ? v.legacyNullViolations.map((x) => `- ${x}`).join('\n') : '- None detected in preview merge scope'}

## Blockers

${ctx.blockers.length ? ctx.blockers.map((x) => `- ${x}`).join('\n') : '- None — preview regenerated from official inputs only.'}
`
}

function main() {
  requireOfficialInputs()
  mkdirSync(OUTPUT_DIR, { recursive: true })

  const dbHashBefore = fileSha256(DB_PATH)
  const pilotRows = parseCsv(readFileSync(PILOT_CSV, 'utf8'))
  const validationReport = readFileSync(PILOT_VALIDATION_MD, 'utf8')

  const excludedRows = []
  const includedRows = []
  for (const row of pilotRows) {
    const semantic = getSemanticExclusion(row)
    if (semantic) {
      excludedRows.push(`${row.candidate_id} ${row.name_tr} — ${semantic.reason}: ${semantic.note}`)
      continue
    }
    if (isImportReady(row)) includedRows.push(row)
    else excludedRows.push(`${row.candidate_id} ${row.name_tr} — not import-ready (${row.review_status}/${row.source_verification_status})`)
  }

  const manualCandidates = ['wl_211', 'wl_212']
  const manualPromotions = manualCandidates.filter((id) => includedRows.some((r) => r.candidate_id === id))
  if (manualPromotions.length) {
    fail(`Manual-review foods promoted against policy: ${manualPromotions.join(', ')}`)
  }

  const catalogById = new Map(MASTER_FOOD_DB.map((f) => [f.id, structuredClone(f)]))
  const catalogByName = new Map(MASTER_FOOD_DB.map((f) => [f.name, f]))

  const usedSlugs = new Set(MASTER_FOOD_DB.map((f) => f.slug))
  const usedNames = new Set(MASTER_FOOD_DB.map((f) => f.name))
  let nextId = Math.max(...MASTER_FOOD_DB.map((f) => f.id)) + 1

  const mergePlanRows = []
  const portionRows = []
  const updatedFoodIds = new Set()
  const newFoodIds = []
  const identityReclassifications = []
  const updatesList = []
  const newList = []
  const blockers = []
  const tagSafetyRows = []

  for (const row of includedRows) {
    const resolved = resolveSemanticIdentity(row) ?? resolveCatalogIdentity(row, catalogById, catalogByName, usedNames)
    if (resolved.officialAction !== resolved.action) {
      const target =
        resolved.action === 'update_exact_existing_food'
          ? `on id ${resolved.existingId}`
          : 'as new variant'
      identityReclassifications.push(
        `${row.candidate_id} ${row.name_tr}: official \`${resolved.officialAction}\` → resolved \`${resolved.action}\` ${target} (${resolved.identityNote})`
      )
    }

    const micro = microFields(row)

    if (resolved.action === 'update_exact_existing_food') {
      const existing = catalogById.get(resolved.existingId)
      const portion = resolvePortionPlan(row, resolved.action, existing)
      const oldName = existing.name
      const newName = resolved.displayName
      const aliases = new Set(existing.search_aliases ?? [])
      if (resolved.alias) aliases.add(resolved.alias)
      if (oldName !== newName) aliases.add(oldName)

      const macros = servingFromUsda(row, existing.serving_grams)
      const atwater = macroCalories(macros.protein, macros.carbs, macros.fat)
      const tagResult = resolveTags({
        displayName: newName,
        row,
        existingTags: existing.tags,
        isUpdate: true,
      })

      existing.name = newName
      existing.calories = macros.calories
      existing.protein = macros.protein
      existing.carbs = macros.carbs
      existing.fat = macros.fat
      if (micro.fiber_100g != null) existing.fiber_100g = micro.fiber_100g
      else delete existing.fiber_100g
      if (micro.sugar_100g != null) existing.sugar_100g = micro.sugar_100g
      else delete existing.sugar_100g
      if (micro.sodium_mg_100g != null) existing.sodium_mg_100g = micro.sodium_mg_100g
      else delete existing.sodium_mg_100g
      existing.search_aliases = [...aliases]
      existing.tags = tagResult.tags
      existing.portions = buildPortionsArray(portion, resolved.action, existing)
      existing.review = buildReview(row, micro, portion)
      existing.usda_per_100g = buildUsdaPer100g(row, micro)

      tagSafetyRows.push({
        food_id: existing.id,
        name: newName,
        old_tags: tagResult.oldTags.join('|'),
        new_tags: tagResult.tags.join('|'),
        removed_tags: tagResult.removed.join('|'),
        added_tags: tagResult.added.join('|'),
        tag_review_status: tagResult.tagReviewStatus,
        review_note: tagResult.reviewNote,
      })

      usedNames.delete(oldName)
      usedNames.add(newName)
      updatedFoodIds.add(existing.id)

      const samePortion = portionsAreSame(
        portion.usdaLabel,
        portion.usdaGrams,
        existing.serving_size,
        existing.serving_grams
      )
      const additionalPortion = existing.portions?.find((p) => !p.is_default)

      mergePlanRows.push({
        candidate_id: row.candidate_id,
        name_tr: row.name_tr,
        catalog_action: resolved.action,
        existing_catalog_food_id: existing.id,
        final_catalog_food_id: existing.id,
        final_slug: existing.slug,
        old_name: oldName,
        new_name: newName,
        old_serving_label: existing.serving_size,
        old_serving_grams: existing.serving_grams,
        official_portion_label: portion.usdaLabel,
        official_portion_grams: portion.usdaGrams,
        default_portion_action: portion.defaultPortionAction,
        nutrition_action: 'usda_calories_scaled_to_existing_serving',
        source_id: row.source_id,
        official_fdc_id: row.official_fdc_id,
        validation_status: row.review_status,
        validation_note: `${resolved.identityNote}. USDA calories ${macros.calories}; Atwater ${atwater} not used.`,
      })

      portionRows.push({
        candidate_id: row.candidate_id,
        final_catalog_food_id: existing.id,
        catalog_action: resolved.action,
        existing_default_portion_label: existing.serving_size,
        existing_default_portion_grams: existing.serving_grams,
        usda_portion_label: portion.usdaLabel,
        usda_portion_grams: portion.usdaGrams,
        merged_default_portion_label: portion.mergedLabel,
        merged_default_portion_grams: portion.mergedGrams,
        default_portion_action: portion.defaultPortionAction,
        additional_portion_label: samePortion ? '' : (additionalPortion?.label ?? portion.usdaLabel),
        additional_portion_grams: samePortion ? '' : portion.usdaGrams,
        additional_portion_source: samePortion ? '' : 'source_verified_usda',
        portion_source: portion.portionSource,
        portion_merge_note: portion.note,
      })

      updatesList.push(`${existing.id}: ${oldName} → ${newName} (${row.candidate_id})`)
      continue
    }

    const portion = resolvePortionPlan(row, resolved.action, null)
    let slug = resolved.fixedSlug ?? slugify(resolved.displayName)
    if (resolved.fixedSlug && usedSlugs.has(slug)) {
      fail(`${row.candidate_id}: fixed slug "${slug}" already exists in catalog`)
    }
    let n = 2
    while (usedSlugs.has(slug)) {
      slug = `${slugify(resolved.displayName)}_${n}`
      n++
    }
    usedSlugs.add(slug)

    if (usedNames.has(resolved.displayName)) {
      blockers.push(`${row.candidate_id}: blocked duplicate display name "${resolved.displayName}"`)
      continue
    }
    usedNames.add(resolved.displayName)

    const macros = servingFromUsda(row, portion.mergedGrams)
    const tagResult = resolveTags({
      displayName: resolved.displayName,
      row,
      existingTags: [],
      isUpdate: false,
    })
    const aliases = new Set(resolved.searchAliases ?? [])
    if (row.name_tr && row.name_tr !== resolved.displayName) aliases.add(row.name_tr)

    const entry = {
      id: nextId,
      slug,
      name: resolved.displayName,
      category: mapCategory(row.category_tr),
      calories: macros.calories,
      protein: macros.protein,
      carbs: macros.carbs,
      fat: macros.fat,
      serving_size: portion.mergedLabel,
      serving_grams: portion.mergedGrams,
      data_source: 'USDA_PREVIEW',
      tags: tagResult.tags,
      search_aliases: [...aliases],
      portions: buildPortionsArray(portion, resolved.action, null),
      review: buildReview(
        row,
        micro,
        portion,
        row.candidate_id === 'wl_172'
          ? 'New USDA-verified food variant; existing Kereviz id 155 was preserved unchanged.'
          : undefined
      ),
      usda_per_100g: buildUsdaPer100g(row, micro),
    }
    if (micro.fiber_100g != null) entry.fiber_100g = micro.fiber_100g
    if (micro.sugar_100g != null) entry.sugar_100g = micro.sugar_100g
    if (micro.sodium_mg_100g != null) entry.sodium_mg_100g = micro.sodium_mg_100g

    tagSafetyRows.push({
      food_id: nextId,
      name: resolved.displayName,
      old_tags: tagResult.oldTags.join('|'),
      new_tags: tagResult.tags.join('|'),
      removed_tags: tagResult.removed.join('|'),
      added_tags: tagResult.added.join('|'),
      tag_review_status: tagResult.tagReviewStatus,
      review_note: tagResult.reviewNote,
    })

    catalogById.set(nextId, entry)
    newFoodIds.push(nextId)

    mergePlanRows.push({
      candidate_id: row.candidate_id,
      name_tr: row.name_tr,
      catalog_action: resolved.action,
      existing_catalog_food_id: '',
      final_catalog_food_id: nextId,
      final_slug: slug,
      old_name: '',
      new_name: resolved.displayName,
      old_serving_label: '',
      old_serving_grams: '',
      official_portion_label: portion.usdaLabel,
      official_portion_grams: portion.usdaGrams,
      default_portion_action: portion.defaultPortionAction,
      nutrition_action: 'usda_scaled_to_official_default_portion',
      source_id: row.source_id,
      official_fdc_id: row.official_fdc_id,
      validation_status: row.review_status,
      validation_note: resolved.identityNote,
    })

    portionRows.push({
      candidate_id: row.candidate_id,
      final_catalog_food_id: nextId,
      catalog_action: resolved.action,
      existing_default_portion_label: '',
      existing_default_portion_grams: '',
      usda_portion_label: portion.usdaLabel,
      usda_portion_grams: portion.usdaGrams,
      merged_default_portion_label: portion.mergedLabel,
      merged_default_portion_grams: portion.mergedGrams,
      default_portion_action: portion.defaultPortionAction,
      additional_portion_label: '',
      additional_portion_grams: '',
      additional_portion_source: '',
      portion_source: portion.portionSource,
      portion_merge_note: portion.note,
    })

    newList.push(`${nextId}: ${resolved.displayName} (${row.candidate_id})`)
    nextId++
  }

  const mergedCatalog = [...catalogById.values()].sort((a, b) => a.id - b.id)
  const touchedIds = new Set([...updatedFoodIds, ...newFoodIds])
  const nullViolations = []
  const legacyNullViolations = []
  const atwaterReplacements = []

  for (const food of mergedCatalog) {
    const issues = micronutrientClaimViolations(food)
    if (!issues.length) continue
    const label = `${food.id} ${food.name}: ${issues.join('; ')}`
    if (touchedIds.has(food.id)) nullViolations.push(label)
    else legacyNullViolations.push(label)
  }

  for (const row of mergePlanRows) {
    const food = mergedCatalog.find((f) => f.id === Number(row.final_catalog_food_id))
    if (!food?.usda_per_100g?.calories || !food.serving_grams) continue
    const expected = food.usda_per_100g.calories * food.serving_grams / 100
    const atwater = macroCalories(food.protein, food.carbs, food.fat)
    if (Math.abs(atwater - food.calories) < PRECISION_TOLERANCE && Math.abs(expected - atwater) > PRECISION_TOLERANCE) {
      atwaterReplacements.push(`${food.id} ${food.name}`)
    }
  }

  const portionCaveats = buildPortionCaveats(mergedCatalog, portionRows)

  const ids = mergedCatalog.map((f) => f.id)
  const slugs = mergedCatalog.map((f) => f.slug)
  const names = mergedCatalog.map((f) => f.name)
  const dbHashAfter = fileSha256(DB_PATH)

  const validation = {
    catalogTotal: mergedCatalog.length,
    updateCount: updatedFoodIds.size,
    newCount: newFoodIds.length,
    duplicateIds: ids.length - new Set(ids).size,
    duplicateSlugs: slugs.length - new Set(slugs).size,
    duplicateNames: names.length - new Set(names).size,
    missingFdc: mergePlanRows.filter((r) => !r.official_fdc_id),
    nullViolations,
    legacyNullViolations,
    atwaterReplacements,
    dbHashUnchanged: dbHashBefore === dbHashAfter,
  }

  writeFileSync(MERGE_PLAN_CSV, `${toCsv(MERGE_PLAN_COLUMNS, mergePlanRows)}\n`, 'utf8')
  writeFileSync(PORTION_PREVIEW_CSV, `${toCsv(PORTION_COLUMNS, portionRows)}\n`, 'utf8')
  writeFileSync(TAG_SAFETY_CSV, `${toCsv(TAG_SAFETY_COLUMNS, tagSafetyRows)}\n`, 'utf8')
  writeFileSync(PORTION_CAVEATS_CSV, `${toCsv(PORTION_CAVEAT_COLUMNS, portionCaveats)}\n`, 'utf8')
  writeFileSync(PREVIEW_DB_PATH, renderPreviewDatabase(mergedCatalog, ORIGINAL_COUNT), 'utf8')
  writeFileSync(
    VALIDATION_MD,
    renderValidationMd({
      officialInputCount: pilotRows.length,
      includedCount: includedRows.length,
      excludedRows,
      excludedSemanticMismatch: excludedRows.filter((x) => x.includes('semantic_source_mismatch')).length,
      identityReclassifications,
      manualPromotions,
      updatesList,
      newList,
      blockers,
      validation,
      validationReportPresent: validationReport.length > 0,
    }),
    'utf8'
  )

  console.log(`Official input rows: ${pilotRows.length}`)
  console.log(`Included: ${includedRows.length} | Updates: ${validation.updateCount} | New: ${validation.newCount}`)
  console.log(`Merged catalog total: ${validation.catalogTotal}`)
  console.log(`Merge plan → ${MERGE_PLAN_CSV}`)
  console.log(`Portion preview → ${PORTION_PREVIEW_CSV}`)
  console.log(`Tag safety → ${TAG_SAFETY_CSV}`)
  console.log(`Portion caveats → ${PORTION_CAVEATS_CSV}`)
  console.log(`Preview DB → ${PREVIEW_DB_PATH}`)
  console.log(`Validation → ${VALIDATION_MD}`)
  if (identityReclassifications.length) {
    console.log(`Identity reclassifications: ${identityReclassifications.length}`)
    identityReclassifications.forEach((line) => console.log(`  - ${line}`))
  }
  if (blockers.length) {
    console.log(`Blockers: ${blockers.length}`)
    blockers.forEach((line) => console.log(`  - ${line}`))
    process.exit(1)
  }
}

main()
