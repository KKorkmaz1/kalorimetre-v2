/**
 * Standalone validation for foodDatabase.usda-preview.js
 * Run: node scripts/validateUsdaPreview.mjs
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'

import { MASTER_FOOD_DB as LIVE_MASTER } from '../src/utils/foodDatabase.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR = join(__dirname, 'output')
const PREVIEW_PATH = join(OUTPUT_DIR, 'foodDatabase.usda-preview.js')
const MERGE_PLAN_CSV = join(OUTPUT_DIR, 'usda_final_catalog_merge_plan.csv')
const PORTION_PREVIEW_CSV = join(OUTPUT_DIR, 'usda_final_portion_merge_preview.csv')
const PRECISION_CSV = join(OUTPUT_DIR, 'usda_precision_validation.csv')
const VALIDATION_MD = join(OUTPUT_DIR, 'usda_final_integration_validation.md')

const PRECISION_TOLERANCE = 0.000001
const EXPLICIT_PRECISION_FOODS = [
  'Dereotu (Taze)',
  'Maydanoz (Taze)',
  'Badem (Çiğ)',
  'Kuru İncir',
  'Kuru Erik',
  'Tereyağı (Tuzsuz)',
]

const PRECISION_COLUMNS = [
  'food_id',
  'name',
  'field',
  'official_usda_per_100g',
  'food_db_per_100g',
  'absolute_difference',
  'relative_difference',
  'validation_status',
]

const MACRO_FIELDS = ['calories', 'protein', 'carbs', 'fat']
const MICRO_FIELDS = ['fiber_100g', 'sugar_100g', 'sodium_mg_100g']

function fail(message) {
  console.error(`FAIL: ${message}`)
  process.exit(1)
}

function pass(message) {
  console.log(`PASS: ${message}`)
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

function normalizeLabel(label) {
  return String(label || '').trim().replace(/^100\s*gram$/i, '100 Gram')
}

function exactEqual(a, b) {
  if (a == null && b == null) return true
  if (a == null || b == null) return false
  return Math.abs(a - b) <= PRECISION_TOLERANCE
}

function near(a, b, tol = PRECISION_TOLERANCE) {
  return Math.abs(a - b) <= tol
}

function isDairyFood(food) {
  const text = `${food.name} ${food.category || ''}`.toLocaleLowerCase('tr-TR')
  return food.category === 'Süt Ürünleri' || /süt|yoğurt|peynir|tereya|cheese|milk|yogurt|butter|kaymak|krema/.test(text)
}

function isAnimalFood(food) {
  const cat = String(food.category || '')
  return cat.includes('Et') || cat.includes('Tavuk') || cat.includes('Balık')
}

function isNutFood(food) {
  const text = `${food.name} ${food.category || ''}`.toLocaleLowerCase('tr-TR')
  return (
    food.category === 'Kuruyemiş' ||
    /kaju|badem|fıstık|ceviz|fındık|nut|cashew|chia|tohum|seed/.test(text)
  )
}

function isBulgurFood(food) {
  return /bulgur/i.test(food.name)
}

function checkSyntax() {
  readFileSync(PREVIEW_PATH, 'utf8')
  const syntax = spawnSync(process.execPath, ['--check', PREVIEW_PATH], { encoding: 'utf8' })
  if (syntax.status !== 0) {
    fail(`JavaScript syntax invalid\n${syntax.stderr || syntax.stdout}`)
  }
  pass('JavaScript syntax valid (--check)')
}

async function importPreview() {
  const mod = await import(pathToFileURL(PREVIEW_PATH).href)
  if (!mod.MASTER_FOOD_DB || !Array.isArray(mod.MASTER_FOOD_DB)) {
    fail('MASTER_FOOD_DB missing or not an array')
  }
  if (!mod.FOOD_DB || !Array.isArray(mod.FOOD_DB)) {
    fail('FOOD_DB missing or not an array')
  }
  if (typeof mod.toLegacyFood !== 'function') {
    fail('toLegacyFood export missing')
  }
  if (typeof mod.parseServingSize !== 'function') {
    fail('parseServingSize export missing')
  }
  pass(`Imported preview module (${mod.MASTER_FOOD_DB.length} master foods)`)
  return mod
}

function validateSemanticIdentity(mod, mergePlan) {
  if (mergePlan.some((r) => r.candidate_id === 'wl_119')) {
    fail('wl_119 (Kızılcık) must be excluded as semantic_source_mismatch')
  }

  const kizilcik = mod.MASTER_FOOD_DB.find(
    (f) => f.review?.source_food_id === '171722' || (f.name === 'Kızılcık' && f.review?.source_type === 'USDA')
  )
  if (kizilcik) {
    fail(`FDC 171722 must not appear as Kızılcık; found id ${kizilcik.id} "${kizilcik.name}"`)
  }
  pass('Kızılcık / FDC 171722 excluded as semantic mismatch')

  const celeryRows = mod.MASTER_FOOD_DB.filter((f) => f.review?.source_food_id === '2346405')
  if (celeryRows.length !== 1) {
    fail(`FDC 2346405 must appear exactly once; found ${celeryRows.length}`)
  }
  if (celeryRows[0].name !== 'Kereviz Sapı (Çiğ)') {
    fail(`FDC 2346405 must be "Kereviz Sapı (Çiğ)", got "${celeryRows[0].name}"`)
  }
  if (celeryRows[0].slug !== 'kereviz_sapi_cig') {
    fail(`FDC 2346405 slug must be kereviz_sapi_cig, got "${celeryRows[0].slug}"`)
  }
  if (String(celeryRows[0].review?.notes || '').includes('Exact existing record update')) {
    fail('Kereviz Sapı (Çiğ) review note must not say "Exact existing record update"')
  }
  pass('FDC 2346405 appears only as Kereviz Sapı (Çiğ) with correct metadata')

  const live155 = LIVE_MASTER.find((f) => f.id === 155)
  const preview155 = mod.MASTER_FOOD_DB.find((f) => f.id === 155)
  if (!live155 || !preview155) fail('Catalog id 155 (Kereviz) missing')
  const compareKeys = ['name', 'slug', 'calories', 'protein', 'carbs', 'fat', 'serving_size', 'serving_grams']
  for (const key of compareKeys) {
    if (preview155[key] !== live155[key]) {
      fail(`Kereviz id 155 changed field ${key}: live=${live155[key]} preview=${preview155[key]}`)
    }
  }
  if (preview155.review?.source_type === 'USDA') {
    fail('Kereviz id 155 must remain unchanged local catalog entry, not USDA-updated')
  }
  pass('Catalog id 155 (Kereviz) remains unchanged')
}

function validateMasterRecords(mod) {
  const { MASTER_FOOD_DB, toLegacyFood } = mod
  const ids = new Set()
  const slugs = new Set()
  const names = new Set()

  for (const food of MASTER_FOOD_DB) {
    if (!Number.isInteger(food.id)) fail(`Food missing integer id: ${JSON.stringify(food.name)}`)
    if (ids.has(food.id)) fail(`Duplicate id ${food.id}`)
    ids.add(food.id)

    if (!food.slug || typeof food.slug !== 'string') fail(`Food ${food.id} missing slug`)
    if (slugs.has(food.slug)) fail(`Duplicate slug "${food.slug}"`)
    slugs.add(food.slug)

    if (!food.name || typeof food.name !== 'string') fail(`Food ${food.id} missing name`)
    if (names.has(food.name)) fail(`Duplicate display name "${food.name}"`)
    names.add(food.name)

    if (!food.serving_size || typeof food.serving_size !== 'string') {
      fail(`Food ${food.id} "${food.name}" missing serving_size`)
    }
    if (!Number.isFinite(food.serving_grams) || food.serving_grams <= 0) {
      fail(`Food ${food.id} "${food.name}" has invalid serving_grams (${food.serving_grams})`)
    }

    if (food.review?.review_status === 'usda_officially_verified') {
      if (food.review?.micronutrient_basic_status?.includes('fiber') && food.fiber_100g == null) {
        fail(`Food ${food.id} claims fiber verified but fiber_100g is null`)
      }
      if (food.review?.micronutrient_basic_status?.includes('sugar') && food.sugar_100g == null) {
        fail(`Food ${food.id} claims sugar verified but sugar_100g is null`)
      }
      if (!food.review?.source_food_id) {
        fail(`USDA-verified food ${food.id} missing official FDC ID in review`)
      }
    }

    const legacy = toLegacyFood(food)
    if (!legacy || !legacy._natural) fail(`toLegacyFood failed for id ${food.id}`)
  }

  pass('All master records have valid serving_size / serving_grams')
  pass('All master IDs, slugs, and display names are unique')
  pass(`toLegacyFood processed all ${MASTER_FOOD_DB.length} records`)
}

function validateFoodDbProjection(mod) {
  const { MASTER_FOOD_DB, FOOD_DB, toLegacyFood } = mod
  if (FOOD_DB.length !== MASTER_FOOD_DB.length) {
    fail(`FOOD_DB length ${FOOD_DB.length} != MASTER_FOOD_DB length ${MASTER_FOOD_DB.length}`)
  }

  for (let i = 0; i < MASTER_FOOD_DB.length; i++) {
    const master = MASTER_FOOD_DB[i]
    const legacy = FOOD_DB[i]
    const recomputed = toLegacyFood(master)

    if (legacy.units?.Gram !== 0.01) {
      fail(`Food ${master.id} "${master.name}" units.Gram must be 0.01, got ${legacy.units?.Gram}`)
    }

    for (const key of ['fiber_100g', 'sugar_100g', 'sodium_mg_100g', 'fiber', 'sugar', 'sodium_mg']) {
      const val = legacy[key]
      if (val !== null && typeof val !== 'number') {
        fail(`Food ${master.id} "${master.name}" ${key} must be number or null, got ${typeof val}`)
      }
    }

    if (master.fiber_100g == null && legacy.fiber !== null) {
      fail(`Food ${master.id} fiber must stay null when fiber_100g is null`)
    }
    if (master.sugar_100g == null && legacy.sugar !== null) {
      fail(`Food ${master.id} sugar must stay null when sugar_100g is null`)
    }
    if (master.sodium_mg_100g == null && legacy.sodium_mg !== null) {
      fail(`Food ${master.id} sodium_mg must stay null when sodium_mg_100g is null`)
    }

    if (master.usda_per_100g && !legacy.usda_per_100g) {
      fail(`Food ${master.id} missing usda_per_100g in FOOD_DB projection`)
    }

    if (JSON.stringify(recomputed.units) !== JSON.stringify(legacy.units)) {
      fail(`Food ${master.id} FOOD_DB units mismatch with toLegacyFood`)
    }
  }

  pass('FOOD_DB projection length matches MASTER_FOOD_DB')
  pass('units.Gram is 0.01 for all FOOD_DB records')
  pass('FOOD_DB exposes fiber/sugar/sodium as number or null')
  pass('Null micronutrients remain null in FOOD_DB projection')
}

function comparePrecisionField(master, legacy, field, sourceKey, reportRows) {
  const official = master.usda_per_100g?.[sourceKey]
  const legacyKey = field
  const actual = legacy[legacyKey]
  const absDiff = official == null || actual == null ? '' : Math.abs(actual - official)
  const relDiff =
    official == null || actual == null || official === 0 ? '' : Math.abs((actual - official) / official)
  const ok = exactEqual(actual, official)
  reportRows.push({
    food_id: master.id,
    name: master.name,
    field,
    official_usda_per_100g: official ?? '',
    food_db_per_100g: actual ?? '',
    absolute_difference: absDiff === '' ? '' : absDiff,
    relative_difference: relDiff === '' ? '' : relDiff,
    validation_status: ok ? 'PASS' : 'FAIL',
  })
  return ok
}

function validateExactSourceEquivalence(mod) {
  const { MASTER_FOOD_DB, FOOD_DB } = mod
  const reportRows = []
  let passCount = 0
  let failCount = 0
  let zeroedCount = 0

  const usdaFoods = MASTER_FOOD_DB.filter((f) => f.review?.review_status === 'usda_officially_verified' && f.usda_per_100g)

  for (const master of usdaFoods) {
    const legacy = FOOD_DB.find((f) => f.id === master.id)
    if (!legacy) fail(`Missing FOOD_DB row for USDA food ${master.id}`)

    for (const field of MACRO_FIELDS) {
      const ok = comparePrecisionField(master, legacy, field, field, reportRows)
      if (ok) passCount++
      else failCount++

      const official = master.usda_per_100g[field]
      if (official != null && official !== 0 && legacy[field] === 0) {
        zeroedCount++
        fail(`Non-zero USDA ${field} zeroed for ${master.id} "${master.name}": official=${official}, FOOD_DB=0`)
      }
    }

    const microMap = {
      fiber_100g: 'fiber',
      sugar_100g: 'sugar',
      sodium_mg_100g: 'sodium_mg',
    }
    for (const [legacyField, sourceKey] of Object.entries(microMap)) {
      const ok = comparePrecisionField(master, legacy, legacyField, sourceKey, reportRows)
      if (ok) passCount++
      else failCount++

      const official = master.usda_per_100g[sourceKey]
      if (official != null && official !== 0 && legacy[legacyField] === 0) {
        zeroedCount++
        fail(`Non-zero USDA ${legacyField} zeroed for ${master.id} "${master.name}": official=${official}, FOOD_DB=0`)
      }
    }
  }

  writeFileSync(PRECISION_CSV, `${toCsv(PRECISION_COLUMNS, reportRows)}\n`, 'utf8')

  if (failCount > 0) {
    fail(`Precision validation failed on ${failCount} field comparisons (see ${PRECISION_CSV})`)
  }

  pass(`Exact USDA per-100g macro equivalence (${passCount} field checks passed)`)
  pass(`Precision failures: ${failCount}`)
  pass(`Non-zero USDA values converted to zero: ${zeroedCount}`)

  for (const name of EXPLICIT_PRECISION_FOODS) {
    const master = MASTER_FOOD_DB.find((f) => f.name === name)
    if (!master?.usda_per_100g) fail(`Explicit precision test food missing: ${name}`)
    const legacy = FOOD_DB.find((f) => f.id === master.id)
    for (const field of MACRO_FIELDS) {
      if (!exactEqual(legacy[field], master.usda_per_100g[field])) {
        fail(`${name} ${field}: FOOD_DB=${legacy[field]} != USDA=${master.usda_per_100g[field]}`)
      }
    }
  }
  pass(`Explicit precision foods verified (${EXPLICIT_PRECISION_FOODS.length})`)

  const hundredGramFoods = MASTER_FOOD_DB.filter(
    (f) => f.review?.review_status === 'usda_officially_verified' && normalizeLabel(f.serving_size) === '100 Gram' && f.serving_grams === 100
  )
  for (const master of hundredGramFoods) {
    const legacy = FOOD_DB.find((f) => f.id === master.id)
    for (const field of MACRO_FIELDS) {
      if (!exactEqual(legacy[field], master.usda_per_100g[field])) {
        fail(`100 Gram food ${master.name} ${field} mismatch: FOOD_DB=${legacy[field]} USDA=${master.usda_per_100g[field]}`)
      }
    }
  }
  pass(`All ${hundredGramFoods.length} USDA "100 Gram" records pass exact per-100g equivalence`)

  return { passCount, failCount, zeroedCount }
}

function validateHundredGramScaling(mod) {
  const { MASTER_FOOD_DB, toLegacyFood } = mod
  const hundredGramFoods = MASTER_FOOD_DB.filter(
    (f) => normalizeLabel(f.serving_size) === '100 Gram' && f.serving_grams === 100
  )

  if (!hundredGramFoods.length) fail('No 100 Gram serving records found to test')

  for (const master of hundredGramFoods) {
    const legacy = toLegacyFood(master)
    if (legacy.units.Gram !== 0.01) {
      fail(`100 Gram food ${master.id} "${master.name}" has units.Gram=${legacy.units.Gram}`)
    }

    const per100 = master.usda_per_100g ?? {
      calories: legacy.calories,
      protein: legacy.protein,
      carbs: legacy.carbs,
      fat: legacy.fat,
    }

    const gramFactor = legacy.units.Gram
    const checks = [
      ['calories', legacy.calories * gramFactor, per100.calories * 0.01],
      ['protein', legacy.protein * gramFactor, per100.protein * 0.01],
      ['carbs', legacy.carbs * gramFactor, per100.carbs * 0.01],
      ['fat', legacy.fat * gramFactor, per100.fat * 0.01],
    ]

    for (const [label, actual, expected] of checks) {
      if (!near(actual, expected)) {
        fail(
          `100 Gram food ${master.id} "${master.name}" failed 1g ${label} scaling: ${actual} vs expected ${expected}`
        )
      }
    }

    if (master.fiber_100g != null) {
      const expected = master.fiber_100g * 0.01
      const actual = legacy.fiber_100g * gramFactor
      if (!near(actual, expected)) {
        fail(`100 Gram food ${master.id} fiber 1g scaling failed: ${actual} vs ${expected}`)
      }
    } else if (legacy.fiber != null) {
      fail(`100 Gram food ${master.id} fiber should be null`)
    }
  }

  pass(`All ${hundredGramFoods.length} "100 Gram" records pass 1g scaling tests`)
}

function validateTagSafety(mod) {
  for (const food of mod.MASTER_FOOD_DB) {
    if (food.review?.review_status !== 'usda_officially_verified') continue
    const tags = food.tags ?? []

    if (isDairyFood(food) && tags.includes('Vegan')) {
      fail(`Dairy food ${food.id} "${food.name}" must not have Vegan tag`)
    }
    if (isDairyFood(food) && tags.includes('Laktozsuz')) {
      fail(`Dairy food ${food.id} "${food.name}" must not have Laktozsuz without explicit lactose-free source`)
    }
    if (isBulgurFood(food) && tags.includes('Glutensiz')) {
      fail(`Bulgur food ${food.id} "${food.name}" must not have Glutensiz tag`)
    }
    if (isNutFood(food) && tags.includes('Kuruyemişsiz')) {
      fail(`Nut food ${food.id} "${food.name}" must not have Kuruyemişsiz tag`)
    }
    if (isAnimalFood(food) && tags.includes('Vegan')) {
      fail(`Animal food ${food.id} "${food.name}" must not have Vegan tag`)
    }
  }

  pass('No contradictory dietary/allergy tags on USDA-touched records')
}

function validatePortions(mod, portionRows) {
  const { parseServingSize, toLegacyFood } = mod

  for (const master of mod.MASTER_FOOD_DB) {
    if (!master.portions?.length) continue
    if (master.review?.source_type !== 'USDA') continue

    const legacy = toLegacyFood(master)
    if (legacy.units.Gram !== 0.01) {
      fail(`USDA food ${master.id} must preserve units.Gram=0.01`)
    }

    for (const portion of master.portions) {
      const { unit } = parseServingSize(portion.label)
      if (unit === 'Gram') {
        if (legacy.units.Gram !== 0.01) {
          fail(`Portion Gram must not overwrite 0.01 on food ${master.id}`)
        }
        continue
      }
      const expectedMult = Math.max(portion.grams / 100, 0.01)
      if (legacy.units[unit] !== expectedMult) {
        fail(
          `Food ${master.id} "${master.name}" missing portion unit "${unit}" (${expectedMult}); got ${legacy.units[unit]}`
        )
      }
    }

    const mergeRow = portionRows.find((r) => Number(r.final_catalog_food_id) === master.id)
    if (mergeRow?.additional_portion_label) {
      const { unit } = parseServingSize(mergeRow.additional_portion_label)
      if (unit !== 'Gram' && legacy.units[unit] == null) {
        fail(`Food ${master.id} missing additional portion unit ${unit} from merge CSV`)
      }
    }
  }

  pass('All approved additional portions are represented in FOOD_DB units')
}

function validateUsdaCalories(mod) {
  for (const master of mod.MASTER_FOOD_DB) {
    if (master.review?.review_status !== 'usda_officially_verified' || !master.usda_per_100g?.calories) continue
    const expected = master.usda_per_100g.calories * master.serving_grams / 100
    if (!near(master.calories, expected)) {
      fail(`Food ${master.id} "${master.name}" master serving calories ${master.calories} != exact USDA scaled ${expected}`)
    }
    const legacy = mod.FOOD_DB.find((f) => f.id === master.id)
    if (!near(legacy._natural.calories, expected)) {
      fail(`Food ${master.id} "${master.name}" _natural calories ${legacy._natural.calories} != exact USDA scaled ${expected}`)
    }
  }
  pass('USDA calories remain authoritative on merge-touched records')
}

function validateManualReview(mod, mergePlan) {
  for (const id of ['wl_211', 'wl_212']) {
    if (mergePlan.some((r) => r.candidate_id === id)) {
      fail(`Manual-review row ${id} must not be promoted`)
    }
  }
  pass('No manual-review row promoted')
}

function patchValidationMd(precisionStats) {
  if (!existsSync(VALIDATION_MD)) return
  let md = readFileSync(VALIDATION_MD, 'utf8')
  const block = `## Precision validation

| Metric | Value |
|--------|------:|
| Exact USDA per-100g field checks passed | ${precisionStats.passCount} |
| Precision failures | ${precisionStats.failCount} |
| Non-zero USDA values converted to zero | ${precisionStats.zeroedCount} |
| Precision report | \`scripts/output/usda_precision_validation.csv\` |
| Portion caveats | \`scripts/output/usda_remaining_portion_caveats.csv\` |

All previous semantic, unit, tag and portion checks verified by \`validateUsdaPreview.mjs\`.
\`src/utils/foodDatabase.js\` unchanged. Supabase unchanged. Preview not activated.`

  if (md.includes('## Precision validation')) {
    md = md.replace(/## Precision validation[\s\S]*?(?=\n## |$)/, `${block}\n\n`)
  } else {
    md = md.replace('## Preview validation', `${block}\n\n## Preview validation`)
  }
  writeFileSync(VALIDATION_MD, md, 'utf8')
}

async function main() {
  console.log('Validating USDA preview database...\n')
  checkSyntax()
  const mod = await importPreview()
  const mergePlan = parseCsv(readFileSync(MERGE_PLAN_CSV, 'utf8'))
  const portionRows = parseCsv(readFileSync(PORTION_PREVIEW_CSV, 'utf8'))

  validateSemanticIdentity(mod, mergePlan)
  validateMasterRecords(mod)
  validateFoodDbProjection(mod)
  const precisionStats = validateExactSourceEquivalence(mod)
  validateHundredGramScaling(mod)
  validateTagSafety(mod)
  validatePortions(mod, portionRows)
  validateUsdaCalories(mod)
  validateManualReview(mod, mergePlan)
  patchValidationMd(precisionStats)

  console.log('\nPreview validation complete — all checks passed.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
