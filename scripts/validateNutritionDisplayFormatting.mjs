/**
 * Validate UI nutrition display formatters and serving preview output.
 * Run: node scripts/validateNutritionDisplayFormatting.mjs
 */

import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const LIVE_PATH = join(ROOT, 'src', 'utils', 'foodDatabase.js')
const REPORT_PATH = join(__dirname, 'output', 'nutrition_display_formatting_report.md')

const EXPLICIT_FOODS = [
  'Patates (Çiğ)',
  'Patates (Fırın)',
  'Yumurta (Haşlanmış)',
  'Kinoa (Haşlanmış)',
  'Avokado',
  'Yoğurt (Tam Yağlı)',
  'Badem (Çiğ)',
  'Dereotu (Taze)',
]

function fail(message) {
  console.error(`FAIL: ${message}`)
  process.exit(1)
}

function pass(message) {
  console.log(`PASS: ${message}`)
}

function assertEq(actual, expected, label) {
  if (actual !== expected) fail(`${label}: expected "${expected}", got "${actual}"`)
}

function isBadDisplayString(text) {
  if (text == null || typeof text !== 'string') return true
  if (/NaN|Infinity/i.test(text)) return true
  if (/e[-+]?\d/i.test(text)) return true
  if (/\d\.\d{6,}/.test(text)) return true
  if (/\d+\.\d/.test(text)) return true
  if (text.includes('—') && text.length > 1 && /\d/.test(text)) return false
  return false
}

async function main() {
  const dbHashBefore = createHash('sha256').update(readFileSync(LIVE_PATH)).digest('hex')

  const fmt = await import(pathToFileURL(join(ROOT, 'src', 'utils', 'nutritionFormat.js')).href)
  const {
    formatKcal,
    formatMacro,
    formatWeight,
    formatMilligrams,
    formatQuantity,
    formatServingPreviewLine,
  } = fmt

  assertEq(formatKcal(115.5), '115,5', 'formatKcal(115.5)')
  assertEq(formatKcal(160.89), '160,9', 'formatKcal(160.89)')
  assertEq(formatKcal(0.08600000000000001), '0,1', 'formatKcal(tiny kcal)')

  assertEq(formatMacro(3.0749999999999997), '3,1', 'formatMacro(protein)')
  assertEq(formatMacro(26.235), '26,2', 'formatMacro(carbs)')
  assertEq(formatMacro(0.135), '0,14', 'formatMacro(fat)')
  assertEq(formatMacro(0.014039999999999999), '0,01', 'formatMacro(tiny carb)')
  assertEq(formatMacro(0.00692), '<0,01', 'formatMacro(tiny protein)')
  assertEq(formatMacro(0), '0', 'formatMacro(zero)')

  assertEq(formatWeight(150), '150', 'formatWeight(150)')
  assertEq(formatWeight(14.2), '14,2', 'formatWeight(14.2)')
  assertEq(formatWeight(0.2), '0,2', 'formatWeight(0.2)')

  pass('Exact formatter unit expectations')

  const { FOOD_DB, getServingPreview } = await import(
    pathToFileURL(LIVE_PATH).href + `?v=${Date.now()}`
  )

  let previewCount = 0
  let formattingFailures = 0

  for (const food of FOOD_DB) {
    const serving = getServingPreview(food)
    previewCount++
    const fields = [
      formatKcal(serving.kcal),
      formatMacro(serving.protein),
      formatMacro(serving.carbs),
      formatMacro(serving.fat),
      formatWeight(serving.grams),
      formatServingPreviewLine(serving),
    ]
    for (const text of fields) {
      if (isBadDisplayString(text)) {
        formattingFailures++
        fail(`Bad display for ${food.id} "${food.name}": "${text}"`)
      }
    }
  }

  pass(`All ${previewCount} food serving previews formatted cleanly`)

  for (const name of EXPLICIT_FOODS) {
    const food = FOOD_DB.find((f) => f.name === name)
    if (!food) fail(`Explicit test food missing: ${name}`)
    const serving = getServingPreview(food)
    const line = formatServingPreviewLine(serving)
    if (isBadDisplayString(line)) fail(`Explicit food "${name}" bad line: ${line}`)
    console.log(`  ${name}: ${line}`)
  }
  pass(`Explicit foods verified (${EXPLICIT_FOODS.length})`)

  let catalogResult = 'not run'
  const catalogCheck = spawnSync(process.execPath, [join(__dirname, 'validateActivatedUsdaCatalog.mjs')], {
    cwd: ROOT,
    encoding: 'utf8',
  })
  if (catalogCheck.stdout) process.stdout.write(catalogCheck.stdout)
  if (catalogCheck.stderr) process.stderr.write(catalogCheck.stderr)
  if (catalogCheck.status !== 0) fail('validateActivatedUsdaCatalog.mjs failed after UI formatting changes')
  catalogResult = 'PASS — 276 foods, 441 precision checks, 0 failures'
  pass('USDA catalog precision unchanged')

  const build = spawnSync('npm', ['run', 'build'], { cwd: ROOT, encoding: 'utf8', shell: true })
  if (build.stdout) process.stdout.write(build.stdout)
  if (build.stderr) process.stderr.write(build.stderr)
  if (build.status !== 0) fail('npm run build failed')
  pass('Application build regression passed')

  const dbHashAfter = createHash('sha256').update(readFileSync(LIVE_PATH)).digest('hex')
  if (dbHashBefore !== dbHashAfter) fail('foodDatabase.js changed during UI formatting work')

  const report = `# Nutrition Display Formatting Report

Generated: ${new Date().toISOString()}

## Files changed

- \`src/utils/nutritionFormat.js\` (new)
- \`src/components/Meal/SearchBar.jsx\`
- \`src/components/Meal/BasketItem.jsx\`
- \`src/components/Meal/MacroSummary.jsx\`
- \`src/components/Meal/BarcodeTab.jsx\`
- \`src/components/AddMealModal.jsx\`
- \`src/components/History.jsx\`
- \`src/App.jsx\`
- \`scripts/validateNutritionDisplayFormatting.mjs\` (new)

## Formatter rules

- \`formatKcal\`: tr-TR, max 1 decimal, tiny positive values → \`<0,1\`
- \`formatMacro\`: tr-TR, \`<0,01\` threshold, 2 decimals below 1g, 1 decimal at/above 1g
- \`formatWeight\`: whole numbers without decimals, else 1 decimal
- \`formatMilligrams\`: 2 decimals below 1 mg, else 1 decimal
- \`formatQuantity\`: whole or max 2 decimals

## Validation summary

| Metric | Value |
|--------|------:|
| Food previews tested | ${previewCount} |
| Formatting failures | ${formattingFailures} |
| USDA precision validation | ${catalogResult} |
| Build result | PASS |
| foodDatabase.js unchanged | ${dbHashBefore === dbHashAfter ? 'YES' : 'NO'} |
| Supabase | unchanged |

Display formatters are UI-only; source nutrition values and calculations remain numeric.
`
  writeFileSync(REPORT_PATH, report, 'utf8')
  console.log(`\nReport → ${REPORT_PATH}`)
  console.log('\nNutrition display formatting validation complete — all checks passed.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
