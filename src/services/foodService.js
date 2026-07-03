/**
 * Local food search — filters the mock FOOD_DB by name.
 * Supabase / OpenFoodFacts hybrid search disabled for now.
 */

import { FOOD_DB } from '../utils/foodDatabase.js'

const LOCAL_LIMIT = 50

/**
 * Filter local FOOD_DB by query (case-insensitive partial name match).
 * Empty query returns the full list (up to limit).
 * @param {string} query
 * @returns {Promise<Array>}
 */
export async function searchFoodsLocal(query) {
  const q = String(query || '').trim().toLowerCase()
  if (!q) return FOOD_DB.slice(0, LOCAL_LIMIT)

  return FOOD_DB.filter(f =>
    f.name.toLowerCase().includes(q) ||
    q.split(/\s+/).every(word => f.name.toLowerCase().includes(word))
  ).slice(0, LOCAL_LIMIT)
}

// ── Supabase / OpenFoodFacts (disabled) ──────────────────────────────────────
// import { supabase } from '../utils/supabaseClient'
// const OFF_SEARCH_URL = 'https://world.openfoodfacts.org/cgi/search.pl'
// export async function searchGlobalFoodsFromDB(query, limit = 20) { ... }
// export async function searchOpenFoodFacts(query, limit = 20) { ... }
// export async function searchFoodsHybrid(query) { ... }

/** @deprecated Use searchFoodsLocal */
export async function searchFoodsHybrid(query) {
  return searchFoodsLocal(query)
}
