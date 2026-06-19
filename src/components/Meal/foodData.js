// calories/protein/carbs/fat/fiber/sugar = per 100 g
// units: { "Label": multiplier }  →  total = food.calories × multiplier × qty
// tags: dietary/allergen flags used by health engine and alternatives filter

import { SEED_DB } from '../../utils/foodDatabase.js'

const CORE_DB = [
  {
    id: 1, name: 'Izgara Köfte',
    calories: 200, protein: 18, carbs: 2, fat: 14,
    units: { Gram: 0.01, Adet: 0.35, Porsiyon: 1.5 },
    tags: ['Glutensiz', 'Laktozsuz', 'Kuruyemişsiz', 'Deniz Ürünsüz'],
  },
  {
    id: 2, name: 'Tavuk Göğsü (Izgara)',
    calories: 165, protein: 31, carbs: 0, fat: 3.6,
    units: { Gram: 0.01, Porsiyon: 1.5 },
    tags: ['Glutensiz', 'Laktozsuz', 'Kuruyemişsiz', 'Deniz Ürünsüz', 'Yüksek Protein', 'Keto'],
  },
  {
    id: 3, name: 'Yulaf Ezmesi',
    calories: 389, protein: 16.9, carbs: 66, fat: 6.9,
    units: { Gram: 0.01, 'Yemek Kaşığı': 0.15, Kase: 0.5 },
    tags: ['Vegan', 'Vejetaryen', 'Laktozsuz', 'Kuruyemişsiz', 'Deniz Ürünsüz', 'Yüksek Lif'],
  },
  {
    id: 4, name: 'Mercimek Çorbası',
    calories: 56, protein: 3.8, carbs: 8.7, fat: 1.2,
    units: { Gram: 0.01, Kepçe: 1.0, Kase: 2.5 },
    tags: ['Vegan', 'Vejetaryen', 'Glutensiz', 'Laktozsuz', 'Kuruyemişsiz', 'Deniz Ürünsüz', 'Yüksek Lif', 'Düşük GI', 'Akdeniz'],
  },
  {
    id: 5, name: 'Tam Buğday Ekmek',
    calories: 247, protein: 13, carbs: 41, fat: 3.4,
    units: { Gram: 0.01, Dilim: 0.35 },
    tags: ['Vegan', 'Vejetaryen', 'Laktozsuz', 'Kuruyemişsiz', 'Deniz Ürünsüz', 'Yüksek Lif'],
  },
  {
    id: 6, name: 'Haşlanmış Yumurta',
    calories: 155, protein: 13, carbs: 1.1, fat: 11,
    units: { Gram: 0.01, Adet: 0.5 },
    tags: ['Vejetaryen', 'Glutensiz', 'Laktozsuz', 'Kuruyemişsiz', 'Deniz Ürünsüz', 'Yüksek Protein', 'Keto'],
  },
  {
    id: 7, name: 'Pirinç Pilavı',
    calories: 130, protein: 2.7, carbs: 28, fat: 0.3,
    units: { Gram: 0.01, 'Yemek Kaşığı': 0.15, Porsiyon: 1.5 },
    tags: ['Vegan', 'Vejetaryen', 'Glutensiz', 'Laktozsuz', 'Kuruyemişsiz', 'Deniz Ürünsüz'],
  },
  {
    id: 8, name: 'Kuru Fasulye',
    calories: 140, protein: 9, carbs: 23, fat: 1.5,
    units: { Gram: 0.01, 'Yemek Kaşığı': 0.15, Porsiyon: 2.0 },
    tags: ['Vegan', 'Vejetaryen', 'Glutensiz', 'Laktozsuz', 'Kuruyemişsiz', 'Deniz Ürünsüz', 'Yüksek Lif', 'Düşük GI'],
  },
  {
    id: 9, name: 'Zeytinyağlı Salata',
    calories: 80, protein: 1.5, carbs: 4, fat: 7,
    units: { Gram: 0.01, Kase: 1.5 },
    tags: ['Vegan', 'Vejetaryen', 'Akdeniz', 'Glutensiz', 'Laktozsuz', 'Kuruyemişsiz', 'Deniz Ürünsüz'],
  },
  {
    id: 10, name: 'Tam Yağlı Süt',
    calories: 61, protein: 3.2, carbs: 4.8, fat: 3.3,
    units: { Mililitre: 0.01, 'Su Bardağı': 2.0 },
    tags: ['Vejetaryen', 'Glutensiz', 'Kuruyemişsiz', 'Deniz Ürünsüz'],
  },
  {
    id: 11, name: 'Somon (Izgara)',
    calories: 208, protein: 20, carbs: 0, fat: 13,
    units: { Gram: 0.01, Porsiyon: 1.5 },
    tags: ['Glutensiz', 'Laktozsuz', 'Kuruyemişsiz', 'Akdeniz', 'Keto', 'Yüksek Protein'],
  },
  {
    id: 12, name: 'Kinoa',
    calories: 120, protein: 4.4, carbs: 21, fat: 1.9,
    units: { Gram: 0.01, 'Yemek Kaşığı': 0.15, Kase: 1.5 },
    tags: ['Vegan', 'Vejetaryen', 'Glutensiz', 'Laktozsuz', 'Kuruyemişsiz', 'Deniz Ürünsüz', 'Yüksek Protein', 'Düşük GI'],
  },
  {
    id: 13, name: 'Avokado',
    calories: 160, protein: 2, carbs: 9, fat: 15,
    units: { Gram: 0.01, Adet: 1.5 },
    tags: ['Vegan', 'Vejetaryen', 'Keto', 'Akdeniz', 'Glutensiz', 'Laktozsuz', 'Kuruyemişsiz', 'Deniz Ürünsüz'],
  },
  {
    id: 14, name: 'Yoğurt (Tam Yağlı)',
    calories: 61, protein: 3.5, carbs: 4.7, fat: 3.3,
    units: { Gram: 0.01, Kase: 1.5 },
    tags: ['Vejetaryen', 'Glutensiz', 'Kuruyemişsiz', 'Deniz Ürünsüz', 'Yüksek Protein'],
  },
  {
    id: 15, name: 'Nohut (Haşlanmış)',
    calories: 164, protein: 8.9, carbs: 27, fat: 2.6,
    units: { Gram: 0.01, 'Yemek Kaşığı': 0.15, Kase: 1.5 },
    tags: ['Vegan', 'Vejetaryen', 'Glutensiz', 'Laktozsuz', 'Kuruyemişsiz', 'Deniz Ürünsüz', 'Yüksek Lif', 'Düşük GI', 'Akdeniz'],
  },
  {
    id: 16, name: 'Badem',
    calories: 579, protein: 21, carbs: 22, fat: 50,
    units: { Gram: 0.01, Adet: 0.012 },
    tags: ['Vegan', 'Vejetaryen', 'Keto', 'Glutensiz', 'Laktozsuz', 'Deniz Ürünsüz', 'Yüksek Protein'],
  },
  {
    id: 17, name: 'Ispanak (Çiğ)',
    calories: 23, protein: 2.9, carbs: 3.6, fat: 0.4,
    units: { Gram: 0.01, Kase: 0.4 },
    tags: ['Vegan', 'Vejetaryen', 'Akdeniz', 'Glutensiz', 'Laktozsuz', 'Kuruyemişsiz', 'Deniz Ürünsüz', 'Yüksek Lif'],
  },
  {
    id: 18, name: 'Tatlı Patates',
    calories: 86, protein: 1.6, carbs: 20, fat: 0.1,
    units: { Gram: 0.01, Adet: 1.2 },
    tags: ['Vegan', 'Vejetaryen', 'Glutensiz', 'Laktozsuz', 'Kuruyemişsiz', 'Deniz Ürünsüz', 'Yüksek Lif', 'Düşük GI'],
  },
  {
    id: 19, name: 'Lor Peyniri',
    calories: 98, protein: 11, carbs: 3.4, fat: 4.3,
    units: { Gram: 0.01, 'Yemek Kaşığı': 0.15 },
    tags: ['Vejetaryen', 'Glutensiz', 'Kuruyemişsiz', 'Deniz Ürünsüz', 'Yüksek Protein'],
  },
  {
    id: 20, name: 'Zeytinyağı',
    calories: 884, protein: 0, carbs: 0, fat: 100, fiber: 0, sugar: 0,
    units: { Mililitre: 0.01, 'Yemek Kaşığı': 0.15 },
    tags: ['Vegan', 'Vejetaryen', 'Keto', 'Akdeniz', 'Glutensiz', 'Laktozsuz', 'Kuruyemişsiz', 'Deniz Ürünsüz'],
  },
]

// Merged database: core items + rich Turkish seed database
export const FOOD_DB = [...CORE_DB, ...SEED_DB]

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

export function calcPreview(food, unitName, qty) {
  if (!food || !unitName || !qty) return null
  const mult = food.units[unitName]
  if (!mult) return null
  const q = Number(qty)
  if (q <= 0) return null
  const factor = mult * q
  return {
    kcal:    Math.round(food.calories * factor),
    protein: Math.round(food.protein  * factor * 10) / 10,
    carbs:   Math.round(food.carbs    * factor * 10) / 10,
    fat:     Math.round(food.fat      * factor * 10) / 10,
    grams:   Math.round(mult * q * 100),
  }
}
