/**
 * Export MASTER_FOOD_DB → nutrition_catalog_foods / nutrition_catalog_portions CSV seeds.
 * Does not connect to Supabase — output is for manual import.
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { MASTER_FOOD_DB, toLegacyFood } from '../src/utils/foodDatabase.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR = join(__dirname, 'output')

const FOODS_CSV = join(OUTPUT_DIR, 'nutrition_catalog_foods_seed.csv')
const PORTIONS_CSV = join(OUTPUT_DIR, 'nutrition_catalog_portions_seed.csv')

const FOOD_COLUMNS = [
  'catalog_food_id',
  'slug',
  'name_tr',
  'name_en',
  'category_tr',
  'category_en',
  'calories_100g',
  'protein_100g',
  'carbs_100g',
  'fat_100g',
  'fiber_100g',
  'sugar_100g',
  'sodium_mg_100g',
  'default_portion_label_tr',
  'default_portion_label_en',
  'default_portion_grams',
  'aliases_tr',
  'aliases_en',
  'tags',
  'search_text_tr',
  'search_text_en',
  'source_type',
  'source_name',
  'source_food_id',
  'confidence',
  'review_status',
  'visible',
]

const PORTION_COLUMNS = [
  'catalog_portion_id',
  'catalog_food_id',
  'portion_label_tr',
  'portion_label_en',
  'grams',
  'is_default',
  'sort_order',
]

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

function normalizeTr(text) {
  return String(text || '')
    .toLocaleLowerCase('tr-TR')
    .replace(/[()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function inferCategory(name) {
  const n = String(name || '').toLocaleLowerCase('tr-TR')

  if (/çorba|corba|corbasi/i.test(n)) return { tr: 'Çorba', en: 'Soup' }
  if (
    /^(elma|muz|portakal|çilek|kiraz|erik|armut|karpuz|kavun|üzüm|nar|kivi|ananas|kayısı|hurma|greyfurt|mandalina|incir)\b/i.test(n) ||
    /\bmeyve\b/i.test(n)
  ) {
    return { tr: 'Meyve', en: 'Fruit' }
  }
  if (/domates|salatalık|marul|havuç|ıspanak|brokoli|karnabahar|kabak|patlıcan|biber|roka|mantar|patates|mısır|bezelye/i.test(n)) {
    return { tr: 'Sebze', en: 'Vegetable' }
  }
  if (/köfte|dana|kuzu|tavuk|hindi|kebap|döner|pastırma|sucuk|sosis|\bet\b/i.test(n)) {
    return { tr: 'Et & Tavuk', en: 'Meat & Poultry' }
  }
  if (/somon|levrek|çupra|hamsi|karides|ton bal|balık|midye/i.test(n)) {
    return { tr: 'Balık & Deniz', en: 'Fish & Seafood' }
  }
  if (/süt|yoğurt|peynir|ayran|kefir|labne|krema|tereya/i.test(n)) {
    return { tr: 'Süt Ürünleri', en: 'Dairy' }
  }
  if (/ekmek|pilav|makarna|bulgur|yulaf|kinoa|simit|bazlama|lavaş|pide|börek|poğaça|tost|granola|gevrek/i.test(n)) {
    return { tr: 'Tahıl & Ekmek', en: 'Grains & Bread' }
  }
  if (/mercimek|nohut|fasulye|humus|bakla/i.test(n)) {
    return { tr: 'Baklagil', en: 'Legumes' }
  }
  if (/badem|ceviz|fındık|fıstık|cekirdegi|chia/i.test(n)) {
    return { tr: 'Kuruyemiş', en: 'Nuts & Seeds' }
  }
  if (/baklava|künefe|revani|sütlaç|aşure|helva|lokum/i.test(n)) {
    return { tr: 'Tatlı', en: 'Dessert' }
  }
  if (/çay|kahve|\bsu\b/i.test(n)) {
    return { tr: 'İçecek', en: 'Beverage' }
  }
  if (/zeytinyağ|\bzeytin\b/i.test(n)) {
    return { tr: 'Yağ & Sos', en: 'Oils & Sauces' }
  }
  if (/menemen|lahmacun|mantı|iskender|gözleme|karnıyarık|cacık|dolma|sarma|imam|kısır/i.test(n)) {
    return { tr: 'Yemek', en: 'Prepared Dish' }
  }

  return { tr: 'Genel', en: 'General' }
}

function buildAliasesTr(name, slug) {
  const aliases = new Set()
  aliases.add(name)

  const withoutParens = name.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim()
  if (withoutParens) aliases.add(withoutParens)

  aliases.add(normalizeTr(name))
  if (withoutParens) aliases.add(normalizeTr(withoutParens))

  const fromSlug = slug.replace(/_/g, ' ').trim()
  if (fromSlug) aliases.add(fromSlug)

  return [...aliases].filter(Boolean).join(', ')
}

function formatNumber(value, decimals = 4) {
  const num = Number(value)
  if (!Number.isFinite(num)) return '0'
  const rounded = Number(num.toFixed(decimals))
  return String(rounded)
}

function buildCatalogFoodRow(master) {
  const legacy = toLegacyFood(master)
  const category = inferCategory(master.name)
  const tags = (master.tags ?? []).join(', ')
  const aliasesTr = buildAliasesTr(master.name, master.slug)
  const searchTextTr = [master.name, aliasesTr, category.tr, tags].filter(Boolean).join(' ')

  return {
    catalog_food_id: master.id,
    slug: master.slug,
    name_tr: master.name,
    name_en: '',
    category_tr: category.tr,
    category_en: category.en,
    calories_100g: formatNumber(legacy.calories),
    protein_100g: formatNumber(legacy.protein),
    carbs_100g: formatNumber(legacy.carbs),
    fat_100g: formatNumber(legacy.fat),
    fiber_100g: formatNumber(master.fiber ?? 0),
    sugar_100g: formatNumber(master.sugar ?? 0),
    sodium_mg_100g: formatNumber(master.sodium ?? 0),
    default_portion_label_tr: master.serving_size,
    default_portion_label_en: '',
    default_portion_grams: master.serving_grams,
    aliases_tr: aliasesTr,
    aliases_en: '',
    tags,
    search_text_tr: searchTextTr,
    search_text_en: '',
    source_type: 'LOCAL_MASTER_PENDING_VERIFICATION',
    source_name: 'foodDatabase.js MASTER_FOOD_DB',
    source_food_id: '',
    confidence: '',
    review_status: 'pending_verification',
    visible: 'true',
  }
}

function buildCatalogPortionRow(catalogPortionId, master) {
  return {
    catalog_portion_id: catalogPortionId,
    catalog_food_id: master.id,
    portion_label_tr: master.serving_size,
    portion_label_en: '',
    grams: master.serving_grams,
    is_default: 'true',
    sort_order: 10,
  }
}

function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true })

  const foodRows = MASTER_FOOD_DB.map(buildCatalogFoodRow)
  const portionRows = MASTER_FOOD_DB.map((master, index) =>
    buildCatalogPortionRow(index + 1, master)
  )

  const foodsCsv = [
    FOOD_COLUMNS.join(','),
    ...foodRows.map((row) => toCsvRow(FOOD_COLUMNS, row)),
  ].join('\n')

  const portionsCsv = [
    PORTION_COLUMNS.join(','),
    ...portionRows.map((row) => toCsvRow(PORTION_COLUMNS, row)),
  ].join('\n')

  writeFileSync(FOODS_CSV, `${foodsCsv}\n`, 'utf8')
  writeFileSync(PORTIONS_CSV, `${portionsCsv}\n`, 'utf8')

  console.log(`Exported ${foodRows.length} catalog foods → ${FOODS_CSV}`)
  console.log(`Exported ${portionRows.length} catalog portions → ${PORTIONS_CSV}`)
}

main()
