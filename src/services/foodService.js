/**
 * Food search — local FOOD_DB is the user-facing catalog.
 * Supabase nutrition_foods helpers are kept for future verification/reference only.
 */

import { supabase } from '../utils/supabaseClient'
import { FOOD_DB } from '../utils/foodDatabase.js'

const MAX_PORTION_LABELS = 6
const MAX_LABEL_LENGTH = 28

const SKIP_LABEL_RE = [
  /\bapprox\b/i,
  /\bdiameter\b/i,
  /\bdia\b/i,
  /\blong\s+x\b/i,
  /\bballs\b/i,
]

const UNIT_PRIORITY = [
  'Gram',
  '1 küçük',
  '1 orta',
  '1 büyük',
  '1 dilim',
  '1 bardak',
  '1 porsiyon',
  '1 yemek kaşığı',
  '1 çay kaşığı',
]

const DISPLAY_UNIT_PRIORITY = [
  '1 orta',
  '1 porsiyon',
  '1 küçük',
  '1 büyük',
  '1 dilim',
  '1 bardak',
  '1 yemek kaşığı',
  '1 çay kaşığı',
]

const TURKISH_LABELS = new Set(UNIT_PRIORITY.filter(u => u !== 'Gram'))

function normalizeRawLabel(label) {
  return String(label || '').trim().replace(/\s+/g, ' ')
}

function normalizeFoodName(name) {
  return String(name || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function shouldSkipUnmappedLabel(label) {
  return SKIP_LABEL_RE.some(re => re.test(label.toLowerCase()))
}

/**
 * Map a raw USDA / DB portion label to a clean Turkish label, or null to skip.
 * @param {string} raw
 * @returns {string|null}
 */
export function cleanPortionLabel(raw) {
  const label = normalizeRawLabel(raw)
  if (!label) return null

  const lower = label.toLowerCase()
  if (lower === '100 g' || lower === '100g') return null

  if (TURKISH_LABELS.has(label)) return label

  if (/^1\s+kü?çük$/iu.test(label) || lower === 'küçük' || lower === 'kucuk') return '1 küçük'
  if (/^1\s+orta$/iu.test(label) || lower === 'orta') return '1 orta'
  if (/^1\s+bü?yük$/iu.test(label) || lower === 'büyük' || lower === 'buyuk') return '1 büyük'
  if (/^1\s+dilim$/iu.test(label)) return '1 dilim'
  if (/^1\s+bardak$/iu.test(label)) return '1 bardak'
  if (/^1\s+porsiyon$/iu.test(label)) return '1 porsiyon'
  if (/^1\s+yemek\s+kaşığı$/iu.test(label) || /^1\s+yemek\s+kasigi$/iu.test(label)) return '1 yemek kaşığı'
  if (/^1\s+çay\s+kaşığı$/iu.test(label) || /^1\s+cay\s+kasigi$/iu.test(label)) return '1 çay kaşığı'

  if (/^1\s+small\b/i.test(label) || lower === 'small') return '1 küçük'
  if (/^1\s+medium\b/i.test(label) || lower === 'medium') return '1 orta'
  if (/^1\s+large\b/i.test(label) || lower === 'large') return '1 büyük'
  if (/\bcup\b/i.test(lower)) return '1 bardak'
  if (/\btablespoon\b/i.test(lower) || /\btbsp\b/i.test(lower)) return '1 yemek kaşığı'
  if (/\bteaspoon\b/i.test(lower) || /\btsp\b/i.test(lower)) return '1 çay kaşığı'
  if (/\bslice\b/i.test(lower)) return '1 dilim'
  if (/\bwedge\b/i.test(lower)) return '1 dilim'
  if (/\bserving\b/i.test(lower) || /\bnlea\b/i.test(lower)) return '1 porsiyon'

  if (shouldSkipUnmappedLabel(label)) return null
  if (label.length > MAX_LABEL_LENGTH) return null
  if (/[(),]/.test(label)) return null
  if (/\d+(\.\d+)?\s*(in|cm|mm|oz|fl\.?\s*oz)\b/i.test(label)) return null

  return null
}

function pickBestPortion(candidates) {
  if (!candidates.length) return null
  const withDefault = candidates.find(c => c.is_default)
  if (withDefault) return withDefault

  const gramsList = candidates.map(c => c.grams).sort((a, b) => a - b)
  const median = gramsList[Math.floor(gramsList.length / 2)]

  return candidates.reduce((best, current) => {
    if (!best) return current
    const bestDist = Math.abs(best.grams - median)
    const currentDist = Math.abs(current.grams - median)
    return currentDist < bestDist ? current : best
  }, null)
}

/**
 * Build curated units map from raw portion rows.
 * @param {Array} portions
 * @returns {Record<string, number>}
 */
function buildCuratedUnits(portions = []) {
  const grouped = new Map()

  for (const portion of portions) {
    const grams = Number(portion.grams)
    const rawLabel = portion.portion_label_tr || portion.portion_label_en
    const cleanLabel = cleanPortionLabel(rawLabel)

    if (!Number.isFinite(grams) || grams <= 0 || !cleanLabel) continue

    if (!grouped.has(cleanLabel)) grouped.set(cleanLabel, [])
    grouped.get(cleanLabel).push({ ...portion, grams, cleanLabel })
  }

  const selected = []
  for (const [, candidates] of grouped) {
    const best = pickBestPortion(candidates)
    if (best) selected.push(best)
  }

  selected.sort((a, b) => {
    const ai = UNIT_PRIORITY.indexOf(a.cleanLabel)
    const bi = UNIT_PRIORITY.indexOf(b.cleanLabel)
    const aRank = ai === -1 ? 999 : ai
    const bRank = bi === -1 ? 999 : bi
    if (aRank !== bRank) return aRank - bRank
    return a.grams - b.grams
  })

  const units = { Gram: 0.01 }
  let count = 0

  for (const portion of selected) {
    if (count >= MAX_PORTION_LABELS) break
    if (portion.cleanLabel === 'Gram') continue
    units[portion.cleanLabel] = portion.grams / 100
    count++
  }

  return units
}

/**
 * Short unit labels safe for search result cards (max 2–3).
 * @param {object} food
 * @param {number} max
 * @returns {string[]}
 */
export function getDisplayUnits(food, max = 2) {
  if (!food?.units) return []

  return Object.keys(food.units)
    .filter(u => u !== 'Gram' && u !== 'Mililitre')
    .filter(u => u.length <= 20 && TURKISH_LABELS.has(u))
    .sort((a, b) => {
      const ai = DISPLAY_UNIT_PRIORITY.indexOf(a)
      const bi = DISPLAY_UNIT_PRIORITY.indexOf(b)
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
    })
    .slice(0, max)
}

function buildLocalFoodSearchHaystack(food) {
  const aliasList = Array.isArray(food.aliases)
    ? food.aliases
    : typeof food.aliases === 'string'
      ? food.aliases.split(',').map(s => s.trim())
      : []

  return [
    food.name,
    food.slug?.replace(/_/g, ' '),
    food.category,
    ...(food.tags ?? []),
    ...aliasList,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function matchesLocalFoodSearch(food, words) {
  const haystack = buildLocalFoodSearchHaystack(food)
  return words.every(word => haystack.includes(word))
}

/**
 * Primary user-facing food search — clean local catalog (MASTER_FOOD_DB / FOOD_DB).
 * Empty query returns the full catalog; non-empty queries filter by name, slug, tags, and aliases.
 * @param {string} query
 * @returns {Promise<Array>}
 */
export async function searchFoodsLocal(query) {
  const q = String(query || '').trim().toLowerCase()
  if (!q) return FOOD_DB

  const words = q.split(/\s+/).filter(Boolean)
  return FOOD_DB.filter(f => matchesLocalFoodSearch(f, words))
}

/**
 * Fetch portion rows for a single nutrition food.
 * @param {string|number} foodId
 * @returns {Promise<Array>}
 */
export async function getNutritionFoodPortions(foodId) {
  const { data, error } = await supabase
    .from('nutrition_food_portions')
    .select('portion_id, food_id, portion_label_tr, portion_label_en, grams, is_default')
    .eq('food_id', foodId)
    .order('is_default', { ascending: false })
    .order('grams', { ascending: true })

  if (error) throw error
  return data ?? []
}

/**
 * Map a nutrition_foods row + portions into the legacy FOOD_DB-compatible shape.
 * @param {object} foodRow
 * @param {Array} portions
 * @returns {object}
 */
export function convertNutritionFoodToLegacyFood(foodRow, portions = []) {
  const units = buildCuratedUnits(portions)

  return {
    id: foodRow.food_id,
    name: foodRow.name_tr || foodRow.name_en,
    calories: Number(foodRow.calories_100g) || 0,
    protein: Number(foodRow.protein_100g) || 0,
    carbs: Number(foodRow.carbs_100g) || 0,
    fat: Number(foodRow.fat_100g) || 0,
    fiber: Number(foodRow.fiber_100g) || 0,
    sugar: Number(foodRow.sugar_100g) || 0,
    units,
    source: 'nutrition_foods',
    category: foodRow.category_tr,
    _nutritionFoodId: foodRow.food_id,
    _rawNutritionFood: foodRow,
  }
}

function dedupeFoodsByName(foods) {
  const seen = new Set()
  const deduped = []

  for (const food of foods) {
    const key = normalizeFoodName(food.name)
    if (!key || seen.has(key)) continue
    seen.add(key)
    deduped.push(food)
  }

  return deduped
}

/**
 * Reference-only search against raw Supabase nutrition_foods (not for user-facing UI).
 * @param {string} query
 * @param {number} limit
 * @returns {Promise<Array>}
 */
export async function searchNutritionFoods(query, limit = 20) {
  const q = String(query || '').trim()

  if (q.length < 2) {
    return []
  }

  const { data: foods, error } = await supabase.rpc('search_nutrition_foods', {
    search_query: q,
    search_language: 'tr',
    result_limit: limit,
  })

  if (error) {
    console.error('[searchNutritionFoods] RPC error:', error)
    return []
  }

  if (!foods?.length) return []

  const foodIds = foods.map(f => f.food_id)

  const { data: portions, error: portionsError } = await supabase
    .from('nutrition_food_portions')
    .select('portion_id, food_id, portion_label_tr, portion_label_en, grams, is_default')
    .in('food_id', foodIds)
    .order('is_default', { ascending: false })
    .order('grams', { ascending: true })

  if (portionsError) {
    console.error('[searchNutritionFoods] portions error:', portionsError)
  }

  const portionsByFoodId = (portions ?? []).reduce((acc, portion) => {
    if (!acc[portion.food_id]) acc[portion.food_id] = []
    acc[portion.food_id].push(portion)
    return acc
  }, {})

  const results = foods.map(food =>
    convertNutritionFoodToLegacyFood(food, portionsByFoodId[food.food_id] ?? [])
  )

  return dedupeFoodsByName(results)
}

/** @deprecated Use searchFoodsLocal for user-facing search */
export async function searchFoodsHybrid(query) {
  return searchFoodsLocal(query)
}
