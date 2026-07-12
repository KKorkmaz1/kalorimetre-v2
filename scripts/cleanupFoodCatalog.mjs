/**
 * One-shot catalog cleanup: categories, review metadata, cleanup reports.
 * Run: node scripts/cleanupFoodCatalog.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { MASTER_FOOD_DB, macroCalories } from '../src/utils/foodDatabase.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR = join(__dirname, 'output')
const QUALITY_REPORT = join(OUTPUT_DIR, 'current_catalog_240_quality_report.csv')
const FOOD_DB_PATH = join(__dirname, '..', 'src', 'utils', 'foodDatabase.js')

const MANUAL_CATEGORY = {
  48: 'Tahıl & Ekmek',
  62: 'Meyve',
  71: 'Sebze',
  103: 'Kahvaltılık',
  108: 'Kuruyemiş',
  114: 'Yemek',
  119: 'Et & Tavuk',
  120: 'Et & Tavuk',
  132: 'Kahvaltılık',
  133: 'Kahvaltılık',
  134: 'Atıştırmalık',
  150: 'Meyve',
  186: 'Tahıl & Ekmek',
  187: 'Et & Tavuk',
  201: 'Balık & Deniz',
  234: 'Yemek',
  238: 'Balık & Deniz',
}

const MANUAL_NAME = {
  71: 'Kabak',
}

const NEEDS_REVIEW_IDS = new Set([71, 143, 153])

function parseCsvLine(line) {
  const fields = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          field += '"'
          i++
          continue
        }
        inQuotes = false
        continue
      }
      field += ch
      continue
    }

    if (ch === '"') {
      inQuotes = true
      continue
    }
    if (ch === ',') {
      fields.push(field)
      field = ''
      continue
    }
    field += ch
  }

  fields.push(field)
  return fields
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean)
  const headers = parseCsvLine(lines[0])
  return lines.slice(1).map((line) => {
    const cols = parseCsvLine(line)
    return Object.fromEntries(headers.map((h, idx) => [h, cols[idx] ?? '']))
  })
}

function inferCategory(name) {
  const n = String(name || '').toLocaleLowerCase('tr-TR')

  if (/çorba|corba|corbasi/i.test(n)) return 'Çorba'
  if (/baklava|künefe|revani|sütlaç|aşure|helva|lokum|lokma|irmik/i.test(n)) return 'Tatlı'
  if (/köfte|döner|pilav üstü|kokoreç/i.test(n)) return 'Et & Tavuk'
  if (/hünkar|beğendi|musakka|güveç/i.test(n)) return 'Yemek'
  if (/ay çekirdeği|kabak çekirdeği|çekirdek/i.test(n)) return 'Kuruyemiş'
  if (/somon|levrek|çupra|hamsi|karides|ton bal|balık|midye/i.test(n)) return 'Balık & Deniz'
  if (/^bal$/i.test(n) || /reçel|pekmez|tahin/i.test(n)) return 'Kahvaltılık'
  if (/protein bar/i.test(n)) return 'Atıştırmalık'
  if (/avokado/i.test(n)) return 'Meyve'
  if (/ekmek|pilav|makarna|bulgur|yulaf|kinoa|simit|bazlama|lavaş|pide|börek|poğaça|tost|granola|gevrek|erişte|şehriye|spagetti|krep|waffle/i.test(n)) {
    return 'Tahıl & Ekmek'
  }
  if (
    /^(elma|muz|portakal|çilek|kiraz|erik|armut|karpuz|kavun|üzüm|nar|kivi|ananas|kayısı|hurma|greyfurt|mandalina|incir|şeftali|ayva|limon|vişne|böğürtlen|ahududu|dut|mango|papaya)\b/i.test(n) ||
    /\bmeyve\b|kuru üzüm|kayısı\s*\(kuru\)/i.test(n)
  ) {
    return 'Meyve'
  }
  if (/domates|salatalık|marul|havuç|ıspanak|brokoli|karnabahar|kabak|patlıcan|biber|roka|mantar|patates|mısır|bezelye|soğan|sarımsak|lahana|kereviz|pırasa|enginar|bamya|semizotu|turşu/i.test(n)) {
    return 'Sebze'
  }
  if (/köfte|dana|kuzu|tavuk|hindi|kebap|döner|pastırma|sucuk|sosis|salam|jambon|ciğer|tas kebab/i.test(n) || /\bet\b/i.test(n)) {
    return 'Et & Tavuk'
  }
  if (/süt|yoğurt|peynir|kefir|labne|krema|tereya|kaymak|çökelek|mozzarella/i.test(n)) {
    if (/muzlu süt|çay|ayran/i.test(n)) return 'İçecek'
    if (/çikolata/i.test(n)) return 'Atıştırmalık'
    return 'Süt Ürünleri'
  }
  if (/mercimek|nohut|fasulye|humus|bakla|barbunya/i.test(n)) return 'Baklagil'
  if (/badem|ceviz|fındık|fıstık|cekirdegi|chia|antep|kaju|leblebi|kuruyemiş/i.test(n)) return 'Kuruyemiş'
  if (/çay|kahve|\bsu\b|ayran|muzlu süt/i.test(n)) return 'İçecek'
  if (/zeytinyağ|\bzeytin\b|ayçiçek/i.test(n)) return 'Yağ & Sos'
  if (/menemen|lahmacun|mantı|iskender|gözleme|karnıyarık|cacık|dolma|sarma|imam|kısır|musakka|güveç|mücver|piyaz|falafel|kumpir|pilaki|salata|ton salata|zeytinyağlı enginar/i.test(n)) {
    return 'Yemek'
  }
  if (/yumurta|omlet/i.test(n)) return 'Yumurta'
  if (/tahin pekmez|kahvaltılık/i.test(n)) return 'Kahvaltılık'
  if (/bisküvi|çikolata|gofret|cips|kraker|popcorn/i.test(n)) return 'Atıştırmalık'

  return 'Genel'
}

function loadQualityReport() {
  const text = readFileSync(QUALITY_REPORT, 'utf8')
  const rows = parseCsv(text)
  return new Map(rows.map(r => [Number(r.catalog_food_id), r]))
}

function buildReview(status, notes = null) {
  return {
    source_type: 'LOCAL_MASTER_PENDING_VERIFICATION',
    source_name: 'foodDatabase.js',
    source_food_id: null,
    review_status: status,
    ...(notes ? { notes } : {}),
  }
}

function classifyNeedsReview(reportRow, food, categoryBefore) {
  const id = food.id
  if (NEEDS_REVIEW_IDS.has(id)) return true

  const proposed = reportRow?.proposed_status ?? ''
  const issues = reportRow?.issues_summary ?? ''
  const action = reportRow?.recommended_action ?? ''

  if (action.includes('DÜZELTME ÖNCELİĞİ')) return true
  if (proposed === 'CANDIDATE_WRONG_AND_CURRENT_SUSPICIOUS') return true
  if (/imkansız|karışmış|macro_weight_over/i.test(issues)) return true

  if (
    proposed === 'USDA_RELATED_BUT_VALUES_DIFFER_REVIEW' ||
    proposed === 'RECIPE_OR_TURKISH_MEAL_NEEDS_MANUAL_SOURCE' ||
    proposed === 'REJECT_USDA_CANDIDATE_KEEP_CURRENT_PENDING'
  ) {
    return true
  }

  const mult = Math.max(food.serving_grams / 100, 0.01)
  const p100 = food.protein / mult
  const c100 = food.carbs / mult
  const f100 = food.fat / mult
  if (p100 + c100 + f100 > 105) return true

  const atwater = macroCalories(food.protein, food.carbs, food.fat)
  if (Math.abs(atwater - food.calories) > 2) return true

  return false
}

function buildReviewNotes(reportRow, food, issueType) {
  const notes = []

  if (food.id === 71) {
    notes.push('Eski ad "Kabak (Havuç)" belirsizdi; kabak olarak düzeltildi, makrolar kaynakla doğrulanmalı.')
  }
  if (food.id === 143) {
    notes.push('Limon makroları ve USDA eşleşmesi kaynakla doğrulanmalı.')
  }
  if (food.id === 153) {
    notes.push('Sarımsak porsiyon/makro değerleri USDA ile doğrulanmalı.')
  }

  if (reportRow?.recommended_action) notes.push(reportRow.recommended_action)
  if (issueType === 'category_fix') notes.push('Kategori düzeltildi; besin değerleri değişmedi.')

  const issues = reportRow?.issues_summary ?? ''
  if (/fiber_100g_zero_placeholder|sugar_100g_zero_placeholder|sodium_mg_100g_zero_placeholder/.test(issues)) {
    notes.push('Lif/şeker/sodyum placeholder sıfır; gerçek değerler eklenmeli.')
  }

  return [...new Set(notes)].join(' ').trim() || null
}

function formatJsValue(value, indent = 2) {
  if (value === null) return 'null'
  if (typeof value === 'string') return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
  if (typeof value === 'number') return String(value)
  if (Array.isArray(value)) {
    if (!value.length) return '[]'
    return `[${value.map(v => formatJsValue(v)).join(', ')}]`
  }
  if (typeof value === 'object') {
    const pad = ' '.repeat(indent)
    const inner = Object.entries(value)
      .map(([k, v]) => `${pad}${k}: ${formatJsValue(v, indent + 2)}`)
      .join(',\n')
    return `{\n${inner},\n${' '.repeat(indent - 2)}}`
  }
  return String(value)
}

function formatReview(review) {
  const lines = [
    '    review: {',
    `      source_type: ${formatJsValue(review.source_type)},`,
    `      source_name: ${formatJsValue(review.source_name)},`,
    `      source_food_id: ${formatJsValue(review.source_food_id)},`,
    `      review_status: ${formatJsValue(review.review_status)},`,
  ]
  if (review.notes) lines.push(`      notes: ${formatJsValue(review.notes)},`)
  lines.push('    },')
  return lines.join('\n')
}

function formatFoodEntry(food) {
  const lines = [
    '  {',
    `    id: ${food.id},`,
    `    slug: ${formatJsValue(food.slug)},`,
    `    name: ${formatJsValue(food.name)},`,
    `    category: ${formatJsValue(food.category)},`,
    `    calories: ${food.calories},`,
    `    protein: ${food.protein},`,
    `    carbs: ${food.carbs},`,
    `    fat: ${food.fat},`,
    `    serving_size: ${formatJsValue(food.serving_size)},`,
    `    serving_grams: ${food.serving_grams},`,
    `    data_source: ${formatJsValue(food.data_source)},`,
    `    tags: ${formatJsValue(food.tags)},`,
    formatReview(food.review),
    '  },',
  ]
  return lines.join('\n')
}

function csvCell(value) {
  if (value === null || value === undefined) return ''
  const text = String(value)
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

function toCsv(columns, rows) {
  return [columns.join(','), ...rows.map(row => columns.map(col => csvCell(row[col])).join(','))].join('\n')
}

function extractCategoryMismatch(issuesSummary) {
  const match = String(issuesSummary || '').match(/category_mismatch:\s*([^->]+?)\s*->\s*([^|]+)/)
  if (!match) return null
  return { before: match[1].trim(), after: match[2].trim() }
}

function main() {
  const quality = loadQualityReport()
  const cleanupRows = []
  const needsReviewRows = []

  const cleanedFoods = MASTER_FOOD_DB.map(food => {
    const report = quality.get(food.id)
    const name = MANUAL_NAME[food.id] ?? food.name
    const mismatch = extractCategoryMismatch(report?.issues_summary)
    const categoryBefore = mismatch?.before ?? report?.category_tr ?? inferCategory(food.name)
    const categoryAfter =
      MANUAL_CATEGORY[food.id] ||
      mismatch?.after ||
      report?.suggested_category_tr ||
      inferCategory(name)

    let issueType = 'none'
    let actionTaken = 'review_metadata_added'

    if (categoryBefore !== categoryAfter) {
      issueType = 'category_fix'
      actionTaken = `category: ${categoryBefore} -> ${categoryAfter}`
    }

    if (MANUAL_NAME[food.id] && MANUAL_NAME[food.id] !== (report?.name_tr ?? food.name)) {
      issueType = issueType === 'category_fix' ? 'category_and_name_fix' : 'name_fix'
      actionTaken = `${actionTaken}; name: ${report?.name_tr ?? food.name} -> ${name}`
    }

    const needsReview = classifyNeedsReview(report, food, categoryBefore)
    const reviewStatus = needsReview ? 'needs_review' : 'pending_verification'
    const notes = buildReviewNotes(report, food, issueType)

    if (needsReview) {
      needsReviewRows.push({
        food_id: food.id,
        name,
        category: categoryAfter,
        calories: food.calories,
        protein: food.protein,
        carbs: food.carbs,
        fat: food.fat,
        proposed_status: report?.proposed_status ?? '',
        review_status: reviewStatus,
        notes: notes ?? '',
        issues_summary: report?.issues_summary ?? '',
      })
    }

    cleanupRows.push({
      food_id: food.id,
      name,
      category_before: categoryBefore,
      category_after: categoryAfter,
      calories: food.calories,
      protein: food.protein,
      carbs: food.carbs,
      fat: food.fat,
      issue_type: issueType,
      action_taken: actionTaken,
      review_status: reviewStatus,
      notes: notes ?? '',
    })

    return {
      ...food,
      name,
      category: categoryAfter,
      review: buildReview(reviewStatus, notes),
    }
  })

  const source = readFileSync(FOOD_DB_PATH, 'utf8')
  const startMarker = 'export const MASTER_FOOD_DB = ['
  const endMarker = '\n/** Legacy export'
  const startIdx = source.indexOf(startMarker)
  const endIdx = source.indexOf(endMarker, startIdx)
  if (startIdx === -1 || endIdx === -1) throw new Error('MASTER_FOOD_DB block not found')

  const header = `/**
 * Kalorimetre MASTER Food Database — MVP Nutrition Dataset
 *
 * Source of truth: natural serving macros (NOT per 100 g).
 * calories / protein / carbs / fat = values for serving_size (e.g. "1 Kase").
 * calories always equals Atwater sum: 4×Protein + 4×Carbs + 9×Fat.
 *
 * FOOD_DB is a legacy projection for UI calcPreview / unit scaling.
 */

/** Atwater general factors */
export function macroCalories(protein, carbs, fat) {
  return Math.round(protein * 4 + carbs * 4 + fat * 9)
}

/** Default review metadata for catalog entries pending source verification. */
export const CATALOG_REVIEW = {
  source_type: 'LOCAL_MASTER_PENDING_VERIFICATION',
  source_name: 'foodDatabase.js',
  source_food_id: null,
  review_status: 'pending_verification',
  notes: null,
}

/** @deprecated Use CATALOG_REVIEW — kept for import compatibility. */
export const PENDING_REVIEW = CATALOG_REVIEW

/** @deprecated Use CATALOG_REVIEW — kept for import compatibility. */
export const LEGACY_REVIEW = CATALOG_REVIEW

/** Parse "1 Kase" → { qty: 1, unit: "Kase" } */
export function parseServingSize(servingSize) {
  const m = String(servingSize || '').match(/^(\\d+(?:\\.\\d+)?)\\s+(.+)$/)
  if (m) return { qty: parseFloat(m[1]), unit: m[2] }
  return { qty: 1, unit: servingSize || 'Porsiyon' }
}

/** Build legacy FOOD_DB row from a master entry (UI basket scaling). */
export function toLegacyFood(master) {
  const { unit } = parseServingSize(master.serving_size)
  const mult = Math.max(master.serving_grams / 100, 0.01)

  const legacy = {
    id: master.id,
    slug: master.slug,
    name: master.name,
    category: master.category ?? null,
    calories: master.calories / mult,
    protein: master.protein / mult,
    carbs: master.carbs / mult,
    fat: master.fat / mult,
    units: { Gram: 0.01, [unit]: mult },
    tags: master.tags ?? [],
    serving_size: master.serving_size,
    data_source: master.data_source,
    review: master.review ?? CATALOG_REVIEW,
    _natural: {
      calories: master.calories,
      protein: master.protein,
      carbs: master.carbs,
      fat: master.fat,
      unit,
      grams: master.serving_grams,
    },
  }

  if (unit === 'Bardak' || unit === 'Fincan' || unit === 'Su Bardağı') {
    legacy.units.Mililitre = 0.01
  }

  return legacy
}

`

  const foodsBlock = `${startMarker}\n${cleanedFoods.map(formatFoodEntry).join('\n\n')}\n]`
  const tail = source.slice(endIdx)
  writeFileSync(FOOD_DB_PATH, header + foodsBlock + tail, 'utf8')

  const cleanupColumns = [
    'food_id', 'name', 'category_before', 'category_after', 'calories', 'protein', 'carbs', 'fat',
    'issue_type', 'action_taken', 'review_status', 'notes',
  ]
  const needsReviewColumns = [
    'food_id', 'name', 'category', 'calories', 'protein', 'carbs', 'fat',
    'proposed_status', 'review_status', 'notes', 'issues_summary',
  ]

  writeFileSync(join(OUTPUT_DIR, 'current_catalog_cleanup_report.csv'), `${toCsv(cleanupColumns, cleanupRows)}\n`, 'utf8')
  writeFileSync(join(OUTPUT_DIR, 'current_catalog_needs_review.csv'), `${toCsv(needsReviewColumns, needsReviewRows)}\n`, 'utf8')

  const categoryFixes = cleanupRows.filter(r => r.issue_type.includes('category') || r.issue_type.includes('name'))
  console.log(`Cleaned ${cleanedFoods.length} foods`)
  console.log(`Category/name fixes: ${categoryFixes.length}`)
  console.log(`Needs review: ${needsReviewRows.length}`)
}

main()
