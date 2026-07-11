/**
 * Match catalog seed foods against USDA-backed nutrition_foods via Supabase RPC.
 * Produces a human review CSV — does not modify the catalog seed.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = join(__dirname, '..')
const INPUT_CSV = join(__dirname, 'output', 'nutrition_catalog_foods_seed.csv')
const OUTPUT_CSV = join(__dirname, 'output', 'nutrition_catalog_usda_match_review.csv')

const REVIEW_COLUMNS = [
  'catalog_food_id',
  'name_tr',
  'current_calories_100g',
  'current_protein_100g',
  'current_carbs_100g',
  'current_fat_100g',
  'candidate_1_food_id',
  'candidate_1_name_tr',
  'candidate_1_calories_100g',
  'candidate_1_protein_100g',
  'candidate_1_carbs_100g',
  'candidate_1_fat_100g',
  'candidate_1_score',
  'candidate_2_food_id',
  'candidate_2_name_tr',
  'candidate_2_calories_100g',
  'candidate_2_protein_100g',
  'candidate_2_carbs_100g',
  'candidate_2_fat_100g',
  'candidate_2_score',
  'review_note',
]

function loadEnvFile(path) {
  if (!existsSync(path)) return {}

  return readFileSync(path, 'utf8')
    .split(/\r?\n/)
    .reduce((env, line) => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) return env

      const eqIndex = trimmed.indexOf('=')
      if (eqIndex === -1) return env

      const key = trimmed.slice(0, eqIndex).trim()
      let value = trimmed.slice(eqIndex + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }

      env[key] = value
      return env
    }, {})
}

function csvCell(value) {
  if (value === null || value === undefined) return ''
  const text = String(value)
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

function toCsvRow(columns, row) {
  return columns.map((col) => csvCell(row[col])).join(',')
}

function parseCsv(content) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i]
    const next = content[i + 1]

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"'
        i += 1
      } else if (char === '"') {
        inQuotes = false
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (char === '\r') {
      // ignore
    } else {
      field += char
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  if (!rows.length) return []

  const headers = rows[0]
  return rows.slice(1).filter((cells) => cells.some((cell) => cell !== '')).map((cells) => {
    const record = {}
    headers.forEach((header, index) => {
      record[header] = cells[index] ?? ''
    })
    return record
  })
}

function formatNumber(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) return ''
  return String(Number(num.toFixed(4)))
}

function pickScore(candidate) {
  return (
    candidate?.search_score ??
    candidate?.score ??
    candidate?.rank ??
    candidate?.similarity ??
    ''
  )
}

function mapCandidate(candidate) {
  if (!candidate) {
    return {
      food_id: '',
      name_tr: '',
      calories_100g: '',
      protein_100g: '',
      carbs_100g: '',
      fat_100g: '',
      score: '',
    }
  }

  return {
    food_id: candidate.food_id ?? '',
    name_tr: candidate.name_tr || candidate.name_en || '',
    calories_100g: formatNumber(candidate.calories_100g),
    protein_100g: formatNumber(candidate.protein_100g),
    carbs_100g: formatNumber(candidate.carbs_100g),
    fat_100g: formatNumber(candidate.fat_100g),
    score: pickScore(candidate),
  }
}

async function main() {
  if (!existsSync(INPUT_CSV)) {
    throw new Error(`Missing input CSV. Run export:catalog first: ${INPUT_CSV}`)
  }

  const env = {
    ...loadEnvFile(join(ROOT_DIR, '.env')),
    ...process.env,
  }

  const supabaseUrl = env.VITE_SUPABASE_URL
  const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env')
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey)
  const catalogFoods = parseCsv(readFileSync(INPUT_CSV, 'utf8'))

  console.log(`Matching ${catalogFoods.length} catalog foods against USDA candidates...`)

  const reviewRows = []

  for (const food of catalogFoods) {
    const { data, error } = await supabase.rpc('search_nutrition_foods', {
      search_query: food.name_tr,
      search_language: 'tr',
      result_limit: 5,
    })

    if (error) {
      console.error(`[${food.catalog_food_id}] RPC error for "${food.name_tr}":`, error.message)
    }

    const candidates = (data ?? []).slice(0, 2).map(mapCandidate)
    const [candidate1, candidate2] = candidates

    reviewRows.push({
      catalog_food_id: food.catalog_food_id,
      name_tr: food.name_tr,
      current_calories_100g: formatNumber(food.calories_100g),
      current_protein_100g: formatNumber(food.protein_100g),
      current_carbs_100g: formatNumber(food.carbs_100g),
      current_fat_100g: formatNumber(food.fat_100g),
      candidate_1_food_id: candidate1?.food_id ?? '',
      candidate_1_name_tr: candidate1?.name_tr ?? '',
      candidate_1_calories_100g: candidate1?.calories_100g ?? '',
      candidate_1_protein_100g: candidate1?.protein_100g ?? '',
      candidate_1_carbs_100g: candidate1?.carbs_100g ?? '',
      candidate_1_fat_100g: candidate1?.fat_100g ?? '',
      candidate_1_score: candidate1?.score ?? '',
      candidate_2_food_id: candidate2?.food_id ?? '',
      candidate_2_name_tr: candidate2?.name_tr ?? '',
      candidate_2_calories_100g: candidate2?.calories_100g ?? '',
      candidate_2_protein_100g: candidate2?.protein_100g ?? '',
      candidate_2_carbs_100g: candidate2?.carbs_100g ?? '',
      candidate_2_fat_100g: candidate2?.fat_100g ?? '',
      candidate_2_score: candidate2?.score ?? '',
      review_note: error ? `RPC error: ${error.message}` : '',
    })
  }

  const csv = [
    REVIEW_COLUMNS.join(','),
    ...reviewRows.map((row) => toCsvRow(REVIEW_COLUMNS, row)),
  ].join('\n')

  writeFileSync(OUTPUT_CSV, `${csv}\n`, 'utf8')
  console.log(`Wrote review CSV → ${OUTPUT_CSV}`)
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
