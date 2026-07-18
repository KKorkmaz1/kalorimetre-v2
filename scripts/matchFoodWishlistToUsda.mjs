/**
 * Match food wishlist candidates against USDA-backed nutrition_foods via Supabase RPC.
 * Reads names/metadata only — produces a human review CSV; does not modify foodDatabase.js.
 *
 * Run: node scripts/matchFoodWishlistToUsda.mjs
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = join(__dirname, '..')
const INPUT_CSV = join(__dirname, 'output', 'food_wishlist_400_candidates.csv')
const OUTPUT_CSV = join(__dirname, 'output', 'food_wishlist_usda_match_review.csv')

const REVIEW_COLUMNS = [
  'candidate_id',
  'name_tr',
  'name_en',
  'target_state',
  'preferred_source',
  'candidate_1_food_id',
  'candidate_1_name_en',
  'candidate_1_name_tr',
  'candidate_1_category',
  'candidate_1_calories_100g',
  'candidate_1_protein_100g',
  'candidate_1_carbs_100g',
  'candidate_1_fat_100g',
  'candidate_1_fiber_100g',
  'candidate_1_sugar_100g',
  'candidate_1_sodium_mg_100g',
  'candidate_1_score',
  'candidate_2_food_id',
  'candidate_2_name_en',
  'candidate_2_name_tr',
  'candidate_2_category',
  'candidate_2_calories_100g',
  'candidate_2_protein_100g',
  'candidate_2_carbs_100g',
  'candidate_2_fat_100g',
  'candidate_2_fiber_100g',
  'candidate_2_sugar_100g',
  'candidate_2_sodium_mg_100g',
  'candidate_2_score',
  'candidate_3_food_id',
  'candidate_3_name_en',
  'candidate_3_name_tr',
  'candidate_3_category',
  'candidate_3_calories_100g',
  'candidate_3_protein_100g',
  'candidate_3_carbs_100g',
  'candidate_3_fat_100g',
  'candidate_3_fiber_100g',
  'candidate_3_sugar_100g',
  'candidate_3_sodium_mg_100g',
  'candidate_3_score',
  'match_status',
  'review_note',
]

const REJECT_INDICATORS = [
  'baby', 'bebek', 'junior', 'infant', 'toddler',
  'formula', 'mamasi', 'maması',
  'sauce', 'sos', 'soslu', 'dressing',
  'mix', 'karisim', 'karışım', 'prepared mix',
  'cereal bar', 'tahil gevregi', 'tahıl gevreği',
  'snack bar', 'candy', 'seker kapli', 'şeker kaplı',
  'frozen meal', 'hazir yemek', 'hazır yemek',
  'restaurant', 'fast food', 'mcdonald',
  'supplement', 'protein powder',
  'babyfood', 'baby food',
]

const STATE_PATTERNS = {
  raw: ['raw', 'cig', 'fresh', 'taze', 'uncooked'],
  cooked: ['cooked', 'pismis', 'pişmiş', 'prepared'],
  boiled: ['boiled', 'haslanmis', 'haşlanmış', 'simmered'],
  grilled: ['grilled', 'izgara', 'broiled'],
  baked: ['baked', 'roasted', 'firin', 'fırın', 'oven'],
  fried: ['fried', 'kizartma', 'kızartma', 'pan fried'],
  dried: ['dried', 'kuru', 'dehydrated'],
  roasted: ['roasted', 'kavrulmus', 'kavrulmuş', 'dry roasted'],
  'whole milk': ['whole milk', 'tam yagli', 'tam yağlı', 'full fat milk'],
  'skim milk': ['skim', 'nonfat', 'fat free', 'yagsiz', 'yağsız', 'skimmed'],
  'reduced fat': ['reduced fat', 'low fat', '2% milk', 'yarim yagli', 'yarım yağlı', '1% milk'],
  unsweetened: ['unsweetened', 'sekersiz', 'şekersiz', 'no sugar added'],
  plain: ['plain', 'sade', 'unflavored', 'unflavoured'],
  frozen: ['frozen', 'dondurulmus', 'dondurulmuş'],
  sweetened: ['sweetened', 'sekerli', 'şekerli', 'with sugar'],
}

const CATEGORY_HINTS = {
  'meyve': ['fruit', 'meyve', 'berries', 'citrus'],
  'sebze': ['vegetable', 'sebze', 'greens'],
  'içecek': ['beverage', 'drink', 'juice', 'tea', 'coffee', 'milk', 'icecek', 'içecek'],
  'süt ürünleri': ['dairy', 'cheese', 'yogurt', 'sut', 'süt', 'milk'],
  'et / tavuk / balık': ['meat', 'poultry', 'fish', 'beef', 'chicken', 'turkey', 'seafood'],
  'tahıl / ekmek / makarna': ['grain', 'bread', 'pasta', 'rice', 'cereal', 'flour'],
  'baklagiller': ['legume', 'bean', 'lentil', 'pea', 'chickpea'],
  'kuruyemiş': ['nut', 'seed', 'almond', 'walnut'],
  'yağlar': ['oil', 'fat', 'butter', 'margarine'],
  'yumurta': ['egg'],
}

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
    .replace(/[^a-z0-9\s%]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenize(value) {
  const normalized = normalizeText(value)
  if (!normalized) return []
  return normalized.split(' ').filter((token) => token.length > 1)
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
    candidate.search_keywords_en,
    candidate.search_keywords_tr,
  ]
  return [...new Set(parts.flatMap((part) => tokenize(part)))]
}

function getMatchText(match) {
  return [match.name_tr, match.name_en, match.category_tr, match.category_en].filter(Boolean).join(' ')
}

function textContainsState(text, stateKey) {
  const patterns = STATE_PATTERNS[stateKey] ?? [stateKey]
  const normalized = normalizeText(text)
  return patterns.some((pattern) => normalized.includes(normalizeText(pattern)))
}

function hasTargetStateMismatch(candidate, match) {
  const target = normalizeText(candidate.target_state)
  if (!target || target === 'any' || target === 'prepared') return false

  const matchText = getMatchText(match)
  const requestText = `${candidate.name_tr} ${candidate.name_en} ${candidate.search_keywords_en}`

  const requestHasState = textContainsState(requestText, target) || textContainsState(candidate.target_state, target)
  const matchHasState = textContainsState(matchText, target)

  if (requestHasState && !matchHasState) {
    const conflictingStates = Object.keys(STATE_PATTERNS).filter(
      (state) => state !== target && textContainsState(matchText, state),
    )
    if (conflictingStates.length) return true
  }

  if (!requestHasState && matchHasState) {
    const oppositePairs = [
      ['raw', 'cooked'], ['raw', 'boiled'], ['raw', 'fried'], ['raw', 'baked'],
      ['boiled', 'fried'], ['boiled', 'raw'], ['grilled', 'fried'],
      ['whole milk', 'skim milk'], ['skim milk', 'whole milk'],
      ['unsweetened', 'sweetened'],
    ]
    for (const [a, b] of oppositePairs) {
      if (target === a && textContainsState(matchText, b)) return true
      if (target === b && textContainsState(matchText, a)) return true
    }
  }

  return false
}

function isRejectedMatch(candidate, match) {
  const matchText = normalizeText(getMatchText(match))
  const requestText = normalizeText(`${candidate.name_tr} ${candidate.name_en}`)

  for (const indicator of REJECT_INDICATORS) {
    const norm = normalizeText(indicator)
    if (matchText.includes(norm) && !requestText.includes(norm)) {
      return true
    }
  }

  return false
}

function categoryMatchScore(candidate, match) {
  const cat = normalizeText(candidate.category_tr)
  const hints = CATEGORY_HINTS[cat]
  if (!hints?.length) return 0.5

  const matchText = normalizeText(getMatchText(match))
  const hit = hints.some((hint) => matchText.includes(normalizeText(hint)))
  return hit ? 1 : 0
}

function exactNameScore(candidate, match) {
  const reqEn = normalizeText(candidate.name_en)
  const reqTr = normalizeText(candidate.name_tr)
  const matchEn = normalizeText(match.name_en)
  const matchTr = normalizeText(match.name_tr)

  if (reqEn && matchEn && reqEn === matchEn) return 1
  if (reqTr && matchTr && reqTr === matchTr) return 1

  const kwEn = normalizeText(candidate.search_keywords_en)
  if (kwEn && (matchEn === kwEn || matchEn.includes(kwEn) || kwEn.includes(matchEn))) return 0.95

  return 0
}

function scoreCandidate(candidate, match) {
  if (!match?.food_id) return -1
  if (isRejectedMatch(candidate, match)) return -1

  const requestTokens = getRequestTokens(candidate)
  const overlap = Math.max(
    tokenOverlapScore(requestTokens, match.name_en),
    tokenOverlapScore(requestTokens, match.name_tr),
    tokenOverlapScore(requestTokens, getMatchText(match)),
  )

  if (overlap < 0.2) return -1

  let score = overlap * 50
  score += exactNameScore(candidate, match) * 30
  score += categoryMatchScore(candidate, match) * 10

  const rpcScore = Number(match.search_score ?? match.score ?? match.rank)
  if (Number.isFinite(rpcScore)) score += rpcScore * 10

  if (hasTargetStateMismatch(candidate, match)) score -= 35

  return Math.max(0, score)
}

function mapCandidate(candidate, computedScore) {
  if (!candidate) {
    return {
      food_id: '',
      name_en: '',
      name_tr: '',
      category: '',
      calories_100g: '',
      protein_100g: '',
      carbs_100g: '',
      fat_100g: '',
      fiber_100g: '',
      sugar_100g: '',
      sodium_mg_100g: '',
      score: '',
    }
  }

  return {
    food_id: candidate.food_id ?? '',
    name_en: candidate.name_en || '',
    name_tr: candidate.name_tr || '',
    category: candidate.category_tr || candidate.category_name_tr || candidate.category_en || '',
    calories_100g: formatNumber(candidate.calories_100g),
    protein_100g: formatNumber(candidate.protein_100g),
    carbs_100g: formatNumber(candidate.carbs_100g),
    fat_100g: formatNumber(candidate.fat_100g),
    fiber_100g: formatNumber(candidate.fiber_100g),
    sugar_100g: formatNumber(candidate.sugar_100g),
    sodium_mg_100g: formatNumber(candidate.sodium_mg_100g),
    score: formatNumber(computedScore),
  }
}

function rankMatches(candidate, matches) {
  return matches
    .map((match) => ({ match, score: scoreCandidate(candidate, match) }))
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
}

function classifyMatch(candidate, ranked, rpcError) {
  const source = candidate.preferred_source

  if (source === 'TURKOMP_OR_RECIPE') {
    return {
      match_status: 'recipe_or_turkomp_needed',
      review_note: 'Turkish dish or recipe-based item — TürKomp or ingredient recipe; USDA skipped.',
    }
  }

  if (source === 'OPEN_FOOD_FACTS') {
    return {
      match_status: 'open_food_facts_needed',
      review_note: 'Packaged/branded product — use Open Food Facts barcode lookup; USDA skipped.',
    }
  }

  if (source === 'MANUAL_REVIEW') {
    return {
      match_status: 'manual_review_needed',
      review_note: 'Low-coverage or baseline item — manual nutrition review; USDA optional.',
    }
  }

  if (rpcError) {
    return {
      match_status: 'no_source_match',
      review_note: `Supabase RPC error: ${rpcError}`,
    }
  }

  const top = ranked[0]
  if (!top) {
    return {
      match_status: 'no_source_match',
      review_note: 'No USDA candidates passed strict scoring filters.',
    }
  }

  const topMatch = top.match
  const overlap = Math.max(
    tokenOverlapScore(getRequestTokens(candidate), topMatch.name_en),
    tokenOverlapScore(getRequestTokens(candidate), getMatchText(topMatch)),
  )
  const exact = exactNameScore(candidate, topMatch)
  const stateMismatch = hasTargetStateMismatch(candidate, topMatch)
  const rejected = isRejectedMatch(candidate, topMatch)

  if (rejected || overlap < 0.25) {
    return {
      match_status: 'wrong_or_weak_match',
      review_note: 'Top candidate rejected (baby food, sauce, mix, branded, or weak name overlap).',
    }
  }

  if (
    !stateMismatch &&
    (exact >= 0.95 || overlap >= 0.75) &&
    top.score >= 55 &&
    categoryMatchScore(candidate, topMatch) >= 0.5
  ) {
    return {
      match_status: 'can_update_from_usda',
      review_note: 'Strong USDA match — name, state, and category align; quick human confirm then import.',
    }
  }

  if (stateMismatch || overlap < 0.5 || top.score < 40) {
    return {
      match_status: 'wrong_or_weak_match',
      review_note: stateMismatch
        ? 'Candidate cooking/preparation state likely wrong — reject or pick alternate.'
        : 'Weak name/category alignment — do not auto-import.',
    }
  }

  return {
    match_status: 'likely_match_manual_check',
    review_note: 'Plausible USDA candidate — manual review required before catalog update.',
  }
}

async function searchFoods(supabase, query, language, limit = 12) {
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

function isWeakSearch(matches, candidate) {
  if (!matches.length) return true

  const requestTokens = getRequestTokens(candidate)
  const top = matches[0]
  const overlap = Math.max(
    tokenOverlapScore(requestTokens, top.name_en),
    tokenOverlapScore(requestTokens, top.name_tr),
    tokenOverlapScore(requestTokens, getMatchText(top)),
  )

  return overlap < 0.35
}

async function findUsdaCandidates(supabase, candidate) {
  const enQuery = candidate.search_keywords_en || candidate.name_en
  const trQuery = candidate.search_keywords_tr || candidate.name_tr

  try {
    const enResults = await searchFoods(supabase, enQuery, 'en', 12)
    let merged = enResults

    if (isWeakSearch(enResults, candidate) && trQuery) {
      const trResults = await searchFoods(supabase, trQuery, 'tr', 12)
      merged = mergeCandidates(enResults, trResults)
    }

    return { matches: merged, rpcError: '' }
  } catch (error) {
    return { matches: [], rpcError: error.message || String(error) }
  }
}

function buildReviewRow(candidate, ranked, classification) {
  const slots = [0, 1, 2].map((i) => {
    const entry = ranked[i]
    return mapCandidate(entry?.match, entry?.score)
  })

  const row = {
    candidate_id: candidate.candidate_id,
    name_tr: candidate.name_tr,
    name_en: candidate.name_en,
    target_state: candidate.target_state,
    preferred_source: candidate.preferred_source,
    match_status: classification.match_status,
    review_note: classification.review_note,
  }

  for (let i = 0; i < 3; i += 1) {
    const prefix = `candidate_${i + 1}`
    const slot = slots[i]
    row[`${prefix}_food_id`] = slot.food_id
    row[`${prefix}_name_en`] = slot.name_en
    row[`${prefix}_name_tr`] = slot.name_tr
    row[`${prefix}_category`] = slot.category
    row[`${prefix}_calories_100g`] = slot.calories_100g
    row[`${prefix}_protein_100g`] = slot.protein_100g
    row[`${prefix}_carbs_100g`] = slot.carbs_100g
    row[`${prefix}_fat_100g`] = slot.fat_100g
    row[`${prefix}_fiber_100g`] = slot.fiber_100g
    row[`${prefix}_sugar_100g`] = slot.sugar_100g
    row[`${prefix}_sodium_mg_100g`] = slot.sodium_mg_100g
    row[`${prefix}_score`] = slot.score
  }

  return row
}

async function main() {
  if (!existsSync(INPUT_CSV)) {
    throw new Error(`Missing input CSV. Run: node scripts/generateFoodWishlist400.mjs`)
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

  console.log(`Matching ${candidates.length} wishlist candidates (EN-first USDA search)...`)

  const reviewRows = []
  const statusCounts = {}

  for (const candidate of candidates) {
    let ranked = []
    let rpcError = ''

    if (candidate.preferred_source === 'USDA') {
      const result = await findUsdaCandidates(supabase, candidate)
      ranked = rankMatches(candidate, result.matches)
      rpcError = result.rpcError
    }

    const classification = classifyMatch(candidate, ranked, rpcError)
    statusCounts[classification.match_status] = (statusCounts[classification.match_status] ?? 0) + 1

    if (rpcError && candidate.preferred_source === 'USDA') {
      console.error(`[${candidate.candidate_id}] RPC error for "${candidate.name_tr}":`, rpcError)
    }

    reviewRows.push(buildReviewRow(candidate, ranked, classification))
  }

  mkdirSync(dirname(OUTPUT_CSV), { recursive: true })
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
