// calories/protein/carbs/fat = per 100 g
// units: { "Label": multiplier }  →  total = food.calories × multiplier × qty

export const FOOD_DB = [
  { id: 1,  name: 'Izgara Köfte',         calories: 200, protein: 18,   carbs: 2,    fat: 14,  units: { Gram: 0.01, Adet: 0.35, Porsiyon: 1.5  } },
  { id: 2,  name: 'Tavuk Göğsü (Izgara)', calories: 165, protein: 31,   carbs: 0,    fat: 3.6, units: { Gram: 0.01, Porsiyon: 1.5               } },
  { id: 3,  name: 'Yulaf Ezmesi',         calories: 389, protein: 16.9, carbs: 66,   fat: 6.9, units: { Gram: 0.01, 'Yemek Kaşığı': 0.15, Kase: 0.5 } },
  { id: 4,  name: 'Mercimek Çorbası',     calories: 56,  protein: 3.8,  carbs: 8.7,  fat: 1.2, units: { Gram: 0.01, Kepçe: 1.0, Kase: 2.5        } },
  { id: 5,  name: 'Tam Buğday Ekmek',     calories: 247, protein: 13,   carbs: 41,   fat: 3.4, units: { Gram: 0.01, Dilim: 0.35                  } },
  { id: 6,  name: 'Haşlanmış Yumurta',    calories: 155, protein: 13,   carbs: 1.1,  fat: 11,  units: { Gram: 0.01, Adet: 0.5                    } },
  { id: 7,  name: 'Pirinç Pilavı',        calories: 130, protein: 2.7,  carbs: 28,   fat: 0.3, units: { Gram: 0.01, 'Yemek Kaşığı': 0.15, Porsiyon: 1.5 } },
  { id: 8,  name: 'Kuru Fasulye',         calories: 140, protein: 9,    carbs: 23,   fat: 1.5, units: { Gram: 0.01, 'Yemek Kaşığı': 0.15, Porsiyon: 2.0 } },
  { id: 9,  name: 'Zeytinyağlı Salata',   calories: 80,  protein: 1.5,  carbs: 4,    fat: 7,   units: { Gram: 0.01, Kase: 1.5                    } },
  { id: 10, name: 'Tam Yağlı Süt',        calories: 61,  protein: 3.2,  carbs: 4.8,  fat: 3.3, units: { Mililitre: 0.01, 'Su Bardağı': 2.0        } },
]

export const MEAL_TYPES = ['Kahvaltı', 'Öğle', 'Akşam', 'Ara Öğün']

// ─── Health impact engine ─────────────────────────────────────────────────────
const GLUTEN_IDS  = [5]
const HIGH_GI_IDS = [3, 7]
const FIBER_IDS   = [4, 8]
const HEART_IDS   = [9, 4]

export function checkHealthImpact(basket, profile) {
  const conditions = profile?.healthConditions ?? []
  const warnings = [], positives = []
  if (basket.length === 0) return { warnings, positives }

  const totC = basket.reduce((s, i) => s + i.carbs,   0)
  const totF = basket.reduce((s, i) => s + i.fat,     0)
  const totP = basket.reduce((s, i) => s + i.protein, 0)

  if (conditions.includes('colyak')) {
    const gItem = basket.find(i => GLUTEN_IDS.includes(i.foodId))
    if (gItem) warnings.push({ level: 'critical', text: `${gItem.foodName} gluten içeriyor. Çölyak hastalığınız nedeniyle bu gıdadan kaçının!` })
  }

  if (conditions.includes('diyabet')) {
    if (totC > 60) {
      warnings.push({ level: 'warning', text: `Toplam karbonhidrat (${Math.round(totC)}g) yüksek. Bu öğün kan şekerinizi hızla yükseltebilir.` })
    } else {
      const hiGi = basket.find(i => HIGH_GI_IDS.includes(i.foodId))
      if (hiGi) warnings.push({ level: 'warning', text: `${hiGi.foodName} yüksek glisemik indekse sahip. Porsiyon kontrolüne dikkat edin.` })
    }
    if (totC < 30 && totP > 20) {
      positives.push({ text: 'Düşük karbonhidrat ve yüksek protein — diyabet yönetimi için dengeli seçim.' })
    }
  }

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

export function getSuggestedAlternatives(basket) {
  const usedIds  = basket.map(i => i.foodId)
  const totCarbs = basket.reduce((s, i) => s + i.carbs, 0)
  const totFat   = basket.reduce((s, i) => s + i.fat,   0)

  let pool
  if (totCarbs > 50)      pool = FOOD_DB.filter(f => !usedIds.includes(f.id) && f.carbs < 5  && f.protein > 10)
  else if (totFat > 20)   pool = FOOD_DB.filter(f => !usedIds.includes(f.id) && f.fat   < 5)
  else                    pool = FOOD_DB.filter(f => !usedIds.includes(f.id) && [4, 8].includes(f.id))

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
