/**
 * Verify core priority foods against USDA-backed nutrition_foods.
 * Reads foodDatabase.js + core_food_verification_priority.csv.
 * Does NOT modify foodDatabase.js — produces a human review CSV only.
 *
 * Run: node scripts/verifyCoreFoodsAgainstUsda.mjs
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createClient } from '@supabase/supabase-js'

import { MASTER_FOOD_DB, toLegacyFood } from '../src/utils/foodDatabase.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = join(__dirname, '..')
const PRIORITY_CSV = join(__dirname, 'output', 'core_food_verification_priority.csv')
const PRIOR_MATCH_CSV = join(__dirname, 'output', 'nutrition_catalog_usda_match_review.csv')
const OUTPUT_CSV = join(__dirname, 'output', 'core_food_usda_verification_review.csv')

const OUTPUT_COLUMNS = [
  'food_id',
  'name_tr',
  'name_en',
  'category_tr',
  'current_calories_100g',
  'current_protein_100g',
  'current_carbs_100g',
  'current_fat_100g',
  'current_fiber_100g',
  'current_sugar_100g',
  'current_sodium_mg_100g',
  'usda_food_id',
  'usda_name_tr',
  'usda_name_en',
  'usda_category_tr',
  'usda_calories_100g',
  'usda_protein_100g',
  'usda_carbs_100g',
  'usda_fat_100g',
  'usda_fiber_100g',
  'usda_sugar_100g',
  'usda_sodium_mg_100g',
  'calorie_diff',
  'protein_diff',
  'carbs_diff',
  'fat_diff',
  'fiber_diff',
  'sugar_diff',
  'sodium_diff',
  'match_confidence',
  'verification_decision',
  'review_note',
]

const COOKING_STATE_WORDS = [
  'haşlanmış', 'haslanmis', 'ızgara', 'izgara', 'kızartma', 'kizartma',
  'fırın', 'firin', 'çiğ', 'cig', 'kuru', 'kurutulmuş', 'kurutulmus',
  'taze', 'konserve', 'hazır', 'hazir', 'bebek', 'junior', 'suda', 'yağda', 'yagda',
]

const WRONG_MATCH_INDICATORS = [
  'bebek', 'junior', 'konserve hazır', 'hazır jambonlu', 'hazir jambonlu',
  'soslu', 'jambonlu', 'tahıl gevreği', 'tahil gevregi', 'maması', 'mamasi',
  'filizi', 'sprouts', 'ezmesi', 'kreması', 'kremasi', 'tozu', 'suyu içeceği',
  'suyu icecegi', 'turşusu', 'tursusu', 'börek', 'borek', 'salata sosu',
  'greyfurt suyu', 'ananas-greyfurt', 'fındık kreması', 'findik kremasi',
  'çikolatalı', 'cikolatali', 'şeker kaplı', 'seker kapli', 'püresi', 'puresi',
  'çekirdeği', 'cekirdegi', 'kabuğu', 'kabugu', 'füme', 'fume', 'sandviç',
  'sandvic', 'wonton', 'bologna', 'beerwurst', 'hamuru', 'guava',
  'yer fıstığı', 'yer fistigi', 'mısır,', 'misir,', 'karışım', 'karisim',
  'yaprak', 'leaves', 'ayran altı', 'ayran alti',
]

const RECIPE_OR_DISH_PATTERNS = [
  /çorbası|corbasi/i,
  /pilavı|pilavi/i,
  /pilav\b/i,
  /yemeği|yemegi/i,
  /salatası|salatasi/i,
  /köftesi|koftesi/i,
  /menemen/i,
  /cacık|cacik/i,
  /ayran/i,
]

/** Extra USDA search queries per food_id (TR-first, then EN). */
const SEARCH_QUERY_OVERRIDES = {
  45: ['Çiğ Elma', 'Apple raw with skin'],
  46: ['Çiğ Muz', 'Banana raw'],
  53: ['Karpuz çiğ', 'Watermelon raw'],
  65: ['Domates çiğ', 'Tomato raw'],
  66: ['Salatalık çiğ', 'Cucumber raw with peel'],
  71: ['Kabak çiğ', 'Zucchini raw'],
  76: ['Patates haşlanmış tuzsuz', 'Potato boiled without salt'],
  6: ['Haşlanmış yumurta tuzsuz', 'Egg boiled'],
  18: ['Tatlı patates çiğ', 'Sweet potato raw'],
  20: ['Zeytinyağı yemeklik', 'Olive oil'],
  49: ['Portakal çiğ', 'Orange raw'],
  51: ['Çiğ çilek', 'Strawberry raw'],
  77: ['Mısır haşlanmış', 'Corn sweet boiled'],
  10: ['Tam yağlı süt', 'Milk whole'],
  14: ['Tam yağlı sade yoğurt', 'Yogurt whole milk plain'],
  7: ['Pirinç haşlanmış', 'Rice white cooked'],
  33: ['Bulgur haşlanmış', 'Bulgur cooked'],
  34: ['Makarna haşlanmış', 'Pasta cooked'],
  5: ['Tam buğday ekmek', 'Whole wheat bread'],
  8: ['Kuru fasulye haşlanmış', 'White beans boiled'],
  15: ['Nohut haşlanmış', 'Chickpeas boiled'],
  188: ['Kırmızı mercimek haşlanmış', 'Red lentils boiled'],
  189: ['Yeşil mercimek haşlanmış', 'Green lentils boiled'],
  143: ['Limon çiğ', 'Lemon raw without peel'],
  153: ['Sarımsak çiğ', 'Garlic raw'],
  16: ['Badem', 'Almonds'],
  105: ['Ceviz', 'Walnuts'],
  106: ['Fındık', 'Hazelnuts'],
  238: ['Balık ızgara', 'Fish grilled'],
  11: ['Somon ızgara', 'Salmon grilled'],
  93: ['Kaşar peyniri', 'Kashar cheese'],
  37: ['Ayran'],
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
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      env[key] = value
      return env
    }, {})
}

function csvCell(value) {
  if (value === null || value === undefined) return ''
  const text = String(value)
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
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
      if (char === '"' && next === '"') { field += '"'; i += 1 }
      else if (char === '"') { inQuotes = false }
      else { field += char }
      continue
    }
    if (char === '"') inQuotes = true
    else if (char === ',') { row.push(field); field = '' }
    else if (char === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else if (char !== '\r') field += char
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row) }

  if (!rows.length) return []
  const headers = rows[0]
  return rows.slice(1).filter((cells) => cells.some((c) => c !== '')).map((cells) => {
    const record = {}
    headers.forEach((header, index) => { record[header] = cells[index] ?? '' })
    return record
  })
}

function formatNumber(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) return ''
  return String(Number(num.toFixed(4)))
}

function diffValue(current, usda) {
  const c = Number(current)
  const u = Number(usda)
  if (!Number.isFinite(c) || !Number.isFinite(u)) return ''
  return formatNumber(u - c)
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

function extractCookingStates(text) {
  const normalized = normalizeText(text)
  return COOKING_STATE_WORDS.filter((word) => normalized.includes(normalizeText(word)))
}

function hasWrongMatchIndicators(requestName, match) {
  const matchText = normalizeText(`${match.name_tr} ${match.name_en}`)
  const requestText = normalizeText(requestName)
  const matchTokens = new Set(tokenize(matchText))
  const requestTokens = new Set(tokenize(requestText))

  for (const indicator of WRONG_MATCH_INDICATORS) {
    const norm = normalizeText(indicator)
    const indicatorTokens = norm.split(' ').filter((t) => t.length > 1)
    if (!indicatorTokens.length) continue

    const phraseMatch = indicatorTokens.every((token) => matchTokens.has(token))
    const phraseInRequest = indicatorTokens.every((token) => requestTokens.has(token))
    if (phraseMatch && !phraseInRequest) return true
  }
  return false
}

function hasCookingStateMismatch(requestName, match) {
  const requestStates = extractCookingStates(requestName)
  const matchStates = extractCookingStates(`${match.name_tr} ${match.name_en}`)
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

function isRecipeOrDish(nameTr, categoryTr) {
  const text = `${nameTr} ${categoryTr}`
  return RECIPE_OR_DISH_PATTERNS.some((re) => re.test(text))
}

function mapRpcCandidate(candidate) {
  if (!candidate) return null
  return {
    food_id: candidate.food_id ?? '',
    name_tr: candidate.name_tr || '',
    name_en: candidate.name_en || '',
    category_tr: candidate.category_tr || candidate.category_name_tr || '',
    calories_100g: candidate.calories_100g,
    protein_100g: candidate.protein_100g,
    carbs_100g: candidate.carbs_100g,
    fat_100g: candidate.fat_100g,
    fiber_100g: candidate.fiber_100g,
    sugar_100g: candidate.sugar_100g,
    sodium_mg_100g: candidate.sodium_mg_100g,
    score: candidate.search_score ?? candidate.score ?? candidate.rank ?? '',
  }
}

function mapPriorCandidate(row, prefix) {
  const id = row[`${prefix}_food_id`]
  if (!id) return null
  return {
    food_id: id,
    name_tr: row[`${prefix}_name_tr`] || '',
    name_en: '',
    category_tr: '',
    calories_100g: row[`${prefix}_calories_100g`],
    protein_100g: row[`${prefix}_protein_100g`],
    carbs_100g: row[`${prefix}_carbs_100g`],
    fat_100g: row[`${prefix}_fat_100g`],
    fiber_100g: '',
    sugar_100g: '',
    sodium_mg_100g: '',
    score: row[`${prefix}_score`] || '',
    source: 'prior_match_review',
  }
}

function nameOverlap(food, candidate) {
  const trTokens = tokenize(food.name_tr)
  const allTokens = tokenize(`${food.name_tr} ${food.name_en}`)
  return Math.max(
    tokenOverlapScore(trTokens, candidate.name_tr),
    tokenOverlapScore(trTokens, `${candidate.name_tr} ${candidate.name_en}`),
    tokenOverlapScore(allTokens, candidate.name_tr),
    tokenOverlapScore(allTokens, candidate.name_en),
    tokenOverlapScore(allTokens, `${candidate.name_tr} ${candidate.name_en}`),
  )
}

function scoreCandidate(food, candidate) {
  if (!candidate?.food_id) return -1
  if (hasWrongMatchIndicators(`${food.name_tr} ${food.name_en}`, candidate)) return -1

  const overlap = nameOverlap(food, candidate)

  let score = overlap * 100
  const rpcScore = Number(candidate.score)
  if (Number.isFinite(rpcScore)) score += rpcScore * 10
  if (candidate.source === 'prior_match_review') score += 5
  if (hasCookingStateMismatch(`${food.name_tr} ${food.name_en}`, candidate)) score -= 25
  if (normalizeText(candidate.name_tr).includes('cig') || normalizeText(candidate.name_en).includes('raw')) {
    if (!normalizeText(food.name_tr).includes('haslanmis') && !normalizeText(food.name_tr).includes('izgara')) {
      score += 8
    }
  }
  return score
}

function pickBestCandidate(food, candidates) {
  const ranked = candidates
    .filter(Boolean)
    .map((c) => ({ candidate: c, score: scoreCandidate(food, c) }))
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => b.score - a.score)

  return ranked[0]?.candidate ?? null
}

function macroDistance(food, candidate) {
  const pairs = [
    [food.current_calories_100g, candidate.calories_100g],
    [food.current_protein_100g, candidate.protein_100g],
    [food.current_carbs_100g, candidate.carbs_100g],
    [food.current_fat_100g, candidate.fat_100g],
  ]
  let total = 0
  let count = 0
  for (const [current, usda] of pairs) {
    const c = Number(current)
    const u = Number(usda)
    if (!Number.isFinite(c) || !Number.isFinite(u)) continue
    const denom = Math.max(Math.abs(c), Math.abs(u), 1)
    total += Math.abs(u - c) / denom
    count += 1
  }
  return count ? total / count : 1
}

function classifyVerification(food, candidate, allCandidates) {
  if (isRecipeOrDish(food.name_tr, food.category_tr)) {
    return {
      match_confidence: 'none',
      verification_decision: 'recipe_or_turkomp_needed',
      review_note: 'Hazır yemek/tarif gıdası — USDA yerine TürKomp veya tarif hesabı gerekli.',
    }
  }

  if (!candidate?.food_id) {
    return {
      match_confidence: 'none',
      verification_decision: 'no_source_match',
      review_note: allCandidates.length
        ? 'USDA adayları bulundu ancak hepsi zayıf/yanlış eşleşme olarak filtrelendi.'
        : 'Supabase ve önceki eşleşme dosyasında uygun USDA adayı bulunamadı.',
    }
  }

  if (hasWrongMatchIndicators(`${food.name_tr} ${food.name_en}`, candidate)) {
    return {
      match_confidence: 'low',
      verification_decision: 'wrong_match',
      review_note: `En iyi aday alakasız görünüyor: "${candidate.name_tr || candidate.name_en}".`,
    }
  }

  const overlap = nameOverlap(food, candidate)
  const cookingMismatch = hasCookingStateMismatch(`${food.name_tr} ${food.name_en}`, candidate)
  const macroDist = macroDistance(food, candidate)

  if (overlap < 0.25) {
    return {
      match_confidence: 'low',
      verification_decision: 'wrong_match',
      review_note: 'USDA adayı isim benzerliği çok düşük.',
    }
  }

  if (cookingMismatch) {
    return {
      match_confidence: overlap >= 0.5 ? 'medium' : 'low',
      verification_decision: 'likely_match_manual_check',
      review_note: 'Aday yakın ancak pişirme/çiğ durumu farklı olabilir — elle kontrol gerekli.',
    }
  }

  const trOverlap = Math.max(
    tokenOverlapScore(tokenize(food.name_tr), candidate.name_tr),
    tokenOverlapScore(tokenize(food.name_tr), `${candidate.name_tr} ${candidate.name_en}`),
  )

  if (trOverlap >= 0.5 && overlap >= 0.5 && macroDist <= 0.08 && !cookingMismatch) {
    return {
      match_confidence: 'high',
      verification_decision: 'can_update_from_usda',
      review_note: 'Aynı gıda ve benzer durum; USDA değerleri kaynak olarak kullanılabilir (elle onay sonrası).',
    }
  }

  if (overlap >= 0.55 && macroDist <= 0.2) {
    return {
      match_confidence: 'medium',
      verification_decision: 'likely_match_manual_check',
      review_note: 'Makro farkları orta düzeyde — aynı gıda olduğu doğrulandıktan sonra güncellenebilir.',
    }
  }

  if (macroDist > 0.4) {
    return {
      match_confidence: overlap >= 0.5 ? 'medium' : 'low',
      verification_decision: 'likely_match_manual_check',
      review_note: 'İsim benzerliği var ancak makrolar belirgin şekilde farklı — porsiyon/durum kontrolü gerekli.',
    }
  }

  return {
    match_confidence: 'low',
    verification_decision: 'keep_pending',
    review_note: 'Aday belirsiz; otomatik güncelleme önerilmez.',
  }
}

async function searchFoods(supabase, query, language, limit = 8) {
  const q = String(query || '').trim()
  if (q.length < 2) return []
  const { data, error } = await supabase.rpc('search_nutrition_foods', {
    search_query: q,
    search_language: language,
    result_limit: limit,
  })
  if (error) throw error
  return (data ?? []).map(mapRpcCandidate)
}

async function collectCandidates(supabase, food, priorRow) {
  const merged = []
  const seen = new Set()

  const add = (candidate) => {
    const id = candidate?.food_id
    if (!id || seen.has(id)) return
    seen.add(id)
    merged.push(candidate)
  }

  if (priorRow) {
    add(mapPriorCandidate(priorRow, 'candidate_1'))
    add(mapPriorCandidate(priorRow, 'candidate_2'))
  }

  const queries = [
    food.name_tr,
    food.name_en,
    ...(SEARCH_QUERY_OVERRIDES[food.food_id] ?? []),
  ].filter(Boolean)

  for (const query of queries) {
    const lang = /[a-zA-Z]/.test(query) && !/[çğıöşüÇĞİÖŞÜ]/.test(query) ? 'en' : 'tr'
    try {
      const results = await searchFoods(supabase, query, lang, 8)
      for (const result of results) add(result)
    } catch {
      // continue with other queries
    }
  }

  return merged
}

function buildOutputRow(food, candidate, classification) {
  return {
    food_id: food.food_id,
    name_tr: food.name_tr,
    name_en: food.name_en,
    category_tr: food.category_tr,
    current_calories_100g: food.current_calories_100g,
    current_protein_100g: food.current_protein_100g,
    current_carbs_100g: food.current_carbs_100g,
    current_fat_100g: food.current_fat_100g,
    current_fiber_100g: food.current_fiber_100g,
    current_sugar_100g: food.current_sugar_100g,
    current_sodium_mg_100g: food.current_sodium_mg_100g,
    usda_food_id: candidate?.food_id ?? '',
    usda_name_tr: candidate?.name_tr ?? '',
    usda_name_en: candidate?.name_en ?? '',
    usda_category_tr: candidate?.category_tr ?? '',
    usda_calories_100g: formatNumber(candidate?.calories_100g),
    usda_protein_100g: formatNumber(candidate?.protein_100g),
    usda_carbs_100g: formatNumber(candidate?.carbs_100g),
    usda_fat_100g: formatNumber(candidate?.fat_100g),
    usda_fiber_100g: formatNumber(candidate?.fiber_100g),
    usda_sugar_100g: formatNumber(candidate?.sugar_100g),
    usda_sodium_mg_100g: formatNumber(candidate?.sodium_mg_100g),
    calorie_diff: diffValue(food.current_calories_100g, candidate?.calories_100g),
    protein_diff: diffValue(food.current_protein_100g, candidate?.protein_100g),
    carbs_diff: diffValue(food.current_carbs_100g, candidate?.carbs_100g),
    fat_diff: diffValue(food.current_fat_100g, candidate?.fat_100g),
    fiber_diff: diffValue(food.current_fiber_100g, candidate?.fiber_100g),
    sugar_diff: diffValue(food.current_sugar_100g, candidate?.sugar_100g),
    sodium_diff: diffValue(food.current_sodium_mg_100g, candidate?.sodium_mg_100g),
    match_confidence: classification.match_confidence,
    verification_decision: classification.verification_decision,
    review_note: classification.review_note,
  }
}

async function main() {
  if (!existsSync(PRIORITY_CSV)) {
    throw new Error(`Missing priority CSV. Run: node scripts/generateCoreFoodVerificationPriority.mjs`)
  }

  const env = { ...loadEnvFile(join(ROOT_DIR, '.env')), ...process.env }
  const supabaseUrl = env.VITE_SUPABASE_URL
  const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env')
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey)
  const priorityFoods = parseCsv(readFileSync(PRIORITY_CSV, 'utf8'))
  const priorMatches = existsSync(PRIOR_MATCH_CSV)
    ? new Map(parseCsv(readFileSync(PRIOR_MATCH_CSV, 'utf8')).map((row) => [row.catalog_food_id, row]))
    : new Map()

  // Sanity: foodDatabase import works (not written back)
  void MASTER_FOOD_DB.length

  console.log(`Verifying ${priorityFoods.length} core foods against USDA...`)

  const outputRows = []
  const decisionCounts = {}

  for (const food of priorityFoods) {
    const priorRow = priorMatches.get(String(food.food_id))
    const allCandidates = await collectCandidates(supabase, food, priorRow)
    const best = pickBestCandidate(food, allCandidates)
    const classification = classifyVerification(food, best, allCandidates)
    decisionCounts[classification.verification_decision] =
      (decisionCounts[classification.verification_decision] ?? 0) + 1

    outputRows.push(buildOutputRow(food, best, classification))
    console.log(`  [${food.food_id}] ${food.name_tr} → ${classification.verification_decision}`)
  }

  mkdirSync(dirname(OUTPUT_CSV), { recursive: true })
  const csv = [
    OUTPUT_COLUMNS.join(','),
    ...outputRows.map((row) => OUTPUT_COLUMNS.map((col) => csvCell(row[col])).join(',')),
  ].join('\n')
  writeFileSync(OUTPUT_CSV, `${csv}\n`, 'utf8')

  console.log(`\nWrote verification review → ${OUTPUT_CSV}`)
  console.log('Decision summary:')
  for (const [decision, count] of Object.entries(decisionCounts).sort(([a], [b]) => a.localeCompare(b))) {
    console.log(`  ${decision}: ${count}`)
  }
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
