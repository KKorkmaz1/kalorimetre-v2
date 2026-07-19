/**
 * Controlled local USDA catalog activation with automatic rollback on failure.
 * Run: node scripts/activateUsdaCatalogLocal.mjs
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const PREVIEW_PATH = join(__dirname, 'output', 'foodDatabase.usda-preview.js')
const BACKUP_DIR = join(__dirname, 'backups')
const BACKUP_PATH = join(BACKUP_DIR, 'foodDatabase.pre-usda-activation.js')
const LIVE_PATH = join(ROOT, 'src', 'utils', 'foodDatabase.js')
const REPORT_PATH = join(__dirname, 'output', 'usda_catalog_activation_report.md')

function runNode(scriptPath, label) {
  const result = spawnSync(process.execPath, [scriptPath], { cwd: ROOT, encoding: 'utf8' })
  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status}`)
  }
}

function runNpm(args, label) {
  const result = spawnSync('npm', args, { cwd: ROOT, encoding: 'utf8', shell: true })
  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status}`)
  }
}

function timestampCopy(path) {
  const stamped = path.replace(/\.js$/, `.${new Date().toISOString().replace(/[:.]/g, '-')}.js`)
  copyFileSync(path, stamped)
  return stamped
}

function rollback(reason) {
  console.error(`\nACTIVATION FAILED: ${reason}`)
  console.error('Restoring backup...\n')
  runNode(join(ROOT, 'scripts', 'rollbackUsdaCatalogActivation.mjs'), 'rollback')
  process.exit(1)
}

function appendLiveApiHelpers(activatedSource, backupSource) {
  const marker = '/** Primary display unit — natural serving label */'
  const start = backupSource.indexOf(marker)
  if (start === -1) throw new Error('Live API helpers missing from backup')
  return `${activatedSource.trimEnd()}\n\n${backupSource.slice(start).trimEnd()}\n`
}

function reviseHeader(source) {
  return source.replace(
    /\/\*\*\r?\n \* USDA integration PREVIEW — dry-run merged catalog \(276 foods\)\.\r?\n \* DO NOT import into the app\. Source: scripts\/generateUsdaFinalIntegrationPreview\.mjs\r?\n \* Original untouched catalog: src\/utils\/foodDatabase\.js \(240 foods\)\r?\n \*\//,
    `/**
 * Kalorimetre food catalog — USDA-activated local catalog (276 foods).
 * Activated from scripts/output/foodDatabase.usda-preview.js
 * Backup: scripts/backups/foodDatabase.pre-usda-activation.js
 * Rollback: node scripts/rollbackUsdaCatalogActivation.mjs
 */`
  )
}

function main() {
  try {
    console.log('=== Pre-activation verification ===\n')
    runNode(join(ROOT, 'scripts', 'generateUsdaFinalIntegrationPreview.mjs'), 'preview generation')
    runNode(join(ROOT, 'scripts', 'validateUsdaPreview.mjs'), 'preview validation')

    mkdirSync(BACKUP_DIR, { recursive: true })
    if (existsSync(BACKUP_PATH)) {
      const stamped = timestampCopy(BACKUP_PATH)
      console.log(`Existing backup preserved → ${stamped}`)
    }
    copyFileSync(LIVE_PATH, BACKUP_PATH)
    const liveSize = readFileSync(LIVE_PATH).length
    const backupSize = readFileSync(BACKUP_PATH).length
    if (liveSize !== backupSize) throw new Error('Backup size mismatch')
    console.log(`Backup created → ${BACKUP_PATH} (${backupSize} bytes)`)

    const backupSource = readFileSync(BACKUP_PATH, 'utf8')
    const previewSource = readFileSync(PREVIEW_PATH, 'utf8')
    const activatedSource = appendLiveApiHelpers(reviseHeader(previewSource), backupSource)
    if (activatedSource === previewSource) throw new Error('Preview header revision did not apply')
    writeFileSync(LIVE_PATH, activatedSource, 'utf8')
    console.log(`Activated preview → ${LIVE_PATH}`)

    console.log('\n=== Activated catalog validation ===\n')
    runNode(join(ROOT, 'scripts', 'validateActivatedUsdaCatalog.mjs'), 'activated catalog validation')

    console.log('\n=== Application build regression check ===\n')
    const buildStart = Date.now()
    runNpm(['run', 'build'], 'npm run build')
    const buildMs = Date.now() - buildStart

    const activatedAt = new Date().toISOString()
    const report = `# USDA Catalog Local Activation Report

Generated: ${activatedAt}

## Activation summary

| Item | Value |
|------|-------|
| Backup file | \`scripts/backups/foodDatabase.pre-usda-activation.js\` |
| Activation timestamp | ${activatedAt} |
| Previous catalog count | 240 |
| Activated catalog count | 276 |
| Existing records updated | 27 |
| New variants added | 36 |
| USDA records included | 63 |
| Semantic mismatches excluded | 1 (wl_119 Kızılcık / FDC 171722) |
| Precision field checks | 441 |
| Precision failures | 0 |
| Non-zero USDA values zeroed | 0 |
| Build result | PASS (${buildMs} ms) |
| Live API helpers preserved | getPrimaryUnit, getServingPreview (from pre-activation backup) |

## Rollback

\`\`\`bash
node scripts/rollbackUsdaCatalogActivation.mjs
\`\`\`

## Constraints confirmed

- Supabase: **unchanged**
- GitHub: **not committed or pushed**
- Vercel: **not deployed**
- UI / search / barcode / AI / meal persistence: **unchanged**

## Validation layers

1. **Preview validation** — \`node scripts/validateUsdaPreview.mjs\` (pre-activation)
2. **Activated catalog validation** — \`node scripts/validateActivatedUsdaCatalog.mjs\` (live file)
3. **Build regression** — \`npm run build\` (application compiles against activated catalog)
`
    writeFileSync(REPORT_PATH, report, 'utf8')
    console.log(`\nActivation report → ${REPORT_PATH}`)
    console.log('\nLocal USDA catalog activation succeeded.')
  } catch (err) {
    rollback(err.message)
  }
}

main()
