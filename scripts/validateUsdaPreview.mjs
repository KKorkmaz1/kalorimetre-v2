/**
 * Standalone validation for foodDatabase.usda-preview.js
 * Run: node scripts/validateUsdaPreview.mjs
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PREVIEW_PATH = join(__dirname, 'output', 'foodDatabase.usda-preview.js')

function fail(message) {
  console.error(`FAIL: ${message}`)
  process.exit(1)
}

function pass(message) {
  console.log(`PASS: ${message}`)
}

function checkSyntax() {
  const source = readFileSync(PREVIEW_PATH, 'utf8')
  const syntax = spawnSync(process.execPath, ['--check', PREVIEW_PATH], { encoding: 'utf8' })
  if (syntax.status !== 0) {
    fail(`JavaScript syntax invalid\n${syntax.stderr || syntax.stdout}`)
  }
  pass('JavaScript syntax valid (--check)')
  return source
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
  pass(`Imported preview module (${mod.MASTER_FOOD_DB.length} master foods)`)
  return mod
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
    }

    const legacy = toLegacyFood(food)
    if (!legacy || !legacy._natural) fail(`toLegacyFood failed for id ${food.id}`)
    if (!legacy.units?.Gram) fail(`toLegacyFood missing Gram unit for id ${food.id}`)
    if (!Number.isFinite(legacy.calories)) fail(`Legacy calories invalid for id ${food.id}`)
  }

  pass('All master records have valid serving_size / serving_grams')
  pass('All master IDs, slugs, and display names are unique')
  pass(`toLegacyFood processed all ${MASTER_FOOD_DB.length} records`)
}

function validateFoodDbProjection(mod) {
  if (mod.FOOD_DB.length !== mod.MASTER_FOOD_DB.length) {
    fail(`FOOD_DB length ${mod.FOOD_DB.length} != MASTER_FOOD_DB length ${mod.MASTER_FOOD_DB.length}`)
  }
  pass('FOOD_DB projection length matches MASTER_FOOD_DB')
}

async function main() {
  console.log('Validating USDA preview database...\n')
  checkSyntax()
  const mod = await importPreview()
  validateMasterRecords(mod)
  validateFoodDbProjection(mod)
  console.log('\nPreview validation complete — all checks passed.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
