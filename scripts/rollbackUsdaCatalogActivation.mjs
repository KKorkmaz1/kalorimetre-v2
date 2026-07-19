/**
 * Restore pre-USDA activation food catalog backup.
 * Run: node scripts/rollbackUsdaCatalogActivation.mjs
 */

import { copyFileSync, existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const BACKUP_PATH = join(__dirname, 'backups', 'foodDatabase.pre-usda-activation.js')
const LIVE_PATH = join(ROOT, 'src', 'utils', 'foodDatabase.js')

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

function fail(message) {
  console.error(`ROLLBACK FAILED: ${message}`)
  process.exit(1)
}

function main() {
  if (!existsSync(BACKUP_PATH)) {
    fail(`Backup not found: ${BACKUP_PATH}`)
  }

  if (existsSync(LIVE_PATH)) {
    const liveBytes = readFileSync(LIVE_PATH)
    const backupBytes = readFileSync(BACKUP_PATH)
    if (liveBytes.equals(backupBytes)) {
      console.log('Live catalog already matches backup — nothing to restore.')
    } else {
      const stamped = join(__dirname, 'backups', `foodDatabase.pre-rollback-${timestamp()}.js`)
      copyFileSync(LIVE_PATH, stamped)
      console.log(`Saved current live file before rollback → ${stamped}`)
      copyFileSync(BACKUP_PATH, LIVE_PATH)
      console.log(`Restored backup → ${LIVE_PATH}`)
    }
  } else {
    copyFileSync(BACKUP_PATH, LIVE_PATH)
    console.log(`Restored backup → ${LIVE_PATH}`)
  }

  console.log('\nRunning npm run build...')
  const build = spawnSync('npm', ['run', 'build'], { cwd: ROOT, encoding: 'utf8', shell: true })
  if (build.stdout) process.stdout.write(build.stdout)
  if (build.stderr) process.stderr.write(build.stderr)

  if (build.status !== 0) {
    fail(`npm run build exited with code ${build.status}`)
  }

  console.log('\nRollback succeeded — live catalog restored and build passed.')
}

main()
