/**
 * Validate activated live food catalog at src/utils/foodDatabase.js
 * Run: node scripts/validateActivatedUsdaCatalog.mjs
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const LIVE_PATH = join(ROOT, 'src', 'utils', 'foodDatabase.js')
const BACKUP_PATH = join(__dirname, 'backups', 'foodDatabase.pre-usda-activation.js')

const PRECISION_TOLERANCE = 0.000001
const ORIGINAL_COUNT = 240
const EXPECTED_TOTAL = 276
const EXPECTED_NEW = 36

function fail(message) {
  console.error(`FAIL: ${message}`)
  process.exit(1)
}

function pass(message) {
  console.log(`PASS: ${message}`)
}

function exactEqual(a, b) {
  if (a == null && b == null) return true
  if (a == null || b == null) return false
  return Math.abs(a - b) <= PRECISION_TOLERANCE
}

function isDairyFood(food) {
  const text = `${food.name} ${food.category || ''}`.toLocaleLowerCase('tr-TR')
  return food.category === 'Süt Ürünleri' || /süt|yoğurt|peynir|tereya|cheese|milk|yogurt|butter|kaymak|krema/.test(text)
}

function isNutFood(food) {
  const text = `${food.name} ${food.category || ''}`.toLocaleLowerCase('tr-TR')
  return (
    food.category === 'Kuruyemiş' ||
    /kaju|badem|fıstık|ceviz|fındık|nut|cashew|chia|tohum|seed/.test(text)
  )
}

async function importModule(path) {
  return import(pathToFileURL(path).href + `?t=${Date.now()}`)
}

async function main() {
  console.log('Validating activated live catalog...\n')

  const syntax = spawnSync(process.execPath, ['--check', LIVE_PATH], { encoding: 'utf8' })
  if (syntax.status !== 0) fail(`Syntax invalid\n${syntax.stderr || syntax.stdout}`)
  pass('Live file JavaScript syntax valid')

  const backupMod = await importModule(BACKUP_PATH)
  const liveMod = await importModule(LIVE_PATH)
  const { MASTER_FOOD_DB, FOOD_DB, toLegacyFood } = liveMod

  if (!MASTER_FOOD_DB?.length) fail('MASTER_FOOD_DB missing')
  if (!FOOD_DB?.length) fail('FOOD_DB missing')
  if (MASTER_FOOD_DB.length !== EXPECTED_TOTAL) fail(`MASTER count ${MASTER_FOOD_DB.length} != ${EXPECTED_TOTAL}`)
  if (FOOD_DB.length !== EXPECTED_TOTAL) fail(`FOOD_DB count ${FOOD_DB.length} != ${EXPECTED_TOTAL}`)
  pass(`MASTER_FOOD_DB count = ${EXPECTED_TOTAL}`)
  pass(`FOOD_DB count = ${EXPECTED_TOTAL}`)

  const backupIds = new Set(backupMod.MASTER_FOOD_DB.map((f) => f.id))
  const liveIds = new Set(MASTER_FOOD_DB.map((f) => f.id))
  for (const id of backupIds) {
    if (!liveIds.has(id)) fail(`Original id ${id} missing from activated catalog`)
  }
  pass(`${ORIGINAL_COUNT} original IDs remain represented`)

  const newIds = MASTER_FOOD_DB.filter((f) => !backupIds.has(f.id))
  if (newIds.length !== EXPECTED_NEW) fail(`Expected ${EXPECTED_NEW} new IDs, found ${newIds.length}`)
  pass(`${EXPECTED_NEW} new IDs present (${newIds.map((f) => f.id).join(', ')})`)

  const ids = new Set()
  const slugs = new Set()
  const names = new Set()
  let precisionPass = 0
  let precisionFail = 0
  let zeroed = 0

  for (const master of MASTER_FOOD_DB) {
    if (ids.has(master.id)) fail(`Duplicate id ${master.id}`)
    ids.add(master.id)
    if (slugs.has(master.slug)) fail(`Duplicate slug ${master.slug}`)
    slugs.add(master.slug)
    if (names.has(master.name)) fail(`Duplicate name ${master.name}`)
    names.add(master.name)

    const legacy = FOOD_DB.find((f) => f.id === master.id)
    if (!legacy) fail(`Missing FOOD_DB row for id ${master.id}`)

    if (legacy.units?.Gram !== 0.01) fail(`id ${master.id} units.Gram != 0.01`)

    for (const key of ['fiber_100g', 'sugar_100g', 'sodium_mg_100g', 'fiber', 'sugar', 'sodium_mg']) {
      const val = legacy[key]
      if (val !== null && val !== undefined && typeof val !== 'number') {
        fail(`id ${master.id} ${key} must be number or null`)
      }
    }

    if (master.fiber_100g == null && legacy.fiber != null) fail(`id ${master.id} fiber must stay null`)
    if (master.sugar_100g == null && legacy.sugar != null) fail(`id ${master.id} sugar must stay null`)
    if (master.sodium_mg_100g == null && legacy.sodium_mg != null) fail(`id ${master.id} sodium must stay null`)

    const processed = toLegacyFood(master)
    if (!processed?._natural) fail(`toLegacyFood failed for id ${master.id}`)

    if (master.portions?.length) {
      for (const portion of master.portions) {
        if (!portion.label || !Number.isFinite(portion.grams) || portion.grams <= 0) {
          fail(`id ${master.id} invalid portion entry`)
        }
      }
    }

    if (master.review?.review_status === 'usda_officially_verified') {
      if (!master.review?.source_food_id) fail(`USDA food ${master.id} missing FDC ID`)
      if (!master.usda_per_100g) fail(`USDA food ${master.id} missing usda_per_100g`)

      for (const field of ['calories', 'protein', 'carbs', 'fat']) {
        const official = master.usda_per_100g[field]
        const actual = legacy[field]
        if (exactEqual(actual, official)) precisionPass++
        else {
          precisionFail++
          fail(`Precision ${master.name} ${field}: FOOD_DB=${actual} USDA=${official}`)
        }
        if (official != null && official !== 0 && actual === 0) zeroed++
      }

      const microMap = { fiber_100g: 'fiber', sugar_100g: 'sugar', sodium_mg_100g: 'sodium_mg' }
      for (const [legacyField, sourceKey] of Object.entries(microMap)) {
        const official = master.usda_per_100g[sourceKey]
        const actual = legacy[legacyField]
        if (!exactEqual(actual, official)) {
          precisionFail++
          fail(`Precision ${master.name} ${legacyField}: FOOD_DB=${actual} USDA=${official}`)
        }
        precisionPass++
        if (official != null && official !== 0 && actual === 0) zeroed++
      }
    }
  }

  pass('All IDs, slugs and exact display names unique')
  pass('units.Gram = 0.01 for every record')
  pass('Fiber/sugar/sodium are number or null; nulls preserved')
  pass(`Exact USDA per-100g equivalence (${precisionPass} field checks)`)
  pass(`Precision failures: ${precisionFail}`)
  pass(`Non-zero USDA values converted to zero: ${zeroed}`)

  const kizilcik = MASTER_FOOD_DB.find(
    (f) => f.review?.source_food_id === '171722' || (f.name === 'Kızılcık' && f.review?.source_type === 'USDA')
  )
  if (kizilcik) fail('Kızılcık must not use cranberry FDC 171722')
  pass('Kızılcık not imported with FDC 171722')

  const celery = MASTER_FOOD_DB.filter((f) => f.review?.source_food_id === '2346405')
  if (celery.length !== 1 || celery[0].name !== 'Kereviz Sapı (Çiğ)') {
    fail('FDC 2346405 must exist only as Kereviz Sapı (Çiğ)')
  }
  pass('FDC 2346405 only as Kereviz Sapı (Çiğ)')

  const backup155 = backupMod.MASTER_FOOD_DB.find((f) => f.id === 155)
  const live155 = MASTER_FOOD_DB.find((f) => f.id === 155)
  const compareKeys = ['name', 'slug', 'calories', 'protein', 'carbs', 'fat', 'serving_size', 'serving_grams']
  for (const key of compareKeys) {
    if (live155[key] !== backup155[key]) fail(`Kereviz id 155 changed ${key}`)
  }
  if (live155.review?.source_type === 'USDA') fail('Kereviz id 155 must not be USDA-updated')
  pass('Kereviz id 155 unchanged from pre-activation backup')

  const tereyagi = MASTER_FOOD_DB.find((f) => f.name === 'Tereyağı (Tuzsuz)')
  if (!tereyagi) fail('Tereyağı (Tuzsuz) missing')
  if (tereyagi.tags?.includes('Vegan') || tereyagi.tags?.includes('Laktozsuz')) {
    fail('Tereyağı (Tuzsuz) must not be Vegan or Laktozsuz')
  }
  pass('Tereyağı (Tuzsuz) tag safety')

  for (const food of MASTER_FOOD_DB.filter((f) => /bulgur/i.test(f.name) && f.review?.source_type === 'USDA')) {
    if (food.tags?.includes('Glutensiz')) fail(`${food.name} must not be Glutensiz`)
  }
  pass('Bulgur USDA records not Glutensiz')

  for (const food of MASTER_FOOD_DB.filter((f) => f.review?.review_status === 'usda_officially_verified')) {
    if (isDairyFood(food) && food.tags?.includes('Vegan')) fail(`${food.name} dairy must not be Vegan`)
    if (isNutFood(food) && food.tags?.includes('Kuruyemişsiz')) fail(`${food.name} nut must not be Kuruyemişsiz`)
  }
  pass('Dairy/nut tag safety on USDA records')

  pass(`toLegacyFood processed all ${MASTER_FOOD_DB.length} records`)

  console.log('\nActivated catalog validation complete — all checks passed.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
