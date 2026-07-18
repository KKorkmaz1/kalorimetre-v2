/**
 * Generate core_food_verification_priority.csv from MASTER_FOOD_DB.
 * Run: node scripts/generateCoreFoodVerificationPriority.mjs
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { MASTER_FOOD_DB, toLegacyFood } from '../src/utils/foodDatabase.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT_CSV = join(__dirname, 'output', 'core_food_verification_priority.csv')

/** Priority foods: id → { name_en, priority_reason } */
const CORE_PRIORITY = {
  45: { name_en: 'Apple', priority_reason: 'Yüksek frekanslı temel meyve; lif/şeker/sodyum doğrulanmalı' },
  46: { name_en: 'Banana', priority_reason: 'Yüksek frekanslı temel meyve; lif/şeker/sodyum doğrulanmalı' },
  53: { name_en: 'Watermelon', priority_reason: 'Yaz meyvesi; sık loglanan temel gıda' },
  143: { name_en: 'Lemon', priority_reason: 'Sık kullanılan temel meyve/sebze' },
  65: { name_en: 'Tomato', priority_reason: 'Temel sebze; çiğ hali USDA ile eşleşmeli' },
  66: { name_en: 'Cucumber', priority_reason: 'Temel sebze; çiğ hali USDA ile eşleşmeli' },
  76: { name_en: 'Potato boiled', priority_reason: 'Temel nişasta kaynağı; pişmiş/çiğ durumu netleştirilmeli' },
  71: { name_en: 'Zucchini', priority_reason: 'İsim düzeltildi; makrolar kaynakla doğrulanmalı' },
  153: { name_en: 'Garlic raw', priority_reason: 'Makro değerleri şüpheli; porsiyon/100g kontrolü gerekli' },
  3: { name_en: 'Oats dry', priority_reason: 'Kahvaltı temel gıdası; önceki USDA adayı bebek mamasıydı' },
  99: { name_en: 'White bread', priority_reason: 'Günlük ekmek tüketimi; USDA adayı mevcut' },
  5: { name_en: 'Whole wheat bread', priority_reason: 'Sağlıklı ekmek alternatifi; kaynak eşleşmesi gerekli' },
  7: { name_en: 'Rice pilaf', priority_reason: 'Pirinç türevi — tarif/TürKomp veya pişmiş pirinç USDA adayı gerekli' },
  33: { name_en: 'Bulgur pilaf', priority_reason: 'Bulgur türevi — tarif/TürKomp veya kuru/pişmiş bulgur USDA adayı gerekli' },
  34: { name_en: 'Pasta cooked', priority_reason: 'Temel tahıl; haşlanmış makarna USDA eşleşmesi gerekli' },
  6: { name_en: 'Egg boiled', priority_reason: 'Yüksek frekanslı protein kaynağı' },
  173: { name_en: 'Egg raw whole', priority_reason: 'Çiğ yumurta referansı; USDA adayı güçlü' },
  2: { name_en: 'Chicken breast grilled', priority_reason: 'En sık loglanan protein kaynaklarından' },
  238: { name_en: 'Fish grilled', priority_reason: 'Genel balık referansı; tür bazlı doğrulama gerekebilir' },
  84: { name_en: 'Tuna canned in water', priority_reason: 'Konserve balık; USDA adayı mevcut' },
  14: { name_en: 'Yogurt whole milk', priority_reason: 'Temel süt ürünü; bebek maması adayları reddedilmeli' },
  10: { name_en: 'Milk whole', priority_reason: 'Temel süt; tam yağlı süt USDA eşleşmesi gerekli' },
  37: { name_en: 'Ayran', priority_reason: 'Türk içeceği; yoğurt+süt bazlı kaynak veya tarif gerekli' },
  22: { name_en: 'White cheese feta', priority_reason: 'Temel peynir; USDA beyaz peynir adayı mevcut' },
  93: { name_en: 'Kashar cheese', priority_reason: 'Sık tüketilen peynir; USDA eşleşmesi gerekli' },
  20: { name_en: 'Olive oil', priority_reason: 'Temel yağ kaynağı; USDA adayı güçlü' },
  16: { name_en: 'Almond', priority_reason: 'Temel kuruyemiş; porsiyon/100g ölçekleme kontrolü gerekli' },
  105: { name_en: 'Walnut', priority_reason: 'Temel kuruyemiş; USDA ceviz adayı mevcut' },
  106: { name_en: 'Hazelnut', priority_reason: 'Temel kuruyemiş; fındık kreması adayları reddedilmeli' },
  15: { name_en: 'Chickpeas boiled', priority_reason: 'Temel baklagil; çiğ/haşlanmış durum farkı kritik' },
  188: { name_en: 'Red lentils boiled', priority_reason: 'Temel mercimek; haşlanmış kırmızı mercimek USDA eşleşmesi gerekli' },
  189: { name_en: 'Green lentils boiled', priority_reason: 'Temel mercimek; haşlanmış yeşil mercimek USDA eşleşmesi gerekli' },
  8: { name_en: 'White beans', priority_reason: 'Temel baklagil; çiğ/haşlanmış durum farkı kritik' },
  49: { name_en: 'Orange', priority_reason: 'Yüksek frekanslı turunçgil' },
  51: { name_en: 'Strawberry', priority_reason: 'Yaygın meyve; çiğ çilek USDA adayı güçlü' },
  55: { name_en: 'Pear', priority_reason: 'Yaygın meyve' },
  17: { name_en: 'Spinach raw', priority_reason: 'Temel yeşil sebze; çiğ ıspanak USDA adayı güçlü' },
  68: { name_en: 'Carrot', priority_reason: 'Temel kök sebze' },
  69: { name_en: 'Broccoli boiled', priority_reason: 'Sık tüketilen sebze; haşlanmış brokoli USDA adayı güçlü' },
  75: { name_en: 'White mushroom raw', priority_reason: 'Temel sebze; çiğ mantar USDA adayı güçlü' },
  67: { name_en: 'Lettuce', priority_reason: 'Salata temel bileşeni' },
  11: { name_en: 'Salmon grilled', priority_reason: 'Yaygın balık protein kaynağı' },
  152: { name_en: 'Onion raw', priority_reason: 'Temel mutfak bileşeni; çiğ soğan USDA adayı güçlü' },
  124: { name_en: 'Hummus', priority_reason: 'Akdeniz temel gıdası; USDA humus adayı mevcut' },
  13: { name_en: 'Avocado', priority_reason: 'Yaygın meyve; çiğ avokado USDA adayı mevcut' },
  18: { name_en: 'Sweet potato', priority_reason: 'Temel nişasta kaynağı' },
  77: { name_en: 'Corn boiled', priority_reason: 'Yaygın sebze/tahıl' },
  73: { name_en: 'Bell pepper', priority_reason: 'Temel sebze' },
  130: { name_en: 'Black olive', priority_reason: 'Akdeniz temel gıdası' },
  12: { name_en: 'Quinoa', priority_reason: 'Yaygın tam tahıl alternatifi' },
}

const COLUMNS = [
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
  'review_status',
  'priority_reason',
]

function csvCell(value) {
  if (value === null || value === undefined) return ''
  const text = String(value)
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

function formatNumber(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) return '0'
  return String(Number(num.toFixed(4)))
}

function main() {
  const foodsById = new Map(MASTER_FOOD_DB.map((f) => [f.id, f]))
  const rows = []

  for (const [idStr, meta] of Object.entries(CORE_PRIORITY)) {
    const id = Number(idStr)
    const food = foodsById.get(id)
    if (!food) {
      console.warn(`Skipping missing food id ${id}`)
      continue
    }

    const legacy = toLegacyFood(food)
    rows.push({
      food_id: id,
      name_tr: food.name,
      name_en: meta.name_en,
      category_tr: food.category ?? '',
      current_calories_100g: formatNumber(legacy.calories),
      current_protein_100g: formatNumber(legacy.protein),
      current_carbs_100g: formatNumber(legacy.carbs),
      current_fat_100g: formatNumber(legacy.fat),
      current_fiber_100g: formatNumber(food.fiber ?? 0),
      current_sugar_100g: formatNumber(food.sugar ?? 0),
      current_sodium_mg_100g: formatNumber(food.sodium ?? 0),
      review_status: food.review?.review_status ?? 'pending_verification',
      priority_reason: meta.priority_reason,
    })
  }

  rows.sort((a, b) => a.food_id - b.food_id)

  mkdirSync(dirname(OUTPUT_CSV), { recursive: true })
  const csv = [
    COLUMNS.join(','),
    ...rows.map((row) => COLUMNS.map((col) => csvCell(row[col])).join(',')),
  ].join('\n')

  writeFileSync(OUTPUT_CSV, `${csv}\n`, 'utf8')
  console.log(`Wrote ${rows.length} priority foods → ${OUTPUT_CSV}`)
}

main()
