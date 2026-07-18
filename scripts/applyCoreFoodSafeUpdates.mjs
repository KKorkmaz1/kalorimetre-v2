/**
 * Apply conservative USDA-safe updates to foodDatabase.js (can_update_from_usda only).
 * Run: node scripts/applyCoreFoodSafeUpdates.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const DB_PATH = join(ROOT, 'src', 'utils', 'foodDatabase.js')
const REPORT_PATH = join(__dirname, 'output', 'core_food_safe_updates_applied.csv')

function round1(n) {
  return Math.round(n * 10) / 10
}

function servingMacros(usda, servingGrams) {
  const m = servingGrams / 100
  const protein = round1(usda.protein * m)
  const carbs = round1(usda.carbs * m)
  const fat = round1(usda.fat * m)
  const calories = Math.round(protein * 4 + carbs * 4 + fat * 9)
  return { calories, protein, carbs, fat }
}

/** @type {Record<number, { fiber?: number|null, sugar?: number|null, sodium?: number|null, note: string, microStatus?: string }>} */
const MICRO_DECISIONS = {
  2: { fiber: null, sugar: null, sodium: null, note: 'USDA lif/şeker/sodyum 0; hayvan ürünü — sodyum eksik veri olabilir, bekletildi.' },
  3: { fiber: 10.1, sugar: 0.99, sodium: 6, note: 'Lif/şeker/sodyum USDA ile güncellendi.', microStatus: 'fiber_sugar_sodium_partial_verified' },
  10: { fiber: null, sugar: null, sodium: 49, note: 'Sodyum USDA ile güncellendi; şeker (laktoz) USDA 0 eksik veri, bekletildi.', microStatus: 'fiber_sugar_sodium_partial_verified' },
  13: { fiber: null, sugar: null, sodium: null, note: 'Bitkisel gıda; USDA lif/şeker 0 eksik veri olabilir, bekletildi.' },
  20: { fiber: null, sugar: null, sodium: null, note: 'Yağ ürünü; lif/şeker/sodyum alanı eklenmedi (0 değerleri anlamlı).' },
  45: { fiber: 2.4, sugar: 10.39, sodium: 1, note: 'Lif/şeker/sodyum USDA ile güncellendi.', microStatus: 'fiber_sugar_sodium_partial_verified' },
  46: { fiber: 2.6, sugar: 12.23, sodium: 1, note: 'Lif/şeker/sodyum USDA ile güncellendi.', microStatus: 'fiber_sugar_sodium_partial_verified' },
  49: { fiber: 2, sugar: null, sodium: 9, note: 'Lif ve sodyum güncellendi; şeker USDA 0 eksik veri (meyve), bekletildi.', microStatus: 'fiber_sugar_sodium_partial_verified' },
  51: { fiber: null, sugar: null, sodium: null, note: 'Bitkisel gıda; USDA lif/şeker 0 eksik veri olabilir, bekletildi.' },
  53: { fiber: null, sugar: null, sodium: null, note: 'Bitkisel gıda; USDA lif/şeker 0 eksik veri olabilir, bekletildi.' },
  55: { fiber: 3.1, sugar: 9.75, sodium: 1, note: 'Lif/şeker/sodyum USDA ile güncellendi.', microStatus: 'fiber_sugar_sodium_partial_verified' },
  67: { fiber: null, sugar: null, sodium: null, note: 'Bitkisel gıda; USDA lif/şeker 0 eksik veri olabilir, bekletildi.' },
  68: { fiber: 2.694, sugar: null, sodium: 62.66, note: 'Lif ve sodyum güncellendi; şeker USDA 0 eksik veri, bekletildi.', microStatus: 'fiber_sugar_sodium_partial_verified' },
  69: { fiber: null, sugar: null, sodium: null, note: 'Bitkisel gıda; USDA lif/şeker 0 eksik veri olabilir, bekletildi.' },
  75: { fiber: null, sugar: null, sodium: null, note: 'USDA lif 0 eksik veri olabilir, bekletildi.' },
  99: { fiber: null, sugar: null, sodium: null, note: 'Ekmek; USDA lif/şeker/sodyum 0 eksik veri olabilir, bekletildi.' },
  130: { fiber: null, sugar: null, sodium: null, note: 'Salamura zeytin; USDA sodyum 0 şüpheli, tüm mikro bekletildi.' },
  173: { fiber: null, sugar: null, sodium: null, note: 'USDA sodyum 0 eksik veri olabilir, bekletildi.' },
}

const UPDATES = [
  { id: 2, name_tr: 'Tavuk Göğsü (Izgara)', source_food_id: '1276', serving_grams: 150, usda: { protein: 30.54, carbs: 0, fat: 3.17 } },
  { id: 3, name_tr: 'Yulaf Ezmesi', source_food_id: '5792', serving_grams: 50, usda: { protein: 13.15, carbs: 67.7, fat: 6.52 } },
  { id: 10, name_tr: 'Tam Yağlı Süt', source_food_id: '5123', serving_grams: 200, usda: { protein: 3.28, carbs: 4.65, fat: 3.66 } },
  { id: 13, name_tr: 'Avokado', source_food_id: '6009', serving_grams: 150, usda: { protein: 2, carbs: 8.53, fat: 14.66 } },
  { id: 20, name_tr: 'Zeytinyağı', source_food_id: '5877', serving_grams: 15, usda: { protein: 0, carbs: 0, fat: 100 } },
  { id: 45, name_tr: 'Elma', source_food_id: '6172', serving_grams: 180, usda: { protein: 0.26, carbs: 13.81, fat: 0.17 } },
  { id: 46, name_tr: 'Muz', source_food_id: '6262', serving_grams: 120, usda: { protein: 1.09, carbs: 22.84, fat: 0.33 } },
  { id: 49, name_tr: 'Portakal', source_food_id: '6308', serving_grams: 150, usda: { protein: 0.91, carbs: 11.8, fat: 0.15 } },
  { id: 51, name_tr: 'Çilek', source_food_id: '6495', serving_grams: 150, usda: { protein: 0.64, carbs: 7.63, fat: 0.22 } },
  { id: 53, name_tr: 'Karpuz', source_food_id: '2640', serving_grams: 200, usda: { protein: 0.61, carbs: 7.55, fat: 0.15 } },
  { id: 55, name_tr: 'Armut', source_food_id: '6001', serving_grams: 170, usda: { protein: 0.36, carbs: 15.23, fat: 0.14 } },
  { id: 67, name_tr: 'Marul', source_food_id: '6163', serving_grams: 100, usda: { protein: 0.7425, carbs: 3.3687, fat: 0.0737 } },
  { id: 68, name_tr: 'Havuç', source_food_id: '6153', serving_grams: 60, usda: { protein: 0.805, carbs: 9.0787, fat: 0.1375 } },
  { id: 69, name_tr: 'Brokoli (Haşlanmış)', source_food_id: '2339', serving_grams: 150, usda: { protein: 2.38, carbs: 7.18, fat: 0.41 } },
  { id: 75, name_tr: 'Mantar (Beyaz)', source_food_id: '588', serving_grams: 100, usda: { protein: 3.09, carbs: 3.26, fat: 0.34 } },
  { id: 99, name_tr: 'Beyaz Ekmek', source_food_id: '532', serving_grams: 30, usda: { protein: 9.43, carbs: 49.2, fat: 3.59 } },
  { id: 130, name_tr: 'Zeytin (Siyah)', source_food_id: '4854', serving_grams: 35, usda: { protein: 0.84, carbs: 6.04, fat: 10.9 } },
  { id: 173, name_tr: 'Yumurta (Çiğ)', source_food_id: '6041', serving_grams: 50, usda: { protein: 12.56, carbs: 0.72, fat: 9.51 } },
]

function escapeCsv(val) {
  const s = String(val ?? '')
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
}

function patchEntryBlock(block, update, macros, micro) {
  let out = block

  out = out.replace(/calories:\s*[\d.]+/, `calories: ${macros.calories}`)
  out = out.replace(/protein:\s*[\d.]+/, `protein: ${macros.protein}`)
  out = out.replace(/carbs:\s*[\d.]+/, `carbs: ${macros.carbs}`)
  out = out.replace(/fat:\s*[\d.]+/, `fat: ${macros.fat}`)

  // Remove existing micronutrient fields if re-running
  out = out.replace(/\n\s*fiber_100g:\s*[\d.]+,?/g, '')
  out = out.replace(/\n\s*sugar_100g:\s*[\d.]+,?/g, '')
  out = out.replace(/\n\s*sodium_mg_100g:\s*[\d.]+,?/g, '')

  const microLines = []
  if (micro.fiber != null) microLines.push(`    fiber_100g: ${micro.fiber},`)
  if (micro.sugar != null) microLines.push(`    sugar_100g: ${micro.sugar},`)
  if (micro.sodium != null) microLines.push(`    sodium_mg_100g: ${micro.sodium},`)

  if (microLines.length) {
    out = out.replace(/(fat:\s*[\d.]+,)/, `$1\n${microLines.join('\n')}`)
  }

  const reviewNote = `Makrolar USDA ile güncellendi (2026-07-14). ${micro.note}`
  const microStatusLine = micro.microStatus
    ? `\n      micronutrient_basic_status: '${micro.microStatus}',`
    : ''

  const reviewBlock = `review: {
      source_type: 'USDA',
      source_name: 'USDA FoodData Central',
      source_food_id: '${update.source_food_id}',
      review_status: 'macro_verified_usda',${microStatusLine}
      notes: '${reviewNote.replace(/'/g, "\\'")}',
    }`

  out = out.replace(/review:\s*\{[\s\S]*?\n\s*\},/, reviewBlock)
  return out
}

let src = readFileSync(DB_PATH, 'utf8')
const reportRows = []

for (const update of UPDATES) {
  const micro = MICRO_DECISIONS[update.id]
  const macros = servingMacros(update.usda, update.serving_grams)

  const entryRe = new RegExp(
    `(\\{\\s*\\n\\s*id:\\s*${update.id},[\\s\\S]*?\\n\\s*\\},)(?=\\s*\\n\\s*\\{|\\s*\\n\\])`,
    'm',
  )
  const match = src.match(entryRe)
  if (!match) throw new Error(`Entry id=${update.id} not found`)

  src = src.replace(match[1], patchEntryBlock(match[1], update, macros, micro))

  reportRows.push({
    food_id: update.id,
    name_tr: update.name_tr,
    updated_calories: macros.calories,
    updated_protein: macros.protein,
    updated_carbs: macros.carbs,
    updated_fat: macros.fat,
    updated_fiber: micro.fiber ?? '',
    updated_sugar: micro.sugar ?? '',
    updated_sodium: micro.sodium ?? '',
    fiber_sugar_sodium_note: micro.note,
    review_status: 'macro_verified_usda',
    source_food_id: update.source_food_id,
    action_taken: 'macro_update_usda' + (micro.microStatus ? '+micronutrient_partial' : ''),
  })
}

writeFileSync(DB_PATH, src, 'utf8')

mkdirSync(dirname(REPORT_PATH), { recursive: true })
const headers = [
  'food_id', 'name_tr', 'updated_calories', 'updated_protein', 'updated_carbs', 'updated_fat',
  'updated_fiber', 'updated_sugar', 'updated_sodium', 'fiber_sugar_sodium_note',
  'review_status', 'source_food_id', 'action_taken',
]
const csv = [
  headers.join(','),
  ...reportRows.map((r) => headers.map((h) => escapeCsv(r[h])).join(',')),
].join('\n')
writeFileSync(REPORT_PATH, csv + '\n', 'utf8')

console.log(`Updated ${UPDATES.length} foods in foodDatabase.js`)
console.log(`Report: ${REPORT_PATH}`)
