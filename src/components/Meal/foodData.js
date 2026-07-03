// calories/protein/carbs/fat/fiber/sugar = per 100 g (internal base)
// units: { "Label": multiplier }  →  total = food.calories × multiplier × qty
// tags: dietary/allergen flags used by health engine and alternatives filter

export { FOOD_DB } from '../../utils/foodDatabase.js'
import { FOOD_DB } from '../../utils/foodDatabase.js'

export const MEAL_TYPES = ['Kahvaltı', 'Öğle', 'Akşam', 'Ara Öğün']

// ─── Food ID sets for health engine ──────────────────────────────────────────
const GLUTEN_IDS    = [5]
const HIGH_GI_IDS   = [3, 7]
const FIBER_IDS     = [4, 8, 15, 17, 18]
const HEART_IDS     = [9, 4, 13, 11]
const LACTOSE_IDS   = [10, 14]
const NUT_IDS       = [16]

// ─── Health impact engine ─────────────────────────────────────────────────────

export function checkHealthImpact(basket, profile) {
  const conditions     = profile?.healthConditions ?? []
  const allergies      = profile?.allergies       ?? []
  const medicalHistory = profile?.medicalHistory  ?? []
  const warnings = [], positives = []
  if (basket.length === 0) return { warnings, positives }

  const totC = basket.reduce((s, i) => s + i.carbs,   0)
  const totF = basket.reduce((s, i) => s + i.fat,     0)
  const totP = basket.reduce((s, i) => s + i.protein, 0)

  // Gluten — colyak (legacy) or gluten allergy (new)
  const hasGlutenRestriction = conditions.includes('colyak') || allergies.includes('gluten')
  if (hasGlutenRestriction) {
    const gItem = basket.find(i => GLUTEN_IDS.includes(i.foodId))
    if (gItem) warnings.push({ level: 'critical', text: `${gItem.foodName} gluten içeriyor. Gluten intoleransınız nedeniyle bu gıdadan kaçının!` })
  }

  // Lactose — laktoz (legacy/new)
  const hasLactoseIntolerance = conditions.includes('laktoz') || allergies.includes('laktoz')
  if (hasLactoseIntolerance) {
    basket.filter(i => LACTOSE_IDS.includes(i.foodId)).forEach(item => {
      warnings.push({ level: 'warning', text: `${item.foodName} laktoz içeriyor. Laktoz intoleransınız nedeniyle dikkatli olun.` })
    })
  }

  // Nut allergy
  const hasNutAllergy = conditions.includes('kuruyemis') || allergies.includes('kuruyemis')
  if (hasNutAllergy) {
    const nutItem = basket.find(i => NUT_IDS.includes(i.foodId))
    if (nutItem) warnings.push({ level: 'critical', text: `${nutItem.foodName} kuruyemiş içeriyor. Alerjiniz nedeniyle bu gıdadan kaçının!` })
  }

  // Diabetes / insulin resistance
  const hasDiabetes =
    conditions.includes('diyabet') ||
    medicalHistory.includes('diyabet_tip1') ||
    medicalHistory.includes('diyabet_tip2') ||
    medicalHistory.includes('insulin_direnci')

  if (hasDiabetes) {
    if (totC > 60) {
      warnings.push({ level: 'warning', text: `Toplam karbonhidrat (${Math.round(totC)}g) yüksek. Bu öğün kan şekerinizi hızla yükseltebilir.` })
    } else {
      const hiGi = basket.find(i => HIGH_GI_IDS.includes(i.foodId))
      if (hiGi) warnings.push({ level: 'warning', text: `${hiGi.foodName} yüksek glisemik indekse sahip. Porsiyon kontrolüne dikkat edin.` })
    }
    if (totC < 30 && totP > 20) {
      positives.push({ text: 'Düşük karbonhidrat ve yüksek protein — kan şekeri yönetimi için dengeli seçim.' })
    }
  }

  // Hypertension
  if (conditions.includes('tansiyon')) {
    if (totF > 25) warnings.push({ level: 'warning', text: `Yüksek yağ içeriği (${Math.round(totF)}g) tansiyonunuzu olumsuz etkileyebilir.` })
    const hItem = basket.find(i => HEART_IDS.includes(i.foodId))
    if (hItem) positives.push({ text: `${hItem.foodName} kalp sağlığını destekleyen yağlar içeriyor.` })
  }

  if (basket.some(i => FIBER_IDS.includes(i.foodId))) {
    positives.push({ text: 'Lif açısından zengin gıda içeriyor — sindirim sağlığı için faydalı.' })
  }
  if (totP > 25 && totF < 15 && totC < 40) {
    positives.push({ text: 'Dengeli makro profil. Sağlıklı Seçim!' })
  }

  return { warnings, positives }
}

// ─── Tag-aware alternative suggestions ───────────────────────────────────────

export function getSuggestedAlternatives(basket, profile) {
  if (!basket?.length) return []

  const usedIds       = basket.map(i => i.foodId)
  const totCarbs      = basket.reduce((s, i) => s + i.carbs, 0)
  const totFat        = basket.reduce((s, i) => s + i.fat,   0)
  const allergies     = profile?.allergies      ?? []
  const medicalHistory= profile?.medicalHistory ?? []
  const dietPhilosophy= profile?.dietPhilosophy ?? 'standart'

  // Exclude foods that conflict with the user's profile
  let pool = FOOD_DB.filter(f => {
    if (usedIds.includes(f.id)) return false
    if (allergies.includes('gluten')          && !f.tags.includes('Glutensiz'))     return false
    if (allergies.includes('laktoz')          && !f.tags.includes('Laktozsuz'))     return false
    if (allergies.includes('kuruyemis')       && !f.tags.includes('Kuruyemişsiz'))  return false
    if (allergies.includes('deniz_urunleri')  && !f.tags.includes('Deniz Ürünsüz'))return false
    if (dietPhilosophy === 'vegan'            && !f.tags.includes('Vegan'))         return false
    if (dietPhilosophy === 'vejetaryen'       && !f.tags.includes('Vejetaryen'))    return false
    if (dietPhilosophy === 'keto'             && !f.tags.includes('Keto'))          return false
    const needsLowGI =
      medicalHistory.includes('diyabet_tip1') ||
      medicalHistory.includes('diyabet_tip2') ||
      medicalHistory.includes('insulin_direnci')
    if (needsLowGI && f.tags.includes('Yüksek GI')) return false
    return true
  })

  // Nutritional preference
  if (totCarbs > 50)    pool = pool.filter(f => f.carbs < 5 && f.protein > 10)
  else if (totFat > 20) pool = pool.filter(f => f.fat < 5)
  else                  pool = pool.filter(f => f.tags.includes('Yüksek Lif') || f.tags.includes('Düşük GI'))

  // Fallback: any safe food
  if (pool.length === 0) pool = FOOD_DB.filter(f => !usedIds.includes(f.id))

  return pool.slice(0, 2)
}

/** Parse user-entered quantity strings (supports comma decimals). */
export function parseQuantity(val) {
  if (val === '' || val === null || val === undefined) return NaN
  const n = parseFloat(String(val).trim().replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}

export function calcPreview(food, unitName, qty, gramsPerUnit = null) {
  if (!food || !unitName || qty === '' || qty === null || qty === undefined) return null
  const q = parseQuantity(qty)
  if (!Number.isFinite(q) || q <= 0) return null

  const isMassUnit = unitName === 'Gram' || unitName === 'Mililitre'
  const mult = food.units?.[unitName]
  let totalGrams

  if (isMassUnit) {
    totalGrams = q
  } else if (mult != null && Number.isFinite(mult)) {
    totalGrams = mult * q * 100
  } else {
    const gpu = parseQuantity(gramsPerUnit)
    if (!Number.isFinite(gpu) || gpu <= 0) return null
    totalGrams = q * gpu
  }

  const factor = totalGrams / 100
  return {
    kcal:    Math.round(food.calories * factor),
    protein: Math.round(food.protein  * factor * 10) / 10,
    carbs:   Math.round(food.carbs    * factor * 10) / 10,
    fat:     Math.round(food.fat      * factor * 10) / 10,
    grams:   Math.round(totalGrams),
  }
}

/** True when unit needs a custom gram-weight input (no built-in multiplier). */
export function unitNeedsGramInput(unitName, food = null) {
  if (!unitName || unitName === 'Gram' || unitName === 'Mililitre') return false
  if (food?.units?.[unitName] != null) return false
  return true
}
