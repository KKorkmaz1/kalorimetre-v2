/**
 * Match catalog expansion candidates against USDA-backed nutrition_foods via Supabase RPC.
 * Produces a human review CSV — does not modify FOOD_DB or the candidate list.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = join(__dirname, '..')
const INPUT_CSV = join(__dirname, 'output', 'catalog_expansion_candidates.csv')
const OUTPUT_CSV = join(__dirname, 'output', 'catalog_expansion_usda_review.csv')

const REVIEW_COLUMNS = [
  'candidate_id',
  'name_tr',
  'name_en',
  'category_tr',
  'preferred_source',
  'candidate_portion_label',
  'candidate_portion_grams',
  'candidate_1_food_id',
  'candidate_1_name_tr',
  'candidate_1_name_en',
  'candidate_1_category_tr',
  'candidate_1_calories_100g',
  'candidate_1_protein_100g',
  'candidate_1_carbs_100g',
  'candidate_1_fat_100g',
  'candidate_1_fiber_100g',
  'candidate_1_sugar_100g',
  'candidate_1_score',
  'candidate_2_food_id',
  'candidate_2_name_tr',
  'candidate_2_name_en',
  'candidate_2_category_tr',
  'candidate_2_calories_100g',
  'candidate_2_protein_100g',
  'candidate_2_carbs_100g',
  'candidate_2_fat_100g',
  'candidate_2_fiber_100g',
  'candidate_2_sugar_100g',
  'candidate_2_score',
  'match_status',
  'review_note',
]

const COOKING_STATE_WORDS = [
  'haşlanmış',
  'haslanmis',
  'ızgara',
  'izgara',
  'kızartma',
  'kizartma',
  'fırın',
  'firin',
  'çiğ',
  'cig',
  'kuru',
  'kurutulmuş',
  'kurutulmus',
  'taze',
  'konserve',
  'hazır',
  'hazir',
  'bebek',
  'junior',
  'suda',
  'yağda',
  'yagda',
]

const WRONG_MATCH_INDICATORS = [
  'bebek',
  'junior',
  'konserve',
  'hazır',
  'hazir',
  'çorbası',
  'corbasi',
  'soslu',
  'jambonlu',
  'tahıl gevreği',
  'tahil gevregi',
  'maması',
  'mamasi',
  'filizi',
  'sprouts',
]

const SIMPLE_RAW_CATEGORIES = new Set([
  'meyve',
  'sebze',
  'yumurta',
  'yağlar',
  'kuruyemiş',
  'baklagiller',
  'tahıl / ekmek / makarna',
])

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

function normalizeText(value) {
  return String(value || '')
    .toLocaleLowerCase('tr')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ş/g, 's')
    .replace(/ç/g, 'c')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenize(value) {
  const normalized = normalizeText(value)
  if (!normalized) return []
  return normalized.split(' ').filter((token) => token.length > 1)
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
      name_en: '',
      category_tr: '',
      calories_100g: '',
      protein_100g: '',
      carbs_100g: '',
      fat_100g: '',
      fiber_100g: '',
      sugar_100g: '',
      score: '',
    }
  }

  return {
    food_id: candidate.food_id ?? '',
    name_tr: candidate.name_tr || '',
    name_en: candidate.name_en || '',
    category_tr: candidate.category_tr || candidate.category_name_tr || '',
    calories_100g: formatNumber(candidate.calories_100g),
    protein_100g: formatNumber(candidate.protein_100g),
    carbs_100g: formatNumber(candidate.carbs_100g),
    fat_100g: formatNumber(candidate.fat_100g),
    fiber_100g: formatNumber(candidate.fiber_100g),
    sugar_100g: formatNumber(candidate.sugar_100g),
    score: pickScore(candidate),
  }
}

function tokenOverlapScore(requestTokens, matchText) {
  if (!requestTokens.length) return 0

  const matchTokens = new Set(tokenize(matchText))
  if (!matchTokens.size) return 0

  let overlap = 0
  for (const token of requestTokens) {
    if (matchTokens.has(token)) overlap += 1
  }

  return overlap / requestTokens.length
}

function getRequestTokens(candidate) {
  const parts = [
    candidate.name_tr,
    candidate.name_en,
    candidate.aliases_tr,
  ]
  return [...new Set(parts.flatMap((part) => tokenize(part)))]
}

function getMatchText(match) {
  return [match.name_tr, match.name_en, match.category_tr].filter(Boolean).join(' ')
}

function extractCookingStates(text) {
  const normalized = normalizeText(text)
  return COOKING_STATE_WORDS.filter((word) => normalized.includes(normalizeText(word)))
}

function hasWrongMatchIndicators(candidate, match) {
  const matchText = normalizeText(getMatchText(match))
  const requestText = normalizeText(`${candidate.name_tr} ${candidate.name_en}`)

  for (const indicator of WRONG_MATCH_INDICATORS) {
    const normalizedIndicator = normalizeText(indicator)
    if (matchText.includes(normalizedIndicator) && !requestText.includes(normalizedIndicator)) {
      return true
    }
  }

  return false
}

function hasCookingStateMismatch(candidate, match) {
  const requestStates = extractCookingStates(`${candidate.name_tr} ${candidate.name_en}`)
  const matchStates = extractCookingStates(getMatchText(match))

  if (!requestStates.length || !matchStates.length) return false

  const requestSet = new Set(requestStates.map(normalizeText))
  const matchSet = new Set(matchStates.map(normalizeText))

  for (const state of requestSet) {
    if (!matchSet.has(state)) {
      const conflicting = [...matchSet].some(
        (matchState) => matchState !== state && !requestSet.has(matchState),
      )
      if (conflicting) return true
    }
  }

  return false
}

function isSimpleFood(candidate) {
  const category = normalizeText(candidate.category_tr)
  if (SIMPLE_RAW_CATEGORIES.has(category)) return true

  const name = normalizeText(`${candidate.name_tr} ${candidate.name_en}`)
  const complexHints = ['çorbası', 'corbasi', 'yemeği', 'yemegi', 'salatası', 'salatasi', 'böreği', 'boregi', 'ev yapımı', 'ev yapimi']
  return !complexHints.some((hint) => name.includes(normalizeText(hint)))
}

function classifyMatch(candidate, matches, rpcError) {
  const preferredSource = candidate.preferred_source

  if (preferredSource === 'TURKOMP_OR_RECIPE') {
    return {
      match_status: 'recipe_or_turkomp_needed',
      review_note: 'Turkish/local dish — use TürKomp or recipe-based calculation; USDA matching skipped.',
    }
  }

  if (preferredSource === 'OPEN_FOOD_FACTS') {
    return {
      match_status: 'open_food_facts_needed',
      review_note: 'Packaged/branded product — use Open Food Facts barcode lookup; USDA matching skipped.',
    }
  }

  if (preferredSource === 'MANUAL_REVIEW') {
    return {
      match_status: 'manual_review_needed',
      review_note: 'Uncertain or low-coverage item — requires manual nutrition review; USDA matching skipped.',
    }
  }

  if (rpcError) {
    return {
      match_status: 'no_usda_match',
      review_note: `RPC error: ${rpcError}`,
    }
  }

  const top = matches[0]
  if (!top?.food_id) {
    return {
      match_status: 'no_usda_match',
      review_note: 'No USDA candidates returned from Supabase search.',
    }
  }

  const requestTokens = getRequestTokens(candidate)
  const overlap = Math.max(
    tokenOverlapScore(requestTokens, top.name_tr),
    tokenOverlapScore(requestTokens, top.name_en),
    tokenOverlapScore(requestTokens, getMatchText(top)),
  )

  if (hasWrongMatchIndicators(candidate, top) || overlap < 0.25) {
    return {
      match_status: 'wrong_or_weak_match',
      review_note: 'Top USDA candidate name diverges significantly from requested food.',
    }
  }

  const score = Number(top.score)
  const hasCookingMismatch = hasCookingStateMismatch(candidate, top)
  const simpleFood = isSimpleFood(candidate)

  if (
    simpleFood &&
    !hasCookingMismatch &&
    overlap >= 0.7 &&
    (!Number.isFinite(score) || score >= 0.45)
  ) {
    return {
      match_status: 'verified_candidate',
      review_note: 'Strong USDA alignment for a simple food — suitable for verification after quick review.',
    }
  }

  if (hasCookingMismatch || overlap < 0.55) {
    return {
      match_status: 'likely_match_review_needed',
      review_note: hasCookingMismatch
        ? 'Candidate is close but cooking/preparation state may differ — human review required.'
        : 'Candidate is plausible but not close enough for automatic verification.',
    }
  }

  return {
    match_status: 'likely_match_review_needed',
    review_note: 'Reasonable USDA candidate found — human review recommended before import.',
  }
}

async function searchFoods(supabase, query, language, limit = 10) {
  const q = String(query || '').trim()
  if (q.length < 2) return []

  const { data, error } = await supabase.rpc('search_nutrition_foods', {
    search_query: q,
    search_language: language,
    result_limit: limit,
  })

  if (error) throw error
  return data ?? []
}

function mergeCandidates(primary, secondary) {
  const seen = new Set()
  const merged = []

  for (const candidate of [...primary, ...secondary]) {
    const id = candidate?.food_id
    if (!id || seen.has(id)) continue
    seen.add(id)
    merged.push(candidate)
  }

  return merged
}

function isWeakTrSearch(matches, candidate) {
  if (!matches.length) return true

  const requestTokens = getRequestTokens(candidate)
  const top = mapCandidate(matches[0])
  const overlap = Math.max(
    tokenOverlapScore(requestTokens, top.name_tr),
    tokenOverlapScore(requestTokens, getMatchText(top)),
  )

  return overlap < 0.35
}

async function findUsdaCandidates(supabase, candidate) {
  let rpcError = ''

  try {
    const trResults = await searchFoods(supabase, candidate.name_tr, 'tr', 10)
    let merged = trResults

    if (isWeakTrSearch(trResults, candidate) && candidate.name_en) {
      const enResults = await searchFoods(supabase, candidate.name_en, 'en', 10)
      merged = mergeCandidates(trResults, enResults)
    }

    return { matches: merged, rpcError }
  } catch (error) {
    rpcError = error.message || String(error)
    return { matches: [], rpcError }
  }
}

function buildReviewRow(candidate, matches, classification) {
  const mapped = matches.slice(0, 2).map(mapCandidate)
  const [candidate1, candidate2] = mapped

  return {
    candidate_id: candidate.candidate_id,
    name_tr: candidate.name_tr,
    name_en: candidate.name_en,
    category_tr: candidate.category_tr,
    preferred_source: candidate.preferred_source,
    candidate_portion_label: candidate.default_portion_label_tr,
    candidate_portion_grams: candidate.default_portion_grams,
    candidate_1_food_id: candidate1?.food_id ?? '',
    candidate_1_name_tr: candidate1?.name_tr ?? '',
    candidate_1_name_en: candidate1?.name_en ?? '',
    candidate_1_category_tr: candidate1?.category_tr ?? '',
    candidate_1_calories_100g: candidate1?.calories_100g ?? '',
    candidate_1_protein_100g: candidate1?.protein_100g ?? '',
    candidate_1_carbs_100g: candidate1?.carbs_100g ?? '',
    candidate_1_fat_100g: candidate1?.fat_100g ?? '',
    candidate_1_fiber_100g: candidate1?.fiber_100g ?? '',
    candidate_1_sugar_100g: candidate1?.sugar_100g ?? '',
    candidate_1_score: candidate1?.score ?? '',
    candidate_2_food_id: candidate2?.food_id ?? '',
    candidate_2_name_tr: candidate2?.name_tr ?? '',
    candidate_2_name_en: candidate2?.name_en ?? '',
    candidate_2_category_tr: candidate2?.category_tr ?? '',
    candidate_2_calories_100g: candidate2?.calories_100g ?? '',
    candidate_2_protein_100g: candidate2?.protein_100g ?? '',
    candidate_2_carbs_100g: candidate2?.carbs_100g ?? '',
    candidate_2_fat_100g: candidate2?.fat_100g ?? '',
    candidate_2_fiber_100g: candidate2?.fiber_100g ?? '',
    candidate_2_sugar_100g: candidate2?.sugar_100g ?? '',
    candidate_2_score: candidate2?.score ?? '',
    match_status: classification.match_status,
    review_note: classification.review_note,
  }
}

async function main() {
  if (!existsSync(INPUT_CSV)) {
    throw new Error(`Missing input CSV: ${INPUT_CSV}`)
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
  const candidates = parseCsv(readFileSync(INPUT_CSV, 'utf8'))

  console.log(`Matching ${candidates.length} expansion candidates...`)

  const reviewRows = []
  const statusCounts = {}

  for (const candidate of candidates) {
    let matches = []
    let rpcError = ''

    if (candidate.preferred_source === 'USDA') {
      const result = await findUsdaCandidates(supabase, candidate)
      matches = result.matches
      rpcError = result.rpcError
    }

    const classification = classifyMatch(candidate, matches, rpcError)
    statusCounts[classification.match_status] = (statusCounts[classification.match_status] ?? 0) + 1

    if (rpcError && candidate.preferred_source === 'USDA') {
      console.error(`[${candidate.candidate_id}] RPC error for "${candidate.name_tr}":`, rpcError)
    }

    reviewRows.push(buildReviewRow(candidate, matches, classification))
  }

  const csv = [
    REVIEW_COLUMNS.join(','),
    ...reviewRows.map((row) => toCsvRow(REVIEW_COLUMNS, row)),
  ].join('\n')

  writeFileSync(OUTPUT_CSV, `${csv}\n`, 'utf8')

  console.log(`Wrote review CSV → ${OUTPUT_CSV}`)
  console.log('Match status summary:')
  for (const [status, count] of Object.entries(statusCounts).sort(([a], [b]) => a.localeCompare(b))) {
    console.log(`  ${status}: ${count}`)
  }
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
