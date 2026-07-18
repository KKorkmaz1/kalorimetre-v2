/**
 * Generate food_wishlist_400_candidates.csv — names/metadata only, no nutrition values.
 * Run: node scripts/generateFoodWishlist400.mjs
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT = join(__dirname, 'output', 'food_wishlist_400_candidates.csv')

const HEADERS = [
  'candidate_id',
  'name_tr',
  'name_en',
  'category_tr',
  'category_en',
  'target_state',
  'default_portion_label_tr',
  'default_portion_grams',
  'search_keywords_en',
  'search_keywords_tr',
  'preferred_source',
  'source_priority',
  'notes',
]

function csvCell(value) {
  if (value === null || value === undefined) return ''
  const text = String(value)
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

function row(c) {
  return HEADERS.map((h) => csvCell(c[h])).join(',')
}

/** @param {Partial<Record<string, string|number>> & { tr: string, en: string }} item */
function item(id, category, item) {
  const [catTr, catEn] = category
  return {
    candidate_id: id,
    name_tr: item.tr,
    name_en: item.en,
    category_tr: catTr,
    category_en: catEn,
    target_state: item.state ?? 'any',
    default_portion_label_tr: item.portion ?? '1 Porsiyon',
    default_portion_grams: item.grams ?? 100,
    search_keywords_en: item.kwEn ?? item.en,
    search_keywords_tr: item.kwTr ?? item.tr,
    preferred_source: item.source ?? 'USDA',
    source_priority: item.priority ?? 1,
    notes: item.notes ?? '',
  }
}

const BEV = ['İçecek', 'Beverage']
const FRU = ['Meyve', 'Fruit']
const VEG = ['Sebze', 'Vegetable']
const MEAT = ['Et / Tavuk / Balık', 'Meat Poultry Fish']
const DAIRY = ['Süt Ürünleri', 'Dairy']
const GRAIN = ['Tahıl / Ekmek / Makarna', 'Grains Bread Pasta']
const LEG = ['Baklagiller', 'Legumes']
const NUT = ['Kuruyemiş', 'Nuts & Seeds']
const OIL = ['Yağlar', 'Oils & Fats']
const TR = ['Türk Ev Yemekleri', 'Turkish Home Cooking']
const SOUP = ['Çorba', 'Soup']
const BRKF = ['Kahvaltılık', 'Breakfast']
const SNACK = ['Atıştırmalık', 'Snack']
const SWEET = ['Tatlı', 'Dessert']

const entries = []

// ── Beverages (~110) — priority ─────────────────────────────────────────────
const beverages = [
  item('wl_001', BEV, { tr: 'Su', en: 'Water', state: 'plain', portion: '1 Su Bardağı', grams: 200, source: 'MANUAL_REVIEW', notes: 'Zero-calorie baseline; manual confirm' }),
  item('wl_002', BEV, { tr: 'Maden Suyu (Sade)', en: 'Plain mineral water', state: 'plain', portion: '1 Şişe', grams: 200, source: 'OPEN_FOOD_FACTS', notes: 'Packaged; mineral content varies' }),
  item('wl_003', BEV, { tr: 'Soda (Sade)', en: 'Club soda', state: 'plain', portion: '1 Şişe', grams: 200, source: 'OPEN_FOOD_FACTS', notes: 'Carbonated water' }),
  item('wl_004', BEV, { tr: 'Türk Çayı (Şekersiz)', en: 'Black tea unsweetened', state: 'unsweetened', portion: '1 Çay Bardağı', grams: 100, kwEn: 'tea brewed unsweetened', kwTr: 'çay demlenmiş şekersiz' }),
  item('wl_005', BEV, { tr: 'Türk Çayı (Şekerli)', en: 'Black tea with sugar', state: 'sweetened', source: 'TURKOMP_OR_RECIPE', notes: 'Recipe: tea + sugar amount' }),
  item('wl_006', BEV, { tr: 'Yeşil Çay (Şekersiz)', en: 'Green tea unsweetened', state: 'unsweetened', portion: '1 Fincan', grams: 200, kwEn: 'green tea brewed' }),
  item('wl_007', BEV, { tr: 'Bitki Çayı (Şekersiz)', en: 'Herbal tea unsweetened', state: 'unsweetened', source: 'MANUAL_REVIEW', notes: 'Near-zero if unsweetened' }),
  item('wl_008', BEV, { tr: 'Ihlamur Çayı', en: 'Linden tea', state: 'unsweetened', source: 'MANUAL_REVIEW' }),
  item('wl_009', BEV, { tr: 'Papatya Çayı', en: 'Chamomile tea', state: 'unsweetened', source: 'MANUAL_REVIEW' }),
  item('wl_010', BEV, { tr: 'Türk Kahvesi (Sade)', en: 'Turkish coffee unsweetened', state: 'unsweetened', portion: '1 Fincan', grams: 60, kwEn: 'coffee brewed' }),
  item('wl_011', BEV, { tr: 'Filtre Kahve (Sade)', en: 'Brewed coffee black', state: 'unsweetened', portion: '1 Kupa', grams: 240, kwEn: 'coffee brewed black' }),
  item('wl_012', BEV, { tr: 'Espresso', en: 'Espresso', state: 'plain', portion: '1 Shot', grams: 30 }),
  item('wl_013', BEV, { tr: 'Americano', en: 'Americano', state: 'plain', portion: '1 Kupa', grams: 240, source: 'TURKOMP_OR_RECIPE', notes: 'Espresso + water' }),
  item('wl_014', BEV, { tr: 'Latte', en: 'Latte', state: 'prepared', source: 'TURKOMP_OR_RECIPE', notes: 'Milk ratio varies' }),
  item('wl_015', BEV, { tr: 'Cappuccino', en: 'Cappuccino', state: 'prepared', source: 'TURKOMP_OR_RECIPE' }),
  item('wl_016', BEV, { tr: 'Flat White', en: 'Flat white', state: 'prepared', source: 'TURKOMP_OR_RECIPE' }),
  item('wl_017', BEV, { tr: 'Mocha', en: 'Mocha coffee', state: 'prepared', source: 'TURKOMP_OR_RECIPE' }),
  item('wl_018', BEV, { tr: 'Sütlü Türk Kahvesi', en: 'Turkish coffee with milk', state: 'prepared', source: 'TURKOMP_OR_RECIPE' }),
  item('wl_019', BEV, { tr: 'Ayran', en: 'Ayran', state: 'prepared', source: 'TURKOMP_OR_RECIPE', notes: 'Yogurt-water-salt drink' }),
  item('wl_020', BEV, { tr: 'Kefir', en: 'Kefir plain', state: 'plain', kwEn: 'kefir plain' }),
  item('wl_021', BEV, { tr: 'Tam Yağlı Süt', en: 'Whole milk', state: 'whole milk', portion: '1 Su Bardağı', grams: 200, kwEn: 'milk whole' }),
  item('wl_022', BEV, { tr: 'Yarım Yağlı Süt', en: 'Reduced-fat milk', state: 'reduced fat', portion: '1 Su Bardağı', grams: 200, kwEn: 'milk reduced fat 2%' }),
  item('wl_023', BEV, { tr: 'Yağsız Süt', en: 'Skim milk', state: 'skim milk', portion: '1 Su Bardağı', grams: 200, kwEn: 'milk nonfat skim' }),
  item('wl_024', BEV, { tr: 'Laktozsuz Süt', en: 'Lactose-free milk', state: 'plain', source: 'OPEN_FOOD_FACTS', notes: 'Packaged product' }),
  item('wl_025', BEV, { tr: 'Soya Sütü (Şekersiz)', en: 'Unsweetened soy milk', state: 'unsweetened', source: 'OPEN_FOOD_FACTS' }),
  item('wl_026', BEV, { tr: 'Badem Sütü (Şekersiz)', en: 'Unsweetened almond milk', state: 'unsweetened', source: 'OPEN_FOOD_FACTS' }),
  item('wl_027', BEV, { tr: 'Yulaf Sütü (Şekersiz)', en: 'Unsweetened oat milk', state: 'unsweetened', source: 'OPEN_FOOD_FACTS' }),
  item('wl_028', BEV, { tr: 'Hindistan Cevizi Sütü', en: 'Coconut milk beverage', state: 'unsweetened', source: 'OPEN_FOOD_FACTS', notes: 'Drink carton not canned cooking milk' }),
  item('wl_029', BEV, { tr: 'Kakaolu Süt', en: 'Chocolate milk', source: 'OPEN_FOOD_FACTS' }),
  item('wl_030', BEV, { tr: 'Muzlu Süt', en: 'Banana milk', source: 'OPEN_FOOD_FACTS' }),
  item('wl_031', BEV, { tr: 'Portakal Suyu', en: 'Orange juice', state: '100% juice', kwEn: 'orange juice 100%' }),
  item('wl_032', BEV, { tr: 'Elma Suyu', en: 'Apple juice', state: '100% juice', kwEn: 'apple juice 100%' }),
  item('wl_033', BEV, { tr: 'Greyfurt Suyu', en: 'Grapefruit juice', state: '100% juice' }),
  item('wl_034', BEV, { tr: 'Üzüm Suyu', en: 'Grape juice', state: '100% juice' }),
  item('wl_035', BEV, { tr: 'Nar Suyu', en: 'Pomegranate juice', source: 'OPEN_FOOD_FACTS' }),
  item('wl_036', BEV, { tr: 'Vişne Suyu', en: 'Sour cherry juice', source: 'OPEN_FOOD_FACTS' }),
  item('wl_037', BEV, { tr: 'Kayısı Nektarı', en: 'Apricot nectar', source: 'OPEN_FOOD_FACTS' }),
  item('wl_038', BEV, { tr: 'Şeftali Nektarı', en: 'Peach nectar', source: 'OPEN_FOOD_FACTS' }),
  item('wl_039', BEV, { tr: 'Domates Suyu', en: 'Tomato juice', kwEn: 'tomato juice' }),
  item('wl_040', BEV, { tr: 'Havuç Suyu', en: 'Carrot juice', kwEn: 'carrot juice' }),
  item('wl_041', BEV, { tr: 'Limonata (Ev Yapımı)', en: 'Homemade lemonade', source: 'TURKOMP_OR_RECIPE', notes: 'Recipe with sugar' }),
  item('wl_042', BEV, { tr: 'Limonata (Şekersiz)', en: 'Unsweetened lemonade', source: 'TURKOMP_OR_RECIPE' }),
  item('wl_043', BEV, { tr: 'Kola', en: 'Cola', source: 'OPEN_FOOD_FACTS' }),
  item('wl_044', BEV, { tr: 'Kola Zero', en: 'Diet cola', source: 'OPEN_FOOD_FACTS' }),
  item('wl_045', BEV, { tr: 'Gazoz', en: 'Lemon-lime soda', source: 'OPEN_FOOD_FACTS' }),
  item('wl_046', BEV, { tr: 'Ginger Ale', en: 'Ginger ale', source: 'OPEN_FOOD_FACTS' }),
  item('wl_047', BEV, { tr: 'Tonik Su', en: 'Tonic water', source: 'OPEN_FOOD_FACTS' }),
  item('wl_048', BEV, { tr: 'Soğuk Çay', en: 'Iced tea', source: 'OPEN_FOOD_FACTS' }),
  item('wl_049', BEV, { tr: 'Soğuk Kahve', en: 'Iced coffee', source: 'TURKOMP_OR_RECIPE' }),
  item('wl_050', BEV, { tr: 'Enerji İçeceği', en: 'Energy drink', source: 'OPEN_FOOD_FACTS' }),
  item('wl_051', BEV, { tr: 'Spor İçeceği', en: 'Sports drink', source: 'OPEN_FOOD_FACTS' }),
  item('wl_052', BEV, { tr: 'Elektrolit İçeceği', en: 'Electrolyte drink', source: 'OPEN_FOOD_FACTS' }),
  item('wl_053', BEV, { tr: 'Protein Shake (Sütlü)', en: 'Protein shake with milk', source: 'MANUAL_REVIEW', notes: 'Depends on powder + milk' }),
  item('wl_054', BEV, { tr: 'Protein Shake (Su ile)', en: 'Protein shake with water', source: 'MANUAL_REVIEW' }),
  item('wl_055', BEV, { tr: 'Smoothie (Muzlu)', en: 'Banana smoothie', source: 'TURKOMP_OR_RECIPE' }),
  item('wl_056', BEV, { tr: 'Smoothie (Yeşil)', en: 'Green smoothie', source: 'TURKOMP_OR_RECIPE' }),
  item('wl_057', BEV, { tr: 'Smoothie (Çilekli)', en: 'Strawberry smoothie', source: 'TURKOMP_OR_RECIPE' }),
  item('wl_058', BEV, { tr: 'Salep', en: 'Salep', source: 'TURKOMP_OR_RECIPE' }),
  item('wl_059', BEV, { tr: 'Boza', en: 'Boza', source: 'TURKOMP_OR_RECIPE' }),
  item('wl_060', BEV, { tr: 'Şalgam Suyu', en: 'Turnip juice', source: 'TURKOMP_OR_RECIPE' }),
  item('wl_061', BEV, { tr: 'Komposto', en: 'Fruit compote drink', source: 'TURKOMP_OR_RECIPE' }),
  item('wl_062', BEV, { tr: 'Hoşaf', en: 'Dried fruit compote drink', source: 'TURKOMP_OR_RECIPE' }),
  item('wl_063', BEV, { tr: 'Sıcak Çikolata', en: 'Hot chocolate', source: 'TURKOMP_OR_RECIPE' }),
  item('wl_064', BEV, { tr: 'Matcha Latte', en: 'Matcha latte', source: 'TURKOMP_OR_RECIPE' }),
  item('wl_065', BEV, { tr: 'Chai Latte', en: 'Chai latte', source: 'TURKOMP_OR_RECIPE' }),
  item('wl_066', BEV, { tr: 'Bubble Tea', en: 'Bubble tea', source: 'OPEN_FOOD_FACTS' }),
  item('wl_067', BEV, { tr: 'Kombucha', en: 'Kombucha', source: 'OPEN_FOOD_FACTS' }),
  item('wl_068', BEV, { tr: 'Kefir (Meyveli)', en: 'Flavored kefir', source: 'OPEN_FOOD_FACTS' }),
  item('wl_069', BEV, { tr: 'Ayran (Light)', en: 'Light ayran', source: 'OPEN_FOOD_FACTS' }),
  item('wl_070', BEV, { tr: 'Süt (UHT Tam Yağlı)', en: 'UHT whole milk', state: 'whole milk', source: 'OPEN_FOOD_FACTS' }),
  item('wl_071', BEV, { tr: 'Krema (Kahve İçin)', en: 'Coffee creamer', source: 'OPEN_FOOD_FACTS' }),
  item('wl_072', BEV, { tr: 'Buzlu Matcha', en: 'Iced matcha', source: 'TURKOMP_OR_RECIPE' }),
  item('wl_073', BEV, { tr: 'Frappé', en: 'Coffee frappe', source: 'TURKOMP_OR_RECIPE' }),
  item('wl_074', BEV, { tr: 'Meyve Suyu Karışımı', en: 'Mixed fruit juice', source: 'OPEN_FOOD_FACTS' }),
  item('wl_075', BEV, { tr: 'Ananas Suyu', en: 'Pineapple juice', kwEn: 'pineapple juice' }),
  item('wl_076', BEV, { tr: 'Mango Suyu', en: 'Mango juice', kwEn: 'mango juice' }),
  item('wl_077', BEV, { tr: 'Karışık Meyve Nektarı', en: 'Mixed fruit nectar', source: 'OPEN_FOOD_FACTS' }),
  item('wl_078', BEV, { tr: 'Limon Suyu (Sıkma)', en: 'Fresh lemon juice', state: 'raw', kwEn: 'lemon juice raw' }),
  item('wl_079', BEV, { tr: 'Portakal Suyu (Taze Sıkma)', en: 'Fresh squeezed orange juice', state: 'raw', kwEn: 'orange juice fresh' }),
  item('wl_080', BEV, { tr: 'Nar Suyu (Taze)', en: 'Fresh pomegranate juice', source: 'TURKOMP_OR_RECIPE' }),
  item('wl_081', BEV, { tr: 'Soda Limon', en: 'Lemon soda', source: 'OPEN_FOOD_FACTS' }),
  item('wl_082', BEV, { tr: 'Root Beer', en: 'Root beer', source: 'OPEN_FOOD_FACTS' }),
  item('wl_083', BEV, { tr: 'Cola (Şekersiz)', en: 'Sugar-free cola', source: 'OPEN_FOOD_FACTS' }),
  item('wl_084', BEV, { tr: 'Meyveli Gazoz', en: 'Fruit soda', source: 'OPEN_FOOD_FACTS' }),
  item('wl_085', BEV, { tr: 'Vitamin Su', en: 'Vitamin water', source: 'OPEN_FOOD_FACTS' }),
  item('wl_086', BEV, { tr: 'Protein Süt', en: 'Protein milk drink', source: 'OPEN_FOOD_FACTS' }),
  item('wl_087', BEV, { tr: 'Yoğurt İçeceği', en: 'Yogurt drink', source: 'OPEN_FOOD_FACTS' }),
  item('wl_088', BEV, { tr: 'Tarçınlı Süt', en: 'Cinnamon milk', source: 'TURKOMP_OR_RECIPE' }),
  item('wl_089', BEV, { tr: 'Salep (Şekersiz)', en: 'Salep unsweetened', source: 'TURKOMP_OR_RECIPE' }),
  item('wl_090', BEV, { tr: 'Demleme Çay (Büyük Fincan)', en: 'Brewed tea large cup', state: 'unsweetened', portion: '1 Fincan', grams: 300 }),
  item('wl_091', BEV, { tr: 'Cold Brew Kahve', en: 'Cold brew coffee', state: 'unsweetened', kwEn: 'coffee cold brew' }),
  item('wl_092', BEV, { tr: 'Macchiato', en: 'Macchiato', source: 'TURKOMP_OR_RECIPE' }),
  item('wl_093', BEV, { tr: 'Cortado', en: 'Cortado', source: 'TURKOMP_OR_RECIPE' }),
  item('wl_094', BEV, { tr: 'Affogato', en: 'Affogato', source: 'TURKOMP_OR_RECIPE' }),
  item('wl_095', BEV, { tr: 'Sahlep Tozu İçecek', en: 'Instant salep drink mix', source: 'OPEN_FOOD_FACTS' }),
  item('wl_096', BEV, { tr: 'Toz İçecek (Portakal)', en: 'Orange drink powder mix', source: 'OPEN_FOOD_FACTS' }),
  item('wl_097', BEV, { tr: 'Buzlu Çay (Şekersiz)', en: 'Unsweetened iced tea', state: 'unsweetened', source: 'MANUAL_REVIEW' }),
  item('wl_098', BEV, { tr: 'Bitter Limonata', en: 'Bitter lemon drink', source: 'OPEN_FOOD_FACTS' }),
  item('wl_099', BEV, { tr: 'Enerji İçeceği (Şekersiz)', en: 'Sugar-free energy drink', source: 'OPEN_FOOD_FACTS' }),
  item('wl_100', BEV, { tr: 'Maden Suyu (Meyveli)', en: 'Flavored sparkling water', source: 'OPEN_FOOD_FACTS' }),
  item('wl_101', BEV, { tr: 'Sıcak Süt', en: 'Hot milk', state: 'whole milk', kwEn: 'milk whole heated' }),
  item('wl_102', BEV, { tr: 'Zencefil Çayı', en: 'Ginger tea', state: 'unsweetened', source: 'MANUAL_REVIEW' }),
]
entries.push(...beverages)

// ── Fruits (~35) ────────────────────────────────────────────────────────────
const fruits = [
  item('wl_111', FRU, { tr: 'Yaban Mersini', en: 'Blueberries', state: 'raw', portion: '1 Kase', grams: 75 }),
  item('wl_112', FRU, { tr: 'Ahududu', en: 'Raspberries', state: 'raw', portion: '1 Kase', grams: 75 }),
  item('wl_113', FRU, { tr: 'Böğürtlen', en: 'Blackberries', state: 'raw', portion: '1 Kase', grams: 75 }),
  item('wl_114', FRU, { tr: 'Misket Limonu', en: 'Lime', state: 'raw', portion: '1 Adet', grams: 60 }),
  item('wl_115', FRU, { tr: 'Trabzon Hurması', en: 'Persimmon', state: 'raw', portion: '1 Adet', grams: 150 }),
  item('wl_116', FRU, { tr: 'Çarkıfelek', en: 'Passion fruit', state: 'raw', portion: '1 Adet', grams: 80 }),
  item('wl_117', FRU, { tr: 'Kuru İncir', en: 'Dried figs', state: 'dried', portion: '1 Adet', grams: 20 }),
  item('wl_118', FRU, { tr: 'Kuru Erik', en: 'Prunes', state: 'dried', portion: '1 Adet', grams: 10 }),
  item('wl_119', FRU, { tr: 'Kızılcık', en: 'Cranberries', state: 'raw', portion: '1 Kase', grams: 50 }),
  item('wl_120', FRU, { tr: 'Kestane (Haşlanmış)', en: 'Chestnuts boiled', state: 'boiled', portion: '1 Kase', grams: 80 }),
  item('wl_121', FRU, { tr: 'Ananas', en: 'Pineapple', state: 'raw', portion: '1 Dilim', grams: 80 }),
  item('wl_122', FRU, { tr: 'Mango', en: 'Mango', state: 'raw', portion: '1 Adet', grams: 150 }),
  item('wl_123', FRU, { tr: 'Avokado', en: 'Avocado', state: 'raw', portion: '1 Adet', grams: 150 }),
  item('wl_124', FRU, { tr: 'Greyfurt', en: 'Grapefruit', state: 'raw', portion: '1 Adet', grams: 200 }),
  item('wl_125', FRU, { tr: 'Mandalina', en: 'Mandarin', state: 'raw', portion: '1 Adet', grams: 80 }),
  item('wl_126', FRU, { tr: 'Ayva', en: 'Quince', state: 'raw', portion: '1 Adet', grams: 150 }),
  item('wl_127', FRU, { tr: 'Dut', en: 'Mulberry', state: 'raw', portion: '1 Kase', grams: 80 }),
  item('wl_128', FRU, { tr: 'Kuru Üzüm', en: 'Raisins', state: 'dried', portion: '1 Yemek Kaşığı', grams: 15 }),
  item('wl_129', FRU, { tr: 'Kuru Kayısı', en: 'Dried apricots', state: 'dried', portion: '1 Adet', grams: 8 }),
  item('wl_130', FRU, { tr: 'Hurma', en: 'Dates', state: 'dried', portion: '1 Adet', grams: 8 }),
  item('wl_131', FRU, { tr: 'Kavun', en: 'Melon', state: 'raw', portion: '1 Dilim', grams: 120 }),
  item('wl_132', FRU, { tr: 'Kiraz', en: 'Cherries', state: 'raw', portion: '1 Kase', grams: 80 }),
  item('wl_133', FRU, { tr: 'Vişne', en: 'Sour cherries', state: 'raw', portion: '1 Kase', grams: 80 }),
  item('wl_134', FRU, { tr: 'Böğürtlen (Dondurulmuş)', en: 'Blackberries frozen', state: 'frozen', portion: '1 Kase', grams: 100 }),
  item('wl_135', FRU, { tr: 'Muz (Olgun)', en: 'Banana ripe', state: 'raw', portion: '1 Adet', grams: 120, kwEn: 'banana raw' }),
  item('wl_136', FRU, { tr: 'Elma (Yeşil)', en: 'Green apple', state: 'raw', portion: '1 Adet', grams: 150, kwEn: 'apple raw with skin' }),
  item('wl_137', FRU, { tr: 'Armut (Williams)', en: 'Williams pear', state: 'raw', portion: '1 Adet', grams: 150 }),
  item('wl_138', FRU, { tr: 'Şeftali', en: 'Peach', state: 'raw', portion: '1 Adet', grams: 150 }),
  item('wl_139', FRU, { tr: 'Nektarin', en: 'Nectarine', state: 'raw', portion: '1 Adet', grams: 140 }),
  item('wl_140', FRU, { tr: 'Erik', en: 'Plum', state: 'raw', portion: '1 Adet', grams: 60 }),
  item('wl_141', FRU, { tr: 'Kayısı', en: 'Apricot', state: 'raw', portion: '1 Adet', grams: 35 }),
  item('wl_142', FRU, { tr: 'İncir (Taze)', en: 'Fresh fig', state: 'raw', portion: '1 Adet', grams: 50 }),
  item('wl_143', FRU, { tr: 'Nar', en: 'Pomegranate', state: 'raw', portion: '1 Kase', grams: 100 }),
  item('wl_144', FRU, { tr: 'Böğürtlen Reçeli Meyvesi', en: 'Mixed berries', state: 'raw', portion: '1 Kase', grams: 80, notes: 'Generic mixed berry bowl' }),
  item('wl_145', FRU, { tr: 'Kuru Dut', en: 'Dried mulberry', state: 'dried', source: 'MANUAL_REVIEW' }),
]
entries.push(...fruits)

// ── Vegetables (~45) ────────────────────────────────────────────────────────
const vegetables = [
  item('wl_146', VEG, { tr: 'Turp', en: 'Radish', state: 'raw', portion: '1 Adet', grams: 50 }),
  item('wl_147', VEG, { tr: 'Brüksel Lahanası (Haşlanmış)', en: 'Brussels sprouts boiled', state: 'boiled', portion: '1 Kase', grams: 80 }),
  item('wl_148', VEG, { tr: 'Kuşkonmaz (Haşlanmış)', en: 'Asparagus boiled', state: 'boiled', portion: '1 Kase', grams: 60 }),
  item('wl_149', VEG, { tr: 'Bakla (Taze)', en: 'Fava beans fresh', state: 'raw', portion: '1 Kase', grams: 80 }),
  item('wl_150', VEG, { tr: 'Maydanoz (Taze)', en: 'Parsley fresh', state: 'raw', portion: '1 Yemek Kaşığı', grams: 5 }),
  item('wl_151', VEG, { tr: 'Dereotu (Taze)', en: 'Dill fresh', state: 'raw', portion: '1 Yemek Kaşığı', grams: 3 }),
  item('wl_152', VEG, { tr: 'Kırmızı Lahana (Çiğ)', en: 'Red cabbage raw', state: 'raw', portion: '1 Kase', grams: 80 }),
  item('wl_153', VEG, { tr: 'Patates (Çiğ)', en: 'Potato raw', state: 'raw', portion: '1 Adet', grams: 150 }),
  item('wl_154', VEG, { tr: 'Nane (Taze)', en: 'Mint fresh', state: 'raw', portion: '1 Yemek Kaşığı', grams: 2 }),
  item('wl_155', VEG, { tr: 'Soğan (Kuru)', en: 'Onion dry', state: 'raw', portion: '1 Adet', grams: 80 }),
  item('wl_156', VEG, { tr: 'Roka', en: 'Arugula', state: 'raw', portion: '1 Kase', grams: 40 }),
  item('wl_157', VEG, { tr: 'Marul (Iceberg)', en: 'Iceberg lettuce', state: 'raw', portion: '1 Kase', grams: 60 }),
  item('wl_158', VEG, { tr: 'Ispanak (Çiğ)', en: 'Spinach raw', state: 'raw', portion: '1 Kase', grams: 60 }),
  item('wl_159', VEG, { tr: 'Ispanak (Haşlanmış)', en: 'Spinach boiled', state: 'boiled', portion: '1 Kase', grams: 90 }),
  item('wl_160', VEG, { tr: 'Brokoli (Haşlanmış)', en: 'Broccoli boiled', state: 'boiled', portion: '1 Kase', grams: 80 }),
  item('wl_161', VEG, { tr: 'Karnabahar (Haşlanmış)', en: 'Cauliflower boiled', state: 'boiled', portion: '1 Kase', grams: 80 }),
  item('wl_162', VEG, { tr: 'Bezelye (Haşlanmış)', en: 'Green peas boiled', state: 'boiled', portion: '1 Kase', grams: 80 }),
  item('wl_163', VEG, { tr: 'Mısır (Haşlanmış)', en: 'Sweet corn boiled', state: 'boiled', portion: '1 Adet', grams: 90 }),
  item('wl_164', VEG, { tr: 'Patlıcan (Izgara)', en: 'Eggplant grilled', state: 'grilled', portion: '1 Porsiyon', grams: 120 }),
  item('wl_165', VEG, { tr: 'Kabak (Izgara)', en: 'Zucchini grilled', state: 'grilled', portion: '1 Porsiyon', grams: 100 }),
  item('wl_166', VEG, { tr: 'Biber (Kırmızı Çiğ)', en: 'Red bell pepper raw', state: 'raw', portion: '1 Adet', grams: 120 }),
  item('wl_167', VEG, { tr: 'Biber (Yeşil Çiğ)', en: 'Green bell pepper raw', state: 'raw', portion: '1 Adet', grams: 120 }),
  item('wl_168', VEG, { tr: 'Salatalık (Çiğ)', en: 'Cucumber raw', state: 'raw', portion: '1 Adet', grams: 150 }),
  item('wl_169', VEG, { tr: 'Domates (Çiğ)', en: 'Tomato raw', state: 'raw', portion: '1 Adet', grams: 120 }),
  item('wl_170', VEG, { tr: 'Havuç (Çiğ)', en: 'Carrot raw', state: 'raw', portion: '1 Adet', grams: 60 }),
  item('wl_171', VEG, { tr: 'Havuç (Haşlanmış)', en: 'Carrot boiled', state: 'boiled', portion: '1 Adet', grams: 60 }),
  item('wl_172', VEG, { tr: 'Kereviz (Çiğ)', en: 'Celery raw', state: 'raw', portion: '1 Sap', grams: 40 }),
  item('wl_173', VEG, { tr: 'Pırasa (Haşlanmış)', en: 'Leek boiled', state: 'boiled', portion: '1 Porsiyon', grams: 90 }),
  item('wl_174', VEG, { tr: 'Mantar (Beyaz Çiğ)', en: 'White mushrooms raw', state: 'raw', portion: '1 Kase', grams: 70 }),
  item('wl_175', VEG, { tr: 'Mantar (Izgara)', en: 'Mushrooms grilled', state: 'grilled', portion: '1 Kase', grams: 80 }),
  item('wl_176', VEG, { tr: 'Patates (Fırın)', en: 'Potato baked', state: 'baked', portion: '1 Adet', grams: 150 }),
  item('wl_177', VEG, { tr: 'Tatlı Patates (Fırın)', en: 'Sweet potato baked', state: 'baked', portion: '1 Adet', grams: 130 }),
  item('wl_178', VEG, { tr: 'Enginar (Haşlanmış)', en: 'Artichoke boiled', state: 'boiled', portion: '1 Adet', grams: 120 }),
  item('wl_179', VEG, { tr: 'Semizotu', en: 'Purslane', state: 'raw', portion: '1 Kase', grams: 50 }),
  item('wl_180', VEG, { tr: 'Pancar (Haşlanmış)', en: 'Beet boiled', state: 'boiled', portion: '1 Adet', grams: 80 }),
  item('wl_181', VEG, { tr: 'Lahana (Çiğ)', en: 'Cabbage raw', state: 'raw', portion: '1 Kase', grams: 80 }),
  item('wl_182', VEG, { tr: 'Sarımsak (Çiğ)', en: 'Garlic raw', state: 'raw', portion: '1 Diş', grams: 3 }),
  item('wl_183', VEG, { tr: 'Zencefil (Taze)', en: 'Ginger root fresh', state: 'raw', portion: '1 Yemek Kaşığı', grams: 5 }),
  item('wl_184', VEG, { tr: 'Fesleğen (Taze)', en: 'Basil fresh', state: 'raw', portion: '1 Yemek Kaşığı', grams: 3 }),
  item('wl_185', VEG, { tr: 'Kekik (Taze)', en: 'Thyme fresh', state: 'raw', portion: '1 Yemek Kaşığı', grams: 2 }),
  item('wl_186', VEG, { tr: 'Taze Fasulye (Haşlanmış)', en: 'Green beans boiled', state: 'boiled', portion: '1 Kase', grams: 80 }),
  item('wl_187', VEG, { tr: 'Bamya (Haşlanmış)', en: 'Okra boiled', state: 'boiled', portion: '1 Kase', grams: 80 }),
  item('wl_188', VEG, { tr: 'Pırasa (Çiğ)', en: 'Leek raw', state: 'raw', portion: '1 Sap', grams: 50 }),
  item('wl_189', VEG, { tr: 'Turp Yaprağı', en: 'Radish greens', state: 'raw', portion: '1 Kase', grams: 40 }),
  item('wl_190', VEG, { tr: 'Kabak (Çiğ)', en: 'Zucchini raw', state: 'raw', portion: '1 Adet', grams: 120 }),
]
entries.push(...vegetables)

// Continue in part 2 — append meat, dairy, grains, etc.
function appendBatch(startId, category, list) {
  let n = startId
  for (const def of list) {
    entries.push(item(`wl_${String(n).padStart(3, '0')}`, category, def))
    n += 1
  }
  return n
}

let nextId = 191

nextId = appendBatch(nextId, MEAT, [
  { tr: 'Uskumru (Izgara)', en: 'Mackerel grilled', state: 'grilled', grams: 120 },
  { tr: 'Sardalya (Izgara)', en: 'Sardine grilled', state: 'grilled', grams: 100 },
  { tr: 'Kalamar (Izgara)', en: 'Calamari grilled', state: 'grilled', grams: 120 },
  { tr: 'Dana Antrikot (Izgara)', en: 'Beef ribeye grilled', state: 'grilled', grams: 150 },
  { tr: 'Hindi Budu (Fırın)', en: 'Turkey leg roasted', state: 'baked', grams: 150 },
  { tr: 'Ahtapot (Haşlanmış)', en: 'Octopus boiled', state: 'boiled', grams: 100 },
  { tr: 'Levrek (Izgara)', en: 'Sea bass grilled', state: 'grilled', grams: 150 },
  { tr: 'Çipura (Izgara)', en: 'Sea bream grilled', state: 'grilled', grams: 150 },
  { tr: 'Somon (Fırın)', en: 'Salmon baked', state: 'baked', grams: 120, kwEn: 'salmon baked' },
  { tr: 'Ton Balığı (Izgara)', en: 'Tuna steak grilled', state: 'grilled', grams: 120 },
  { tr: 'Karides (Haşlanmış)', en: 'Shrimp boiled', state: 'boiled', grams: 100 },
  { tr: 'Midye (Haşlanmış)', en: 'Mussels boiled', state: 'boiled', grams: 100 },
  { tr: 'Tavuk Göğsü (Izgara)', en: 'Chicken breast grilled', state: 'grilled', grams: 120, kwEn: 'chicken breast grilled' },
  { tr: 'Tavuk But (Fırın)', en: 'Chicken thigh roasted', state: 'baked', grams: 120 },
  { tr: 'Dana Biftek (Izgara)', en: 'Beef steak grilled', state: 'grilled', grams: 150 },
  { tr: 'Dana Kıyma (Pişmiş)', en: 'Ground beef cooked', state: 'cooked', grams: 120, kwEn: 'ground beef cooked' },
  { tr: 'Kuzu Pirzola (Izgara)', en: 'Lamb chop grilled', state: 'grilled', grams: 120 },
  { tr: 'Hindi Göğsü (Fırın)', en: 'Turkey breast roasted', state: 'baked', grams: 120 },
  { tr: 'Yumurta (Haşlanmış)', en: 'Egg boiled', state: 'boiled', portion: '1 Adet', grams: 50, kwEn: 'egg hard boiled' },
  { tr: 'Yumurta (Sahanda)', en: 'Egg fried', state: 'fried', portion: '1 Adet', grams: 55, kwEn: 'egg fried' },
  { tr: 'Yumurta Akı', en: 'Egg white', state: 'raw', portion: '1 Adet', grams: 33 },
  { tr: 'Yumurta Sarısı', en: 'Egg yolk', state: 'raw', portion: '1 Adet', grams: 17 },
  { tr: 'Pastırma', en: 'Pastirma cured beef', source: 'TURKOMP_OR_RECIPE', notes: 'Turkish cured meat' },
  { tr: 'Sucuk (Çiğ)', en: 'Sucuk raw', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Sosis (Pişmiş)', en: 'Sausage cooked', state: 'cooked', source: 'OPEN_FOOD_FACTS' },
  { tr: 'Hindi Füme', en: 'Smoked turkey', source: 'OPEN_FOOD_FACTS' },
  { tr: 'Balık Köfte (Ev)', en: 'Homemade fish patty', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Mezgit (Izgara)', en: 'Whiting grilled', state: 'grilled', grams: 120 },
  { tr: 'Hamsi (Izgara)', en: 'Anchovy grilled', state: 'grilled', grams: 80 },
  { tr: 'Palamut (Izgara)', en: 'Bonito grilled', state: 'grilled', grams: 120 },
  { tr: 'Dana Bonfile (Izgara)', en: 'Beef tenderloin grilled', state: 'grilled', grams: 150 },
  { tr: 'Tavuk Kanat (Fırın)', en: 'Chicken wings baked', state: 'baked', grams: 100 },
  { tr: 'Hindi Sosis', en: 'Turkey sausage', source: 'OPEN_FOOD_FACTS' },
  { tr: 'Köfte (Izgara)', en: 'Grilled meatballs', state: 'grilled', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Ciğer (Izgara)', en: 'Liver grilled', state: 'grilled', grams: 100 },
])

nextId = appendBatch(nextId, DAIRY, [
  { tr: 'Ricotta Peyniri', en: 'Ricotta cheese', portion: '1 Yemek Kaşığı', grams: 30 },
  { tr: 'Parmesan Peyniri', en: 'Parmesan cheese', portion: '1 Yemek Kaşığı', grams: 10 },
  { tr: 'Peynir (Tulum)', en: 'Tulum cheese', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Kaşar Peyniri', en: 'Kashar cheese', kwEn: 'kashar cheese' },
  { tr: 'Beyaz Peynir', en: 'White brined cheese', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Lor Peyniri', en: 'Curd cheese', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Labne', en: 'Labneh', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Krem Peynir', en: 'Cream cheese', kwEn: 'cream cheese' },
  { tr: 'Mozzarella', en: 'Mozzarella cheese', kwEn: 'mozzarella cheese' },
  { tr: 'Cheddar Peyniri', en: 'Cheddar cheese', kwEn: 'cheddar cheese' },
  { tr: 'Yoğurt (Tam Yağlı)', en: 'Yogurt whole milk plain', state: 'whole milk', kwEn: 'yogurt whole milk plain' },
  { tr: 'Yoğurt (Yağsız)', en: 'Yogurt nonfat plain', state: 'skim milk', kwEn: 'yogurt nonfat plain' },
  { tr: 'Greek Yoğurt', en: 'Greek yogurt plain', kwEn: 'yogurt greek plain' },
  { tr: 'Kaymak', en: 'Clotted cream', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Tereyağı', en: 'Butter', kwEn: 'butter salted' },
  { tr: 'Krema (Sıvı)', en: 'Heavy cream', kwEn: 'cream heavy whipping' },
  { tr: 'Süzme Peynir', en: 'Cottage cheese', kwEn: 'cottage cheese' },
  { tr: 'Hellim Peyniri (Izgara)', en: 'Halloumi grilled', state: 'grilled', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Dil Peyniri', en: 'String cheese', source: 'OPEN_FOOD_FACTS' },
  { tr: 'Ayran Yoğurt Bazlı', en: 'Plain yogurt drink base', source: 'TURKOMP_OR_RECIPE', notes: 'For recipe cross-ref' },
  { tr: 'Kefir (Sade)', en: 'Kefir plain', kwEn: 'kefir plain' },
  { tr: 'Süt Tozu', en: 'Powdered milk', source: 'OPEN_FOOD_FACTS' },
  { tr: 'Peynir Altı Suyu', en: 'Whey', kwEn: 'whey fluid' },
  { tr: 'Kakao Süt Tozu Karışım', en: 'Chocolate milk powder', source: 'OPEN_FOOD_FACTS' },
  { tr: 'Vegan Peynir', en: 'Vegan cheese', source: 'OPEN_FOOD_FACTS' },
])

nextId = appendBatch(nextId, GRAIN, [
  { tr: 'Pirinç (Çiğ Beyaz)', en: 'White rice raw', state: 'raw', portion: '1 Su Bardağı', grams: 185, kwEn: 'rice white raw' },
  { tr: 'Pirinç (Haşlanmış)', en: 'White rice cooked', state: 'cooked', kwEn: 'rice white cooked' },
  { tr: 'Bulgur (Kuru)', en: 'Bulgur dry', state: 'raw', portion: '1 Su Bardağı', grams: 140 },
  { tr: 'Bulgur (Haşlanmış)', en: 'Bulgur cooked', state: 'cooked', kwEn: 'bulgur cooked' },
  { tr: 'Makarna (Çiğ)', en: 'Pasta dry', state: 'raw', grams: 80, kwEn: 'pasta dry' },
  { tr: 'Makarna (Haşlanmış)', en: 'Pasta cooked', state: 'cooked', kwEn: 'pasta cooked' },
  { tr: 'Tam Buğday Ekmeği', en: 'Whole wheat bread', kwEn: 'bread whole wheat' },
  { tr: 'Beyaz Ekmek', en: 'White bread', kwEn: 'bread white' },
  { tr: 'Simit', en: 'Simit bread ring', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Lavaş', en: 'Lavash flatbread', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Pide (Beyaz)', en: 'Turkish pide bread', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Yulaf Ezmesi (Kuru)', en: 'Rolled oats dry', state: 'raw', kwEn: 'oats rolled dry' },
  { tr: 'Yulaf Lapası (Pişmiş)', en: 'Oatmeal cooked', state: 'cooked', kwEn: 'oatmeal cooked' },
  { tr: 'Mısır Gevreği (Sade)', en: 'Corn flakes plain', source: 'OPEN_FOOD_FACTS' },
  { tr: 'Granola', en: 'Granola', source: 'OPEN_FOOD_FACTS' },
  { tr: 'Kinoa (Haşlanmış)', en: 'Quinoa cooked', state: 'cooked', kwEn: 'quinoa cooked' },
  { tr: 'Kuskus (Haşlanmış)', en: 'Couscous cooked', state: 'cooked', kwEn: 'couscous cooked' },
  { tr: 'İrmik (Kuru)', en: 'Semolina dry', state: 'raw', portion: '1 Su Bardağı', grams: 160 },
  { tr: 'Yulaf Unu', en: 'Oat flour', state: 'raw', portion: '1 Yemek Kaşığı', grams: 10 },
  { tr: 'Mısır Unu', en: 'Corn flour', state: 'raw', portion: '1 Yemek Kaşığı', grams: 10 },
  { tr: 'Buğday Unu (Beyaz)', en: 'Wheat flour white', state: 'raw', kwEn: 'flour wheat white' },
  { tr: 'Tam Buğday Unu', en: 'Whole wheat flour', state: 'raw', kwEn: 'flour whole wheat' },
  { tr: 'Galeta Unu', en: 'Breadcrumbs', kwEn: 'bread crumbs dry' },
  { tr: 'Mısır Ekmeği', en: 'Cornbread', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Ekşi Mayalı Ekmek', en: 'Sourdough bread', kwEn: 'bread sourdough' },
  { tr: 'Basmati Pirinç (Haşlanmış)', en: 'Basmati rice cooked', state: 'cooked', kwEn: 'rice basmati cooked' },
  { tr: 'Esmer Pirinç (Haşlanmış)', en: 'Brown rice cooked', state: 'cooked', kwEn: 'rice brown cooked' },
  { tr: 'Noodle (Haşlanmış)', en: 'Noodles cooked', state: 'cooked', kwEn: 'noodles cooked' },
  { tr: 'Tam Tahıl Galeta', en: 'Whole grain cracker', source: 'OPEN_FOOD_FACTS' },
  { tr: 'Tortilla (Buğday)', en: 'Wheat tortilla', kwEn: 'tortilla wheat' },
])

nextId = appendBatch(nextId, LEG, [
  { tr: 'Mercimek (Yeşil Kuru)', en: 'Green lentil dry', state: 'raw', portion: '1 Su Bardağı', grams: 190 },
  { tr: 'Mercimek (Kırmızı Kuru)', en: 'Red lentil dry', state: 'raw', portion: '1 Su Bardağı', grams: 190 },
  { tr: 'Mercimek (Yeşil Haşlanmış)', en: 'Green lentil boiled', state: 'boiled', kwEn: 'lentils green boiled' },
  { tr: 'Mercimek (Kırmızı Haşlanmış)', en: 'Red lentil boiled', state: 'boiled', kwEn: 'lentils red boiled' },
  { tr: 'Barbunya (Kuru)', en: 'Kidney bean dry', state: 'raw', portion: '1 Su Bardağı', grams: 180 },
  { tr: 'Barbunya (Haşlanmış)', en: 'Kidney bean boiled', state: 'boiled', kwEn: 'kidney beans boiled' },
  { tr: 'Nohut (Kuru)', en: 'Chickpea dry', state: 'raw', portion: '1 Su Bardağı', grams: 180 },
  { tr: 'Nohut (Haşlanmış)', en: 'Chickpea boiled', state: 'boiled', kwEn: 'chickpeas boiled' },
  { tr: 'Kuru Fasulye (Kuru)', en: 'White bean dry', state: 'raw', portion: '1 Su Bardağı', grams: 180 },
  { tr: 'Kuru Fasulye (Haşlanmış)', en: 'White bean boiled', state: 'boiled', kwEn: 'white beans boiled' },
  { tr: 'Soya Fasulyesi (Haşlanmış)', en: 'Soybeans boiled', state: 'boiled', kwEn: 'soybeans boiled' },
  { tr: 'Edamame (Haşlanmış)', en: 'Edamame boiled', state: 'boiled', kwEn: 'edamame boiled' },
  { tr: 'Börülce (Haşlanmış)', en: 'Black-eyed peas boiled', state: 'boiled', kwEn: 'cowpeas boiled' },
  { tr: 'Fava (Kuru)', en: 'Fava bean dry', state: 'raw' },
  { tr: 'Humus', en: 'Hummus', source: 'TURKOMP_OR_RECIPE', notes: 'Prepared dip — recipe' },
])

nextId = appendBatch(nextId, NUT, [
  { tr: 'Kabak Çekirdeği', en: 'Pumpkin seeds', portion: '1 Kase', grams: 30 },
  { tr: 'Susam (Kuru)', en: 'Sesame seeds', portion: '1 Yemek Kaşığı', grams: 10 },
  { tr: 'Pekan Cevizi', en: 'Pecans', portion: '1 Adet', grams: 4 },
  { tr: 'Yer Fıstığı (Kavrulmuş Tuzsuz)', en: 'Peanuts roasted unsalted', state: 'roasted', kwEn: 'peanuts roasted unsalted' },
  { tr: 'Badem (Çiğ)', en: 'Almonds raw', state: 'raw', kwEn: 'almonds raw' },
  { tr: 'Ceviz', en: 'Walnuts', state: 'raw', kwEn: 'walnuts' },
  { tr: 'Fındık', en: 'Hazelnuts', state: 'raw', kwEn: 'hazelnuts' },
  { tr: 'Kaju', en: 'Cashews', state: 'raw', kwEn: 'cashews raw' },
  { tr: 'Antep Fıstığı', en: 'Pistachios', state: 'raw', kwEn: 'pistachios' },
  { tr: 'Ay Çekirdeği', en: 'Sunflower seeds', state: 'raw' },
  { tr: 'Keten Tohumu', en: 'Flax seeds', state: 'raw' },
  { tr: 'Chia Tohumu', en: 'Chia seeds', state: 'raw' },
  { tr: 'Hindistan Cevizi (Rendelenmiş)', en: 'Coconut shredded', state: 'dried' },
  { tr: 'Kuru Üzüm (Kavrulmuş)', en: 'Roasted chickpeas snack', source: 'TURKOMP_OR_RECIPE', notes: 'Leblebi-style snack' },
  { tr: 'Leblebi', en: 'Roasted chickpeas', source: 'TURKOMP_OR_RECIPE' },
])

nextId = appendBatch(nextId, OIL, [
  { tr: 'Hindistan Cevizi Yağı', en: 'Coconut oil', portion: '1 Yemek Kaşığı', grams: 15 },
  { tr: 'Susam Yağı', en: 'Sesame oil', portion: '1 Yemek Kaşığı', grams: 15 },
  { tr: 'Zeytinyağı', en: 'Olive oil', portion: '1 Yemek Kaşığı', grams: 15, kwEn: 'olive oil' },
  { tr: 'Ayçiçek Yağı', en: 'Sunflower oil', portion: '1 Yemek Kaşığı', grams: 15 },
  { tr: 'Kanola Yağı', en: 'Canola oil', portion: '1 Yemek Kaşığı', grams: 15 },
  { tr: 'Margarin', en: 'Margarine', source: 'OPEN_FOOD_FACTS' },
  { tr: 'Avokado Yağı', en: 'Avocado oil', portion: '1 Yemek Kaşığı', grams: 15 },
  { tr: 'Tereyağı (Tuzsuz)', en: 'Butter unsalted', kwEn: 'butter unsalted' },
])

nextId = appendBatch(nextId, SOUP, [
  { tr: 'Paça Çorbası', en: 'Trotter soup', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Lahana Çorbası', en: 'Cabbage soup', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Sebze Çorbası', en: 'Mixed vegetable soup', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Balık Çorbası', en: 'Fish soup', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Mercimek Çorbası', en: 'Lentil soup', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Ezogelin Çorbası', en: 'Ezogelin soup', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Tarhana Çorbası', en: 'Tarhana soup', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Yayla Çorbası', en: 'Yayla soup', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Domates Çorbası', en: 'Tomato soup', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Tavuk Suyu Çorbası', en: 'Chicken broth soup', kwEn: 'chicken broth' },
  { tr: 'Analı Kızlı Çorbası', en: 'Anali kizli soup', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'İşkembe Çorbası', en: 'Tripe soup', source: 'TURKOMP_OR_RECIPE' },
])

nextId = appendBatch(nextId, TR, [
  { tr: 'Menemen', en: 'Menemen', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Çılbır', en: 'Cilbir', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Türlü', en: 'Mixed vegetable stew', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Sulu Köfte', en: 'Sulu kofte stew', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Ali Nazik', en: 'Ali nazik', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Patlıcan Salatası (Közlenmiş)', en: 'Roasted eggplant salad', state: 'grilled', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Sigara Böreği', en: 'Sigara boregi', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Su Böreği', en: 'Su boregi', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Kaygana', en: 'Kaygana', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Pişi', en: 'Pisi fried dough', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Haydari', en: 'Haydari', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Acılı Ezme', en: 'Spicy tomato dip', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Orman Kebabı', en: 'Orman kebabi', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Karnıyarık', en: 'Karniyarik', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Imam Bayıldı', en: 'Imam bayildi', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Mücver', en: 'Mucver zucchini fritters', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Kısır', en: 'Kisir bulgur salad', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Çoban Salata', en: 'Coban salad', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Piyaz', en: 'Piyaz bean salad', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Lahmacun', en: 'Lahmacun', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Pide (Kaşarlı)', en: 'Cheese pide', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Döner (Tavuk)', en: 'Chicken doner', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Döner (Et)', en: 'Beef doner', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'İskender Kebap', en: 'Iskender kebab', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Adana Kebap', en: 'Adana kebab', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Urfa Kebap', en: 'Urfa kebab', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Tavuk Şiş', en: 'Chicken shish kebab', state: 'grilled', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Kuzu Şiş', en: 'Lamb shish kebab', state: 'grilled', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Mantı', en: 'Manti dumplings', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Börek (Peynirli)', en: 'Cheese borek', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Gözleme (Ispanaklı)', en: 'Spinach gozleme', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Gözleme (Peynirli)', en: 'Cheese gozleme', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Kumpir', en: 'Kumpir stuffed potato', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Köfte (Ev Usulü)', en: 'Homemade meatballs', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Fasulye Pilaki', en: 'Bean pilaki', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Zeytinyağlı Fasulye', en: 'Green beans in olive oil', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Zeytinyağlı Enginar', en: 'Artichoke in olive oil', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Zeytinyağlı Barbunya', en: 'Kidney beans in olive oil', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Hünkar Beğendi', en: 'Hunkar begendi', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Etli Nohut', en: 'Chickpeas with meat', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Sarma (Yaprak)', en: 'Stuffed grape leaves', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Cacık', en: 'Cacik yogurt dip', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Tarator', en: 'Tarator walnut sauce', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Tantuni', en: 'Tantuni wrap', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Kokoreç', en: 'Kokorec', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Midye Dolma', en: 'Stuffed mussels', source: 'TURKOMP_OR_RECIPE' },
])

nextId = appendBatch(nextId, BRKF, [
  { tr: 'Reçel (Çilek)', en: 'Strawberry jam', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Fransız Tostu', en: 'French toast', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Sahanda Sucuk', en: 'Sucuk pan-fried', state: 'fried', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Sahanda Yumurta', en: 'Pan fried eggs', state: 'fried', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Omlet (Peynirli)', en: 'Cheese omelette', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Omlet (Sebzeli)', en: 'Vegetable omelette', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Granola Kase', en: 'Granola bowl', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Peynir-Zeytin Tabağı', en: 'Cheese olive plate', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Bal', en: 'Honey', kwEn: 'honey' },
  { tr: 'Tahin-Pekmez', en: 'Tahini molasses', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Pancake', en: 'Pancake', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Waffle', en: 'Waffle', source: 'TURKOMP_OR_RECIPE' },
])

nextId = appendBatch(nextId, SNACK, [
  { tr: 'Galeta', en: 'Cracker plain', kwEn: 'cracker plain' },
  { tr: 'Kurabiye (Ev Yapımı)', en: 'Homemade cookie', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Cips (Patates)', en: 'Potato chips', source: 'OPEN_FOOD_FACTS' },
  { tr: 'Mısır Cipsi', en: 'Corn chips', source: 'OPEN_FOOD_FACTS' },
  { tr: 'Protein Bar', en: 'Protein bar', source: 'OPEN_FOOD_FACTS' },
  { tr: 'Granola Bar', en: 'Granola bar', source: 'OPEN_FOOD_FACTS' },
  { tr: 'Popcorn (Tuzsuz)', en: 'Popcorn unsalted', state: 'plain', kwEn: 'popcorn air popped' },
  { tr: 'Bisküvi (Petibör)', en: 'Tea biscuit', source: 'OPEN_FOOD_FACTS' },
  { tr: 'Çikolata (Sütlü)', en: 'Milk chocolate', source: 'OPEN_FOOD_FACTS' },
  { tr: 'Dondurma (Sade Vanilya)', en: 'Vanilla ice cream', source: 'OPEN_FOOD_FACTS' },
])

nextId = appendBatch(nextId, SWEET, [
  { tr: 'Baklava', en: 'Baklava', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Künefe', en: 'Kunefe', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Sütlaç', en: 'Sutlac rice pudding', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Kazandibi', en: 'Kazandibi', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Revani', en: 'Revani semolina cake', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Lokma', en: 'Lokma', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Helva', en: 'Halva', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Tiramisu', en: 'Tiramisu', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Cheesecake', en: 'Cheesecake', source: 'TURKOMP_OR_RECIPE' },
  { tr: 'Brownie', en: 'Brownie', source: 'TURKOMP_OR_RECIPE' },
])

// Pad to exactly 400 if short/long
if (entries.length !== 400) {
  console.warn(`Expected 400 entries, got ${entries.length}`)
}

mkdirSync(dirname(OUTPUT), { recursive: true })
const csv = [HEADERS.join(','), ...entries.map(row)].join('\n')
writeFileSync(OUTPUT, `${csv}\n`, 'utf8')
console.log(`Wrote ${entries.length} wishlist candidates → ${OUTPUT}`)
