/**
 * Audit food wishlist candidates against MASTER_FOOD_DB and USDA match review.
 * Does NOT modify foodDatabase.js — produces human review CSVs only.
 *
 * Run: node scripts/auditFoodWishlistMatches.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { MASTER_FOOD_DB } from '../src/utils/foodDatabase.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR = join(__dirname, 'output')
const WISHLIST_CSV = join(OUTPUT_DIR, 'food_wishlist_400_candidates.csv')
const USDA_REVIEW_CSV = join(OUTPUT_DIR, 'food_wishlist_usda_match_review.csv')
const AUDIT_CSV = join(OUTPUT_DIR, 'food_wishlist_match_audit.csv')
const EXISTING_UPDATES_CSV = join(OUTPUT_DIR, 'usda_existing_food_updates_review.csv')
const NEW_CANDIDATES_CSV = join(OUTPUT_DIR, 'usda_new_food_candidates_review.csv')

const AUDIT_COLUMNS = [
  'candidate_id',
  'name_tr',
  'name_en',
  'category_tr',
  'target_state',
  'preferred_source',
  'exists_in_current_catalog',
  'existing_food_id',
  'existing_food_name',
  'existing_match_confidence',
  'original_match_status',
  'usda_food_id',
  'usda_name_en',
  'usda_calories_100g',
  'usda_protein_100g',
  'usda_carbs_100g',
  'usda_fat_100g',
  'usda_fiber_100g',
  'usda_sugar_100g',
  'usda_sodium_mg_100g',
  'usda_score',
  'state_match',
  'base_food_match',
  'category_match',
  'variant_warning',
  'missing_nutrient_warning',
  'audit_decision',
  'audit_note',
]

const SUBSET_COLUMNS = AUDIT_COLUMNS

const STATE_PATTERNS = {
  raw: ['raw', 'cig', 'ciğ', 'fresh', 'taze', 'uncooked', 'çiğ'],
  boiled: ['boiled', 'haslanmis', 'haşlanmış', 'simmered'],
  grilled: ['grilled', 'izgara', 'broiled'],
  baked: ['baked', 'roasted', 'firin', 'fırın', 'oven'],
  fried: ['fried', 'kizartma', 'kızartma', 'pan fried'],
  dried: ['dried', 'kuru', 'dehydrated'],
  roasted: ['roasted', 'kavrulmus', 'kavrulmuş', 'dry roasted'],
  whole_milk: ['whole milk', 'tam yagli', 'tam yağlı', 'full fat milk'],
  skim_milk: ['skim', 'nonfat', 'fat free', 'yagsiz', 'yağsız', 'skimmed'],
  reduced_fat: ['reduced fat', 'low fat', '2% milk', 'yarim yagli', 'yarım yağlı', '1% milk'],
  unsweetened: ['unsweetened', 'sekersiz', 'şekersiz', 'no sugar added'],
  plain: ['plain', 'sade', 'unflavored', 'unflavoured'],
  frozen: ['frozen', 'dondurulmus', 'dondurulmuş'],
  sweetened: ['sweetened', 'sekerli', 'şekerli', 'with sugar'],
  cooked: ['cooked', 'pismis', 'pişmiş', 'prepared'],
  juice: ['juice', 'suyu', 'suy'],
}

const OPPOSITE_STATE_PAIRS = [
  ['raw', 'boiled'],
  ['raw', 'cooked'],
  ['raw', 'fried'],
  ['raw', 'baked'],
  ['raw', 'grilled'],
  ['boiled', 'fried'],
  ['boiled', 'raw'],
  ['whole_milk', 'skim_milk'],
  ['skim_milk', 'whole_milk'],
  ['whole_milk', 'reduced_fat'],
  ['reduced_fat', 'skim_milk'],
  ['unsweetened', 'sweetened'],
]

const REJECT_USDA_INDICATORS = [
  'baby', 'bebek', 'junior', 'infant', 'toddler', 'formula', 'mamasi', 'maması',
  'substitute', 'muadili', 'muadil',
  'flour', 'unu',
  'powder', 'tozu',
  'concentrate', 'konsantre',
  'sauce', 'sos', 'soslu', 'dressing',
  'babyfood', 'baby food',
  'snack bar', 'candy', 'cereal bar',
  'restaurant', 'fast food',
  'supplement', 'protein powder',
  'ice pop', 'buzlu cubuk', 'buzlu çubuk',
]

/** Short tokens that must match as whole words to avoid false positives (e.g. "un" in "ürünleri"). */
const REJECT_USDA_WORD_INDICATORS = ['un', 'toz']

const MIXED_JUICE_INDICATORS = [
  'cranberry', 'kizilcik', 'kızılcık',
  'pineapple', 'ananas',
  'orange grapefruit', 'portakal greyfurt',
  'grapefruit juice drink', 'grape juice drink',
  'juice drink',
]

const NUT_BUTTER_INDICATORS = [
  'almond butter', 'badem ezmesi',
  'peanut butter', 'fistik ezmesi', 'fıstık ezmesi',
  'cashew butter', 'kaju ezmesi',
  'hazelnut butter', 'findik ezmesi', 'fındık ezmesi',
]

const DAIRY_BUTTER_INDICATORS = [
  'butter', 'tereyagi', 'tereyağı', 'tereya',
]

const WRONG_SPINACH_INDICATORS = [
  'mustard spinach', 'hardal ispanagi', 'hardal ıspanağı',
  'vine spinach', 'malabar',
  'water spinach', 'su ispanagi', 'su ıspanağı',
]

const CATEGORY_HINTS = {
  meyve: ['fruit', 'meyve', 'berries', 'citrus'],
  sebze: ['vegetable', 'sebze', 'greens'],
  içecek: ['beverage', 'drink', 'juice', 'tea', 'coffee', 'milk', 'icecek', 'içecek'],
  'süt ürünleri': ['dairy', 'cheese', 'yogurt', 'sut', 'süt', 'milk', 'butter'],
  'et / tavuk / balık': ['meat', 'poultry', 'fish', 'beef', 'chicken', 'turkey', 'seafood'],
  'tahıl / ekmek / makarna': ['grain', 'bread', 'pasta', 'rice', 'cereal', 'flour', 'noodle'],
  baklagiller: ['legume', 'bean', 'lentil', 'pea', 'chickpea'],
  kuruyemiş: ['nut', 'seed', 'almond', 'walnut'],
  'yağlar': ['oil', 'fat', 'butter', 'margarine'],
  yumurta: ['egg'],
  'kuruyemiş ve tohum': ['nut', 'seed', 'almond', 'walnut', 'peanut'],
  'tahıl ve ekmek': ['grain', 'bread', 'pasta', 'rice', 'cereal', 'flour', 'quinoa'],
}

/** Hard-coded known wrong top-1 USDA matches that must be rejected. */
const KNOWN_WRONG_TOP_MATCHES = {
  wl_240: { reject_name_patterns: NUT_BUTTER_INDICATORS, note: 'Tereyağı → fındık/fıstık ezmesi; süt yağı değil.' },
  wl_318: { reject_name_patterns: NUT_BUTTER_INDICATORS, note: 'Tereyağı (Tuzsuz) → fıstık ezmesi; tuzsuz tereyağı gerekli.' },
  wl_234: { reject_name_patterns: ['substitute', 'muadili', 'muadil'], note: 'Mozzarella → peynir muadili; gerçek mozzarella gerekli.' },
  wl_034: { reject_name_patterns: ['cranberry', 'kizilcik', 'kızılcık', 'juice drink'], note: 'Üzüm Suyu → karışık meyve suyu içeceği.' },
  wl_033: { reject_name_patterns: ['pineapple', 'ananas', 'juice drink'], note: 'Greyfurt Suyu → ananas-greyfurt karışım içeceği.' },
  wl_107: { reject_name_patterns: ['lime juice', 'lime suyu'], note: 'Misket Limonu (bütün) → lime suyu; çiğ lime meyvesi gerekli.' },
  wl_124: { reject_name_patterns: ['juice drink', 'juice', 'suyu'], note: 'Greyfurt (çiğ) → greyfurt suyu içeceği; bütün meyve gerekli.' },
  wl_158: { reject_name_patterns: WRONG_SPINACH_INDICATORS, note: 'Ispanak (Çiğ) → hardal/su ıspanağı; normal ıspanak gerekli.' },
}

function csvCell(value) {
  if (value === null || value === undefined) return ''
  const text = String(value)
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

function toCsvRow(columns, row) {
  return columns.map((col) => csvCell(row[col])).join(',')
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
      if (char === '"' && next === '"') {
        field += '"'
        i += 1
      } else if (char === '"') {
        inQuotes = false
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (char === '\r') {
      // ignore
    } else {
      field += char
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  if (!rows.length) return []

  const headers = rows[0]
  return rows.slice(1).filter((cells) => cells.some((cell) => cell !== '')).map((cells) => {
    const record = {}
    headers.forEach((header, index) => {
      record[header] = cells[index] ?? ''
    })
    return record
  })
}

function formatNumber(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) return ''
  return String(Number(num.toFixed(4)))
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
    .replace(/[^a-z0-9\s%]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeTrAscii(value) {
  return normalizeText(value)
}

function normalizeTrPreserve(value) {
  return String(value || '')
    .toLocaleLowerCase('tr')
    .replace(/[()]/g, ' ')
    .replace(/[^a-z0-9çğıöşü\s%]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenize(value) {
  const normalized = normalizeText(value)
  if (!normalized) return []
  return normalized.split(' ').filter((token) => token.length > 1)
}

function singularizeToken(token) {
  if (token.endsWith('ies') && token.length > 4) return `${token.slice(0, -3)}y`
  if (token.endsWith('es') && token.length > 3) return token.slice(0, -2)
  if (token.endsWith('s') && token.length > 3) return token.slice(0, -1)
  return token
}

function normalizeTokens(value) {
  return [...new Set(tokenize(value).map(singularizeToken))]
}

function textContainsAny(text, patterns) {
  const norm = normalizeText(text)
  return patterns.some((pattern) => norm.includes(normalizeText(pattern)))
}

function textContainsWord(text, word) {
  const norm = normalizeText(text)
  const w = normalizeText(word)
  if (!norm || !w) return false
  const re = new RegExp(`(?:^|\\s)${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s|$)`)
  return re.test(norm)
}

function textContainsRejectIndicator(text, indicator) {
  const norm = normalizeText(indicator)
  if (REJECT_USDA_WORD_INDICATORS.includes(norm)) {
    return textContainsWord(text, norm)
  }
  return textContainsAny(text, [indicator])
}

function parseParentheticalName(nameTr) {
  const trimmed = String(nameTr || '').trim()
  const match = trimmed.match(/^(.+?)\s*\(([^)]+)\)\s*$/)
  if (match) {
    return {
      baseName: match[1].trim(),
      descriptor: match[2].trim(),
      hasParenthetical: true,
    }
  }
  return {
    baseName: trimmed,
    descriptor: '',
    hasParenthetical: false,
  }
}

function extractStates(...texts) {
  const combined = normalizeText(texts.filter(Boolean).join(' '))
  const found = []
  for (const [stateKey, patterns] of Object.entries(STATE_PATTERNS)) {
    if (patterns.some((pattern) => combined.includes(normalizeText(pattern)))) {
      found.push(stateKey)
    }
  }
  return [...new Set(found)]
}

const USDA_MODIFIER_TOKENS = new Set([
  'low', 'moisture', 'whole', 'milk', 'nonfat', 'reduced', 'fat', 'unsalted', 'salted',
  'raw', 'cooked', 'boiled', 'grilled', 'baked', 'fried', 'dried', 'fresh', 'frozen',
  'canned', 'shelf', 'stable', 'from', 'concentrate', 'white', 'red', 'yellow', 'green',
  'sweetened', 'unsweetened', 'plain', 'organic', 'baby', 'junior', 'dry', 'roasted',
  'chunky', 'creamy', 'style', 'type', 'grade', 'lean', 'boneless', 'skinless', 'with',
  'without', 'salt', 'no', 'added', 'sugar', 'free', 'extra', 'virgin', 'cold', 'pressed',
  'percent', '2', '1', 'skim', 'non', 'fat',
])

function extractUsdaPrimaryName(nameEn, nameTr) {
  const source = nameEn || nameTr
  const parsed = parseParentheticalName(source)
  const tokens = normalizeTokens(parsed.baseName)
  const primary = tokens.filter((token) => !USDA_MODIFIER_TOKENS.has(token))
  return primary.length ? primary.join(' ') : parsed.baseName
}

function coreFoodTokenMatch(candidate, usda) {
  const reqTokens = normalizeTokens(`${candidate.name_tr} ${candidate.name_en}`)
  const usdaTokenSet = new Set(normalizeTokens(`${usda.name_en} ${usda.name_tr}`))
  const primary = reqTokens.filter((token) => !USDA_MODIFIER_TOKENS.has(token))
  if (!primary.length || !usdaTokenSet.size) return false
  return primary.some((token) => usdaTokenSet.has(token))
}

function buildFoodIdentity(nameTr, nameEn, targetState, slug = '') {
  const parsed = parseParentheticalName(nameTr)
  const states = extractStates(
    parsed.descriptor,
    parsed.baseName,
    nameTr,
    nameEn,
    targetState,
    slug,
  )

  return {
    baseName: parsed.baseName,
    descriptor: parsed.descriptor,
    hasParenthetical: parsed.hasParenthetical,
    states,
    fullName: nameTr,
    nameEn: nameEn || '',
    targetState: targetState || '',
    slug,
  }
}

function statesCompatible(requestStates, catalogStates, requestTarget, catalogTarget) {
  const req = [...new Set([...requestStates, ...extractStates(requestTarget)])]
  const cat = [...new Set([...catalogStates, ...extractStates(catalogTarget)])]

  if (!req.length && !cat.length) return true
  if (!req.length || !cat.length) {
    const plainish = ['plain', 'any', 'prepared']
    const reqLoose = req.length ? req : extractStates(requestTarget)
    const catLoose = cat.length ? cat : extractStates(catalogTarget)
    if (!reqLoose.length && !catLoose.length) return true
    if (reqLoose.some((s) => plainish.includes(s)) || catLoose.some((s) => plainish.includes(s))) {
      return !hasOppositeStates(reqLoose, catLoose)
    }
    return false
  }

  const reqSet = new Set(req)
  const catSet = new Set(cat)
  const intersection = [...reqSet].filter((s) => catSet.has(s))
  if (intersection.length) return true

  return !hasOppositeStates(req, cat)
}

function hasOppositeStates(aStates, bStates) {
  for (const [left, right] of OPPOSITE_STATE_PAIRS) {
    const aHasLeft = aStates.includes(left)
    const aHasRight = aStates.includes(right)
    const bHasLeft = bStates.includes(left)
    const bHasRight = bStates.includes(right)
    if ((aHasLeft && bHasRight) || (aHasRight && bHasLeft)) return true
  }
  return false
}

function baseNamesMatch(requestBase, catalogBase, requestEn = '', catalogSlug = '') {
  const reqTr = normalizeTrPreserve(requestBase)
  const catTr = normalizeTrPreserve(catalogBase)
  const reqAscii = normalizeTrAscii(requestBase)
  const catAscii = normalizeTrAscii(catalogBase)

  if (reqTr && catTr && reqTr === catTr) return { match: true, strength: 1 }
  if (reqAscii && catAscii && reqAscii === catAscii) return { match: true, strength: 0.95 }

  const reqTokens = normalizeTokens(requestBase)
  const catTokens = normalizeTokens(catalogBase)
  if (reqTokens.length && catTokens.length) {
    const reqSet = new Set(reqTokens)
    const catSet = new Set(catTokens)
    let overlap = 0
    for (const token of reqSet) {
      if (catSet.has(token)) overlap += 1
    }
    const ratio = overlap / Math.max(reqSet.size, catSet.size)
    if (ratio >= 0.85 && reqSet.size === catSet.size) {
      return { match: true, strength: 0.9 }
    }
    if (ratio >= 0.7) return { match: true, strength: 0.75 }
  }

  if (requestEn) {
    const reqEnNorm = normalizeText(requestEn)
    const catCombined = normalizeText(`${catalogBase} ${catalogSlug}`)
    if (reqEnNorm && (catCombined.includes(reqEnNorm) || reqEnNorm.includes(catCombined))) {
      return { match: true, strength: 0.8 }
    }
    const enOverlap = tokenOverlapScore(normalizeTokens(requestEn), `${catalogBase} ${catalogSlug}`)
    if (enOverlap >= 0.75) return { match: true, strength: 0.75 }
  }

  return { match: false, strength: 0 }
}

function tokenOverlapScore(requestTokens, matchText) {
  const tokens = Array.isArray(requestTokens) ? requestTokens : normalizeTokens(requestTokens)
  if (!tokens.length) return 0
  const matchTokenSet = new Set(normalizeTokens(matchText))
  if (!matchTokenSet.size) return 0
  let overlap = 0
  for (const token of tokens) {
    if (matchTokenSet.has(token)) overlap += 1
  }
  return overlap / tokens.length
}

function findCatalogMatch(candidate, catalogFoods) {
  const reqIdentity = buildFoodIdentity(
    candidate.name_tr,
    candidate.name_en,
    candidate.target_state,
  )

  let best = null

  for (const food of catalogFoods) {
    const catIdentity = buildFoodIdentity(food.name, '', '', food.slug || '')
    const baseMatch = baseNamesMatch(
      reqIdentity.baseName,
      catIdentity.baseName,
      reqIdentity.nameEn,
      catIdentity.slug,
    )

    if (!baseMatch.match) continue

    const stateOk = statesCompatible(
      reqIdentity.states,
      catIdentity.states,
      reqIdentity.targetState,
      '',
    )

    let confidence = 'none'
    let score = baseMatch.strength

    if (stateOk) {
      const trExact =
        normalizeTrPreserve(reqIdentity.fullName) === normalizeTrPreserve(catIdentity.fullName) ||
        normalizeTrAscii(reqIdentity.fullName) === normalizeTrAscii(catIdentity.fullName)

      if (trExact && baseMatch.strength >= 0.95) {
        confidence = 'exact'
        score += 0.2
      } else if (baseMatch.strength >= 0.85 && stateOk) {
        confidence = 'strong'
        score += 0.1
      } else if (baseMatch.strength >= 0.7) {
        confidence = 'strong'
      } else {
        confidence = 'medium'
      }
    } else if (baseMatch.strength >= 0.85) {
      confidence = 'medium'
      score -= 0.15
    } else {
      continue
    }

    if (
      reqIdentity.hasParenthetical !== catIdentity.hasParenthetical &&
      reqIdentity.descriptor &&
      catIdentity.descriptor &&
      normalizeTrAscii(reqIdentity.descriptor) !== normalizeTrAscii(catIdentity.descriptor)
    ) {
      confidence = 'medium'
      score -= 0.1
    }

    if (!best || score > best.score) {
      best = {
        food,
        confidence,
        score,
        stateOk,
      }
    }
  }

  if (!best) {
    return {
      exists: false,
      food_id: '',
      food_name: '',
      confidence: 'none',
    }
  }

  return {
    exists: best.confidence === 'exact' || best.confidence === 'strong' || best.confidence === 'medium',
    food_id: best.confidence === 'none' ? '' : best.food.id,
    food_name: best.confidence === 'none' ? '' : best.food.name,
    confidence: best.confidence,
    stateOk: best.stateOk,
  }
}

function mapUsdaCandidate(reviewRow, prefix) {
  const id = reviewRow[`${prefix}_food_id`]
  if (!id) return null
  return {
    food_id: id,
    name_en: reviewRow[`${prefix}_name_en`] || '',
    name_tr: reviewRow[`${prefix}_name_tr`] || '',
    category: reviewRow[`${prefix}_category`] || '',
    calories_100g: reviewRow[`${prefix}_calories_100g`],
    protein_100g: reviewRow[`${prefix}_protein_100g`],
    carbs_100g: reviewRow[`${prefix}_carbs_100g`],
    fat_100g: reviewRow[`${prefix}_fat_100g`],
    fiber_100g: reviewRow[`${prefix}_fiber_100g`],
    sugar_100g: reviewRow[`${prefix}_sugar_100g`],
    sodium_mg_100g: reviewRow[`${prefix}_sodium_mg_100g`],
    score: reviewRow[`${prefix}_score`],
  }
}

function getUsdaCandidates(reviewRow) {
  return ['candidate_1', 'candidate_2', 'candidate_3']
    .map((prefix) => mapUsdaCandidate(reviewRow, prefix))
    .filter(Boolean)
}

function isWholeFruitRequested(candidate) {
  const text = normalizeText(`${candidate.name_tr} ${candidate.name_en} ${candidate.target_state}`)
  const isJuiceRequested = text.includes('juice') || text.includes('suyu') || candidate.target_state === '100% juice'
  if (isJuiceRequested) return false
  return extractStates(candidate.name_tr, candidate.name_en, candidate.target_state).includes('raw')
    || candidate.target_state === 'raw'
    || normalizeText(candidate.category_tr) === 'meyve'
}

function isJuiceRequested(candidate) {
  const text = normalizeText(`${candidate.name_tr} ${candidate.name_en}`)
  return text.includes('juice') || text.includes('suyu') || candidate.target_state === '100% juice'
}

function isDairyButterRequested(candidate) {
  const text = normalizeText(`${candidate.name_tr} ${candidate.name_en}`)
  return text.includes('tereyag') || text.includes('butter')
}

function isCheeseRequested(candidate) {
  const text = normalizeText(`${candidate.name_tr} ${candidate.name_en} ${candidate.category_tr}`)
  return text.includes('cheese') || text.includes('peynir') || text.includes('mozzarella')
}

function isSpinachRequested(candidate) {
  const text = normalizeText(`${candidate.name_tr} ${candidate.name_en}`)
  return text.includes('ispanak') || text.includes('spinach')
}

function isQuinoaRequested(candidate) {
  const text = normalizeText(`${candidate.name_tr} ${candidate.name_en}`)
  return text.includes('kinoa') || text.includes('quinoa')
}

function categoryMatches(candidate, usda) {
  const cat = normalizeText(candidate.category_tr)
  const hints = CATEGORY_HINTS[cat]
  if (!hints?.length) return true
  const usdaText = normalizeText(`${usda.name_en} ${usda.name_tr} ${usda.category}`)
  return hints.some((hint) => usdaText.includes(normalizeText(hint)))
}

function auditUsdaCandidate(candidate, usda) {
  const usdaText = `${usda.name_en} ${usda.name_tr} ${usda.category}`
  const requestText = `${candidate.name_tr} ${candidate.name_en} ${candidate.target_state}`
  const reqStates = extractStates(candidate.name_tr, candidate.name_en, candidate.target_state)
  const usdaStates = extractStates(usda.name_en, usda.name_tr)

  let state_match = statesCompatible(reqStates, usdaStates, candidate.target_state, '')
  let base_food_match = false
  let variant_warning = ''
  let rejectReason = ''

  const reqIdentity = buildFoodIdentity(candidate.name_tr, candidate.name_en, candidate.target_state)
  const usdaPrimary = extractUsdaPrimaryName(usda.name_en, usda.name_tr)
  const usdaIdentity = buildFoodIdentity(usda.name_tr || usda.name_en, usda.name_en, '')

  const baseResult = baseNamesMatch(
    reqIdentity.baseName,
    usdaPrimary || usdaIdentity.baseName,
    reqIdentity.nameEn,
    normalizeText(usda.name_en),
  )
  base_food_match = baseResult.match && baseResult.strength >= 0.55

  const nameOverlap = Math.max(
    tokenOverlapScore(normalizeTokens(candidate.name_en), usdaText),
    tokenOverlapScore(normalizeTokens(candidate.name_tr), usdaText),
    tokenOverlapScore(normalizeTokens(`${candidate.name_en} ${candidate.search_keywords_en}`), usdaText),
  )

  if (!base_food_match && coreFoodTokenMatch(candidate, usda)) base_food_match = true
  if (!base_food_match && nameOverlap >= 0.6) base_food_match = true
  if (!base_food_match && normalizeText(candidate.name_en) === normalizeText(usda.name_en)) {
    base_food_match = true
  }

  const category_match = categoryMatches(candidate, usda)

  // Reject indicators in USDA but not requested
  for (const indicator of REJECT_USDA_INDICATORS) {
    if (textContainsRejectIndicator(usdaText, indicator) && !textContainsRejectIndicator(requestText, indicator)) {
      rejectReason = `USDA adayında istenmeyen ürün tipi: "${indicator}".`
      base_food_match = false
      break
    }
  }

  // Known hard-coded wrong matches
  const knownWrong = KNOWN_WRONG_TOP_MATCHES[candidate.candidate_id]
  if (knownWrong && textContainsAny(usdaText, knownWrong.reject_name_patterns)) {
    rejectReason = knownWrong.note
    base_food_match = false
    state_match = false
  }

  // Nut butter vs dairy butter
  if (!rejectReason && isDairyButterRequested(candidate) && textContainsAny(usdaText, NUT_BUTTER_INDICATORS)) {
    rejectReason = 'Süt tereyağı isteniyor; kuruyemiş ezmesi eşleşmesi reddedildi.'
    base_food_match = false
  }

  // Cheese substitute
  if (!rejectReason && isCheeseRequested(candidate) && textContainsAny(usdaText, ['substitute', 'muadili', 'muadil'])) {
    rejectReason = 'Gerçek peynir isteniyor; peynir muadili reddedildi.'
    base_food_match = false
  }

  // Juice vs whole fruit
  if (!rejectReason && isWholeFruitRequested(candidate) && textContainsAny(usdaText, ['juice', 'suyu', 'drink', 'icecegi', 'içeceği'])) {
    rejectReason = 'Bütün meyve isteniyor; meyve suyu/içecek eşleşmesi reddedildi.'
    base_food_match = false
    state_match = false
  }

  // Single-fruit juice vs mixed juice
  if (!rejectReason && isJuiceRequested(candidate) && textContainsAny(usdaText, MIXED_JUICE_INDICATORS)) {
    const reqSingle = normalizeText(reqIdentity.baseName)
    const isMixedOnly = MIXED_JUICE_INDICATORS.some((ind) => textContainsAny(usdaText, [ind]) && !reqSingle.includes(normalizeText(ind)))
    if (isMixedOnly) {
      rejectReason = 'Tek meyve suyu isteniyor; karışık meyve suyu içeceği reddedildi.'
      base_food_match = false
    }
  }

  // Wrong spinach types
  if (!rejectReason && isSpinachRequested(candidate) && textContainsAny(usdaText, WRONG_SPINACH_INDICATORS)) {
    rejectReason = 'Normal ıspanak isteniyor; hardal/su ıspanağı reddedildi.'
    base_food_match = false
  }

  // Quinoa flour
  if (!rejectReason && isQuinoaRequested(candidate) && (
    textContainsAny(usdaText, ['flour', 'unu']) || textContainsWord(usdaText, 'un')
  )) {
    rejectReason = 'Kinoa isteniyor; kinoa unu reddedildi.'
    base_food_match = false
  }

  // Dairy fat level mismatch
  const milkStates = ['whole_milk', 'skim_milk', 'reduced_fat']
  const reqMilk = reqStates.filter((s) => milkStates.includes(s))
  const usdaMilk = usdaStates.filter((s) => milkStates.includes(s))
  if (reqMilk.length && usdaMilk.length && hasOppositeStates(reqMilk, usdaMilk)) {
    rejectReason = 'Süt yağ oranı uyuşmuyor (tam/yarım/yağsız).'
    state_match = false
    base_food_match = false
  }

  // Cooking state conflict
  if (!rejectReason && hasOppositeStates(reqStates, usdaStates)) {
    rejectReason = 'Pişirme/çiğ durumu uyuşmuyor.'
    state_match = false
  }

  // Generic request vs overly specific USDA variant
  if (!rejectReason && !reqIdentity.hasParenthetical && base_food_match) {
    const specificIndicators = ['white ', 'red ', 'baby ', 'organic ', 'canned', 'konserve', 'from concentrate', 'konsantre']
    if (specificIndicators.some((ind) => textContainsAny(usdaText, [ind]) && !textContainsAny(requestText, [ind]))) {
      variant_warning = 'Aday, istenen jenerik gıdadan daha özel bir varyant olabilir.'
    }
  }

  if (textContainsAny(usdaText, ['concentrate', 'konsantre']) && !textContainsAny(requestText, ['concentrate', 'konsantre'])) {
    variant_warning = variant_warning || 'Konsantre ürün; normal suyu/sütü olmayabilir.'
  }

  if (textContainsAny(usdaText, ['substitute', 'muadili'])) {
    variant_warning = variant_warning || 'Muadil ürün.'
  }

  // Re-assert core token alignment after rejection heuristics.
  if (!rejectReason && coreFoodTokenMatch(candidate, usda)) {
    base_food_match = true
  }

  if (
    !rejectReason &&
    isCheeseRequested(candidate) &&
    coreFoodTokenMatch(candidate, usda) &&
    !textContainsAny(usdaText, ['substitute', 'muadili', 'muadil'])
  ) {
    base_food_match = true
    state_match = true
  }

  if (!rejectReason && isWeakCulturalMatch(candidate, usda)) {
    rejectReason = 'Kültüre özgü hazırlık ile jenerik USDA adayı uyuşmuyor.'
    base_food_match = false
    state_match = false
  }

  const missing = []
  if (usda.fiber_100g === '' || usda.fiber_100g === null || usda.fiber_100g === undefined) missing.push('fiber')
  if (usda.sugar_100g === '' || usda.sugar_100g === null || usda.sugar_100g === undefined) missing.push('sugar')
  if (usda.sodium_mg_100g === '' || usda.sodium_mg_100g === null || usda.sodium_mg_100g === undefined) missing.push('sodium')
  const missing_nutrient_warning = missing.length ? `Eksik mikrobesin: ${missing.join(', ')}` : ''

  const rejected = Boolean(rejectReason) || !base_food_match

  let confidence = 'none'
  if (!rejected && state_match && base_food_match && category_match && !variant_warning) {
    confidence = 'high'
  } else if (!rejected && base_food_match && state_match && category_match) {
    confidence = 'medium'
  } else if (!rejected && base_food_match && (state_match || category_match)) {
    confidence = 'low'
  }

  return {
    state_match,
    base_food_match,
    category_match,
    variant_warning,
    missing_nutrient_warning,
    rejected,
    reject_reason: rejectReason,
    confidence,
    usda,
  }
}

function isWeakCulturalMatch(candidate, usda) {
  const req = normalizeText(`${candidate.name_tr} ${candidate.name_en}`)
  const usdaNorm = normalizeText(`${usda.name_en} ${usda.name_tr}`)
  if ((req.includes('turk kahvesi') || req.includes('turkish coffee')) && usdaNorm.includes('brewed coffee')) {
    return true
  }
  if ((req.includes('turk cayi') || req.includes('black tea')) && usdaNorm.includes('ready to drink')) {
    return true
  }
  return false
}

function pickBestUsdaMatch(candidate, reviewRow) {
  const candidates = getUsdaCandidates(reviewRow)
  const audited = candidates.map((usda) => auditUsdaCandidate(candidate, usda))

  const approved = audited.filter((a) => !a.rejected)
  approved.sort((a, b) => {
    const rank = { high: 3, medium: 2, low: 1, none: 0 }
    const diff = rank[b.confidence] - rank[a.confidence]
    if (diff !== 0) return diff
    return Number(b.usda.score) - Number(a.usda.score)
  })

  if (approved.length) return approved[0]

  // All candidates rejected — return the highest-scored rejected audit for traceability.
  const rejected = [...audited].sort((a, b) => Number(b.usda.score) - Number(a.usda.score))
  return rejected[0] ?? null
}

function buildDuplicateKeys(candidates) {
  const keyMap = new Map()
  for (const c of candidates) {
    const identity = buildFoodIdentity(c.name_tr, c.name_en, c.target_state)
    const descriptorKey = identity.descriptor ? normalizeTrAscii(identity.descriptor) : ''
    const key = [
      normalizeTrAscii(identity.baseName),
      descriptorKey,
      [...identity.states].sort().join('|'),
      normalizeText(c.category_tr),
    ].join('::')
    if (!keyMap.has(key)) keyMap.set(key, [])
    keyMap.get(key).push(c.candidate_id)
  }
  return keyMap
}

function decideAudit(candidate, reviewRow, catalogMatch, usdaAudit, isDuplicate) {
  const source = candidate.preferred_source
  const originalStatus = reviewRow.match_status || ''
  const exists = catalogMatch.exists && catalogMatch.confidence !== 'none'

  if (isDuplicate) {
    return {
      decision: 'duplicate_wishlist_candidate',
      note: 'Aynı gıda+durum+kategori ile birden fazla wishlist satırı var.',
    }
  }

  if (source === 'TURKOMP_OR_RECIPE') {
    return {
      decision: 'recipe_or_turkomp_needed',
      note: reviewRow.review_note || 'Tarif veya TÜRKOMP kaynağı gerekli.',
    }
  }

  if (source === 'OPEN_FOOD_FACTS') {
    return {
      decision: 'open_food_facts_needed',
      note: reviewRow.review_note || 'Paketli ürün — Open Food Facts gerekli.',
    }
  }

  if (source === 'MANUAL_REVIEW' && originalStatus !== 'can_update_from_usda' && originalStatus !== 'likely_match_manual_check') {
    return {
      decision: 'manual_source_needed',
      note: reviewRow.review_note || 'Manuel besin değeri doğrulaması gerekli.',
    }
  }

  const usda = usdaAudit?.usda
  const hasUsda = Boolean(usda?.food_id)

  if (hasUsda && usdaAudit.rejected) {
    // If every ranked USDA candidate failed, surface manual follow-up rather than silent approval.
    if (exists) {
      return {
        decision: 'manual_review_existing_food',
        note: `${usdaAudit.reject_reason || 'USDA eşleşmesi reddedildi.'} Mevcut katalog girdisi var (${catalogMatch.food_name}).`,
      }
    }
    const note = usdaAudit.reject_reason
      ? `${usdaAudit.reject_reason} Alternatif USDA adayı da uygun değil.`
      : 'USDA adayı farklı gıda/ürün tipi — reddedildi.'
    return {
      decision: 'reject_wrong_usda_match',
      note,
    }
  }

  if (!hasUsda) {
    if (exists) {
      return {
        decision: 'manual_review_existing_food',
        note: 'Katalogda mevcut; USDA adayı yok veya zayıf. Manuel doğrulama gerekli.',
      }
    }
    if (source === 'MANUAL_REVIEW') {
      return {
        decision: 'manual_source_needed',
        note: reviewRow.review_note || 'Manuel besin değeri doğrulaması gerekli.',
      }
    }
    return {
      decision: 'manual_review_new_food',
      note: reviewRow.review_note || 'Yeni gıda adayı; uygun USDA eşleşmesi bulunamadı.',
    }
  }

  const highConfidence = usdaAudit.confidence === 'high'
  const mediumConfidence = usdaAudit.confidence === 'medium'

  if (exists) {
    if (highConfidence) {
      return {
        decision: 'approved_existing_food_update',
        note: `Mevcut katalog girdisi (${catalogMatch.food_name}) ile USDA eşleşmesi onaylandı; güncelleme adayı.`,
      }
    }
    return {
      decision: 'manual_review_existing_food',
      note: usdaAudit.variant_warning
        ? `Mevcut gıda; USDA adayı yakın ancak varyant uyarısı: ${usdaAudit.variant_warning}`
        : 'Mevcut gıda; USDA eşleşmesi tam kesin değil — elle kontrol gerekli.',
    }
  }

  if (highConfidence) {
    return {
      decision: 'approved_new_food_candidate',
      note: 'Yeni gıda adayı; USDA eşleşmesi onaylandı.',
    }
  }

  if (mediumConfidence) {
    return {
      decision: 'manual_review_new_food',
      note: usdaAudit.variant_warning
        ? `Yeni gıda; USDA adayı orta güven: ${usdaAudit.variant_warning}`
        : 'Yeni gıda; USDA adayı orta güven — elle kontrol gerekli.',
    }
  }

  return {
    decision: 'manual_review_new_food',
    note: 'Yeni gıda; USDA adayı düşük güven veya eksik hizalama.',
  }
}

function buildAuditRow(candidate, reviewRow, catalogMatch, usdaAudit, decision, note, isDuplicate) {
  const usda = usdaAudit?.usda
  return {
    candidate_id: candidate.candidate_id,
    name_tr: candidate.name_tr,
    name_en: candidate.name_en,
    category_tr: candidate.category_tr,
    target_state: candidate.target_state,
    preferred_source: candidate.preferred_source,
    exists_in_current_catalog: catalogMatch.exists && catalogMatch.confidence !== 'none' ? 'true' : 'false',
    existing_food_id: catalogMatch.food_id || '',
    existing_food_name: catalogMatch.food_name || '',
    existing_match_confidence: catalogMatch.confidence || 'none',
    original_match_status: reviewRow.match_status || '',
    usda_food_id: usda?.food_id || '',
    usda_name_en: usda?.name_en || '',
    usda_calories_100g: formatNumber(usda?.calories_100g),
    usda_protein_100g: formatNumber(usda?.protein_100g),
    usda_carbs_100g: formatNumber(usda?.carbs_100g),
    usda_fat_100g: formatNumber(usda?.fat_100g),
    usda_fiber_100g: usda?.fiber_100g === '' || usda?.fiber_100g == null ? '' : formatNumber(usda?.fiber_100g),
    usda_sugar_100g: usda?.sugar_100g === '' || usda?.sugar_100g == null ? '' : formatNumber(usda?.sugar_100g),
    usda_sodium_mg_100g: usda?.sodium_mg_100g === '' || usda?.sodium_mg_100g == null ? '' : formatNumber(usda?.sodium_mg_100g),
    usda_score: formatNumber(usda?.score),
    state_match: usdaAudit ? String(usdaAudit.state_match) : '',
    base_food_match: usdaAudit ? String(usdaAudit.base_food_match) : '',
    category_match: usdaAudit ? String(usdaAudit.category_match) : '',
    variant_warning: usdaAudit?.variant_warning || '',
    missing_nutrient_warning: usdaAudit?.missing_nutrient_warning || '',
    audit_decision: decision,
    audit_note: note,
  }
}

function main() {
  const wishlist = parseCsv(readFileSync(WISHLIST_CSV, 'utf8'))
  const usdaReview = parseCsv(readFileSync(USDA_REVIEW_CSV, 'utf8'))
  const reviewById = new Map(usdaReview.map((row) => [row.candidate_id, row]))

  const catalogFoods = MASTER_FOOD_DB.map((food) => ({
    id: food.id,
    name: food.name,
    slug: food.slug || '',
    category: food.category || '',
  }))

  const duplicateKeys = buildDuplicateKeys(wishlist)
  const duplicateIds = new Set()
  for (const ids of duplicateKeys.values()) {
    if (ids.length > 1) ids.forEach((id) => duplicateIds.add(id))
  }

  const auditRows = []

  for (const candidate of wishlist) {
    const reviewRow = reviewById.get(candidate.candidate_id) || {}
    const catalogMatch = findCatalogMatch(candidate, catalogFoods)
    const usdaAudit = pickBestUsdaMatch(candidate, reviewRow)
    const isDuplicate = duplicateIds.has(candidate.candidate_id)

    const { decision, note } = decideAudit(candidate, reviewRow, catalogMatch, usdaAudit, isDuplicate)
    auditRows.push(buildAuditRow(candidate, reviewRow, catalogMatch, usdaAudit, decision, note, isDuplicate))
  }

  mkdirSync(OUTPUT_DIR, { recursive: true })

  const auditCsv = [
    AUDIT_COLUMNS.join(','),
    ...auditRows.map((row) => toCsvRow(AUDIT_COLUMNS, row)),
  ].join('\n')
  writeFileSync(AUDIT_CSV, `${auditCsv}\n`, 'utf8')

  const existingUpdates = auditRows.filter((row) =>
    ['approved_existing_food_update', 'manual_review_existing_food'].includes(row.audit_decision),
  )
  const newCandidates = auditRows.filter((row) =>
    ['approved_new_food_candidate', 'manual_review_new_food'].includes(row.audit_decision),
  )

  for (const [file, rows] of [[EXISTING_UPDATES_CSV, existingUpdates], [NEW_CANDIDATES_CSV, newCandidates]]) {
    const csv = [
      SUBSET_COLUMNS.join(','),
      ...rows.map((row) => toCsvRow(SUBSET_COLUMNS, row)),
    ].join('\n')
    writeFileSync(file, `${csv}\n`, 'utf8')
  }

  const summary = {
    total_wishlist_rows: auditRows.length,
    exact_or_strong_existing_catalog_matches: auditRows.filter((r) =>
      r.exists_in_current_catalog === 'true' && ['exact', 'strong'].includes(r.existing_match_confidence),
    ).length,
    medium_existing_catalog_matches: auditRows.filter((r) =>
      r.exists_in_current_catalog === 'true' && r.existing_match_confidence === 'medium',
    ).length,
    approved_existing_food_updates: auditRows.filter((r) => r.audit_decision === 'approved_existing_food_update').length,
    approved_new_food_candidates: auditRows.filter((r) => r.audit_decision === 'approved_new_food_candidate').length,
    rejected_wrong_usda_matches: auditRows.filter((r) => r.audit_decision === 'reject_wrong_usda_match').length,
    manual_review_rows: auditRows.filter((r) =>
      ['manual_review_existing_food', 'manual_review_new_food'].includes(r.audit_decision),
    ).length,
    recipe_or_turkomp_rows: auditRows.filter((r) => r.audit_decision === 'recipe_or_turkomp_needed').length,
    open_food_facts_rows: auditRows.filter((r) => r.audit_decision === 'open_food_facts_needed').length,
    manual_source_rows: auditRows.filter((r) => r.audit_decision === 'manual_source_needed').length,
    duplicate_wishlist_candidates: auditRows.filter((r) => r.audit_decision === 'duplicate_wishlist_candidate').length,
    original_can_update_overridden: auditRows.filter((r) =>
      r.original_match_status === 'can_update_from_usda' &&
      !['approved_existing_food_update', 'approved_new_food_candidate', 'manual_review_existing_food', 'manual_review_new_food'].includes(r.audit_decision),
    ).length,
  }

  console.log('=== Food Wishlist Match Audit Summary ===')
  console.log(`Total wishlist rows: ${summary.total_wishlist_rows}`)
  console.log(`Exact/strong existing catalog matches: ${summary.exact_or_strong_existing_catalog_matches}`)
  console.log(`Medium existing catalog matches: ${summary.medium_existing_catalog_matches}`)
  console.log(`Approved existing-food USDA updates: ${summary.approved_existing_food_updates}`)
  console.log(`Approved genuinely new USDA foods: ${summary.approved_new_food_candidates}`)
  console.log(`Wrong USDA matches rejected: ${summary.rejected_wrong_usda_matches}`)
  console.log(`Manual-review rows: ${summary.manual_review_rows}`)
  console.log(`Recipe/TÜRKOMP rows: ${summary.recipe_or_turkomp_rows}`)
  console.log(`Open Food Facts rows: ${summary.open_food_facts_rows}`)
  console.log(`Manual-source rows: ${summary.manual_source_rows}`)
  console.log(`Duplicate wishlist candidates: ${summary.duplicate_wishlist_candidates}`)
  console.log(`Original can_update_from_usda overridden by audit: ${summary.original_can_update_overridden}`)
  console.log('')
  console.log(`Wrote ${AUDIT_CSV}`)
  console.log(`Wrote ${EXISTING_UPDATES_CSV} (${existingUpdates.length} rows)`)
  console.log(`Wrote ${NEW_CANDIDATES_CSV} (${newCandidates.length} rows)`)
}

main()