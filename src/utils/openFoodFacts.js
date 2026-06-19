const API_BASE = 'https://world.openfoodfacts.org/api/v0/product'

/**
 * Fetch raw product JSON from OpenFoodFacts by barcode.
 * @param {string} barcode
 */
export async function fetchProductByBarcode(barcode) {
  const code = String(barcode).trim()
  if (!code) throw new Error('Geçersiz barkod.')

  const res = await fetch(`${API_BASE}/${encodeURIComponent(code)}.json`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

/** Extract real package weight (grams) from OpenFoodFacts product object. */
export function extractPackageGrams(p) {
  if (p.product_quantity) {
    const val = parseFloat(p.product_quantity)
    if (!isNaN(val) && val > 0 && val <= 10000) return Math.round(val)
  }
  if (p.quantity) {
    const m = String(p.quantity).match(/([\d.,]+)\s*(g|kg|ml|cl|l)\b/i)
    if (m) {
      let val = parseFloat(m[1].replace(',', '.'))
      const u = m[2].toLowerCase()
      if (u === 'kg') val *= 1000
      else if (u === 'l') val *= 1000
      else if (u === 'cl') val *= 10
      if (!isNaN(val) && val > 0 && val <= 10000) return Math.round(val)
    }
  }
  if (p.net_weight_value) {
    let val = parseFloat(p.net_weight_value)
    const u = (p.net_weight_unit || '').toLowerCase()
    if (!isNaN(val) && val > 0) {
      if (u === 'kg') val *= 1000
      if (!isNaN(val) && val <= 10000) return Math.round(val)
    }
  }
  return null
}

/**
 * Parse OpenFoodFacts API response into normalized per-100g nutrition fields.
 * Returns null when the product is not found in the database.
 */
export function parseOpenFoodFactsProduct(data) {
  if (data.status !== 1 || !data.product) return null

  const p = data.product
  const n = p.nutriments || {}
  const kcal100 = Math.round(
    n['energy-kcal_100g'] ??
    (n['energy-kj_100g'] ? n['energy-kj_100g'] / 4.184 : 0)
  )

  return {
    name: (p.product_name_tr || p.product_name || '').trim() || 'Bilinmeyen Ürün',
    kcal100,
    protein100: Math.round((n['proteins_100g'] || 0) * 10) / 10,
    carbs100:   Math.round((n['carbohydrates_100g'] || 0) * 10) / 10,
    fat100:     Math.round((n['fat_100g'] || 0) * 10) / 10,
    fiber100:   Math.round((n['fiber_100g'] || 0) * 10) / 10,
    sugar100:   Math.round((n['sugars_100g'] || 0) * 10) / 10,
    packageGrams: extractPackageGrams(p),
  }
}

/**
 * Fetch and parse a product in one call.
 * @returns {{ found: true, product: object } | { found: false }}
 */
export async function lookupBarcode(barcode) {
  const data = await fetchProductByBarcode(barcode)
  const product = parseOpenFoodFactsProduct(data)
  if (!product) return { found: false }
  return { found: true, product }
}
