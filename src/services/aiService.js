/**
 * AI services for Kalorimetre
 * - parseMealTextWithAI / getHealthierAlternatives / estimatePortionWeight: Groq (VITE_GROQ_API_KEY)
 */

import { FOOD_DB } from '../utils/foodDatabase.js'

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MAX_ALTERNATIVES = 3
const MAX_MENUS = 2
const MAX_CANDIDATES = 30
const FALLBACK_MSG = 'YZ önerisi alınamadı, yerel öneriler gösteriliyor.'

const EMPTY_RECOMMENDATIONS = { healthier: [], similar: [], menus: [] }

const MEAL_ROLE = {
  LEAN_POULTRY: 'lean_poultry',
  LEAN_MEAT:    'lean_meat',
  FISH:         'fish',
  SHELLFISH:    'shellfish',
  EGG:          'egg',
  FRUIT:        'fruit',
  GRAIN:        'grain',
  DESSERT:      'dessert',
  DRINK:        'drink',
  SNACK:        'snack',
  SAUCE:        'sauce',
  DAIRY:        'dairy',
  LEGUME:       'legume',
  VEGETABLE:    'vegetable',
  SOUP:         'soup',
  MIXED_DISH:   'mixed_dish',
  OTHER:        'other',
}

const LIMITED_ROLES = new Set([
  MEAL_ROLE.DESSERT,
  MEAL_ROLE.DRINK,
  MEAL_ROLE.SNACK,
  MEAL_ROLE.SAUCE,
])

const SIMILAR_ROLES = {
  [MEAL_ROLE.LEAN_POULTRY]: [MEAL_ROLE.LEAN_POULTRY, MEAL_ROLE.LEAN_MEAT, MEAL_ROLE.FISH, MEAL_ROLE.MIXED_DISH],
  [MEAL_ROLE.LEAN_MEAT]:    [MEAL_ROLE.LEAN_MEAT, MEAL_ROLE.LEAN_POULTRY, MEAL_ROLE.FISH, MEAL_ROLE.MIXED_DISH],
  [MEAL_ROLE.FISH]:         [MEAL_ROLE.FISH, MEAL_ROLE.SHELLFISH, MEAL_ROLE.LEAN_POULTRY, MEAL_ROLE.LEAN_MEAT],
  [MEAL_ROLE.SHELLFISH]:    [MEAL_ROLE.SHELLFISH, MEAL_ROLE.FISH],
  [MEAL_ROLE.EGG]:          [MEAL_ROLE.EGG, MEAL_ROLE.DAIRY],
  [MEAL_ROLE.FRUIT]:        [MEAL_ROLE.FRUIT, MEAL_ROLE.DAIRY],
  [MEAL_ROLE.GRAIN]:        [MEAL_ROLE.GRAIN, MEAL_ROLE.LEGUME, MEAL_ROLE.VEGETABLE],
  [MEAL_ROLE.DESSERT]:      [MEAL_ROLE.DESSERT, MEAL_ROLE.FRUIT, MEAL_ROLE.DAIRY],
  [MEAL_ROLE.DRINK]:        [MEAL_ROLE.DRINK],
  [MEAL_ROLE.SNACK]:        [MEAL_ROLE.SNACK, MEAL_ROLE.FRUIT, MEAL_ROLE.DAIRY],
  [MEAL_ROLE.SAUCE]:        [MEAL_ROLE.SAUCE],
  [MEAL_ROLE.DAIRY]:        [MEAL_ROLE.DAIRY, MEAL_ROLE.FRUIT, MEAL_ROLE.EGG],
  [MEAL_ROLE.LEGUME]:       [MEAL_ROLE.LEGUME, MEAL_ROLE.GRAIN, MEAL_ROLE.VEGETABLE, MEAL_ROLE.SOUP],
  [MEAL_ROLE.VEGETABLE]:    [MEAL_ROLE.VEGETABLE, MEAL_ROLE.LEGUME, MEAL_ROLE.SOUP],
  [MEAL_ROLE.SOUP]:         [MEAL_ROLE.SOUP, MEAL_ROLE.LEGUME, MEAL_ROLE.VEGETABLE],
  [MEAL_ROLE.MIXED_DISH]:   [MEAL_ROLE.MIXED_DISH, MEAL_ROLE.LEAN_POULTRY, MEAL_ROLE.LEAN_MEAT],
  [MEAL_ROLE.OTHER]:        [MEAL_ROLE.OTHER],
}

const ROLE_LABELS_TR = {
  [MEAL_ROLE.LEAN_POULTRY]: 'ana yemek / yağsız kümes hayvanı proteini',
  [MEAL_ROLE.LEAN_MEAT]:    'ana yemek / yağsız kırmızı et proteini',
  [MEAL_ROLE.FISH]:         'balık / deniz proteini',
  [MEAL_ROLE.SHELLFISH]:    'kabuklu deniz ürünü',
  [MEAL_ROLE.EGG]:          'yumurta / kahvaltı proteini',
  [MEAL_ROLE.FRUIT]:        'meyve',
  [MEAL_ROLE.GRAIN]:        'tahıl / karbonhidrat',
  [MEAL_ROLE.DESSERT]:      'tatlı / dessert',
  [MEAL_ROLE.DRINK]:        'içecek',
  [MEAL_ROLE.SNACK]:        'atıştırmalık',
  [MEAL_ROLE.SAUCE]:        'sos',
  [MEAL_ROLE.DAIRY]:        'süt ürünü',
  [MEAL_ROLE.LEGUME]:       'baklagil',
  [MEAL_ROLE.VEGETABLE]:    'sebze / salata',
  [MEAL_ROLE.SOUP]:         'çorba',
  [MEAL_ROLE.MIXED_DISH]:   'karma ana yemek',
  [MEAL_ROLE.OTHER]:        'genel',
}

function devLog(...args) {
  if (import.meta.env.DEV) console.log('[alternatives]', ...args)
}

const MEAL_PARSE_SYSTEM_PROMPT =
  'Sen Türk bir beslenme uzmanısın. Kullanıcının yemeğini analiz et. SADECE VE SADECE şu JSON objesini döndür: {"meals": [{"name":"...","calories":...,"protein":...,"carbs":...,"fat":...,"amount":"...g"}]}. Başka hiçbir açıklama yapma.'

function getGroqKey() {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY
  if (!apiKey) {
    throw new Error('Groq API anahtarı eksik. Lütfen .env dosyanıza VITE_GROQ_API_KEY ekleyin.')
  }
  return apiKey
}

/** Strip markdown fences before JSON parsing. */
function stripMarkdown(rawText) {
  return String(rawText ?? '')
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim()
}

/** Aggressively sanitize AI text into parseable JSON. */
function sanitizeJson(text) {
  let s = stripMarkdown(text)
  s = s.replace(/`/g, '')
  s = s.replace(/\bjson\b/gi, '')
  s = s.trim()
  const arrayMatch = s.match(/\[[\s\S]*\]/)
  if (arrayMatch) return arrayMatch[0]
  const objectMatch = s.match(/\{[\s\S]*\}/)
  if (objectMatch) return objectMatch[0]
  return s
}

function parseJsonArray(rawText, logLabel = 'Groq') {
  const cleanText = sanitizeJson(rawText)
  try {
    const parsedData = JSON.parse(cleanText)
    return Array.isArray(parsedData) ? parsedData : null
  } catch (err) {
    console.log(`[${logLabel}] JSON parse failed. Raw response:`, rawText)
    throw new Error(err?.message || 'Geçersiz JSON yanıtı')
  }
}

async function groqChat(messages, { temperature = 0.1, maxTokens = 2000, jsonMode = false } = {}) {
  const apiKey = getGroqKey()

  const body = {
    model: 'llama-3.1-8b-instant',
    temperature,
    max_tokens: maxTokens,
    messages,
  }
  if (jsonMode) {
    body.response_format = { type: 'json_object' }
  }

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}))
    throw new Error(errData.error?.message || `Groq API hatası: ${response.status}`)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content?.trim() ?? ''
}

/**
 * Parse a free-text Turkish meal description using Groq (Llama 3).
 * Returns portion-level macros (not per 100g).
 * @param {string} text
 * @returns {Promise<Array<{ name: string, calories: number, protein: number, carbs: number, fat: number, amount: string }>>}
 */
export async function parseMealTextWithAI(text) {
  const trimmed = String(text || '').trim()
  if (!trimmed) {
    throw new Error('Lütfen ne yediğinizi yazın.')
  }

  try {
    getGroqKey()

    const rawText = await groqChat([
      { role: 'system', content: MEAL_PARSE_SYSTEM_PROMPT },
      { role: 'user', content: trimmed },
    ], { jsonMode: true })

    let parsed
    try {
      const parsedData = JSON.parse(rawText)
      parsed = parsedData.meals || []
    } catch (err) {
      console.log('[parseMealTextWithAI] JSON parse failed. Raw response:', rawText)
      throw new Error(err?.message || 'Geçersiz JSON yanıtı')
    }

    if (!parsed || parsed.length === 0) {
      throw new Error('AI yanıtı boş veya geçerli bir JSON dizisi değil.')
    }

    const items = parsed
      .filter(item => item && typeof item.name === 'string' && String(item.name).trim())
      .map(item => ({
        name:     String(item.name).trim(),
        calories: Math.max(0, Math.round(Number(item.calories) || 0)),
        protein:  Math.max(0, Math.round(Number(item.protein)  * 10) / 10),
        carbs:    Math.max(0, Math.round(Number(item.carbs)    * 10) / 10),
        fat:      Math.max(0, Math.round(Number(item.fat)      * 10) / 10),
        amount:   String(item.amount || '').trim() || `${Math.max(1, Math.round(Number(item.grams) || 100))}g`,
      }))
      .filter(item => item.calories > 0 || item.protein > 0 || item.carbs > 0 || item.fat > 0)

    if (items.length === 0) {
      throw new Error('Hiçbir besin öğesi çıkarılamadı.')
    }

    return items
  } catch (err) {
    const msg = err?.message || String(err)
    if (msg.startsWith('Yapay Zeka Hatası:')) throw err
    throw new Error(`Yapay Zeka Hatası: ${msg}`)
  }
}

function normalizeFoodName(name) {
  return String(name || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function defaultServingMacros(food) {
  const units = food.units || {}
  const unitName = Object.keys(units).find(u => u !== 'Gram' && u !== 'Mililitre')
    || Object.keys(units)[0]
    || 'Gram'
  const qty = unitName === 'Gram' || unitName === 'Mililitre' ? 100 : 1
  const mult = units[unitName] ?? 0.01
  const factor = unitName === 'Gram' || unitName === 'Mililitre' ? qty / 100 : mult * qty
  return {
    calories: Math.round(food.calories * factor),
    protein:  Math.round(food.protein * factor * 10) / 10,
    carbs:    Math.round(food.carbs * factor * 10) / 10,
    fat:      Math.round(food.fat * factor * 10) / 10,
  }
}

function catalogFoodToAlternative(food, reason) {
  const macros = defaultServingMacros(food)
  return {
    id:       food.id,
    name:     food.name,
    reason:   reason || 'Daha dengeli bir seçenek olabilir',
    calories: macros.calories,
    protein:  macros.protein,
    carbs:    macros.carbs,
    fat:      macros.fat,
    units:    food.units,
    tags:     food.tags ?? [],
  }
}

function matchCatalogFood(catalog, idOrName) {
  if (idOrName == null || idOrName === '') return null

  const asNum = Number(idOrName)
  if (Number.isFinite(asNum) && asNum > 0) {
    return catalog.find(f => f.id === asNum) ?? null
  }

  const key = normalizeFoodName(idOrName)
  return catalog.find(f => {
    if (normalizeFoodName(f.name) === key) return true
    if (f.slug && normalizeFoodName(f.slug.replace(/_/g, ' ')) === key) return true
    return false
  }) ?? null
}

function inferMealRole(food) {
  const hay = [
    food.name,
    food.slug?.replace(/_/g, ' '),
    ...(food.tags ?? []),
  ].join(' ').toLowerCase()

  if (/çay|kahve|ayran|kola|gazoz|smoothie|shake|muzlu süt|ice tea|ice-tea/.test(hay)) return MEAL_ROLE.DRINK
  if (/\bsüt\b/.test(hay) && !/yoğurt|peynir|salata/.test(hay)) return MEAL_ROLE.DRINK
  if (/baklava|künefe|lokma|helva|tatlı|çikolata|dondurma|kurabiye|pasta|puding|lokum|revani/.test(hay)) return MEAL_ROLE.DESSERT
  if (/muz|elma|armut|çilek|kiraz|üzüm|mandalina|portakal|kivi|meyve|incir|kayısı|şeftali|ananas|erik|nar\b|hurma/.test(hay)) return MEAL_ROLE.FRUIT
  if (/karides|midye|kalamar/.test(hay)) return MEAL_ROLE.SHELLFISH
  if (/balık|balik|ton balığı|somon|levrek|çupra|hamsi|palamut|lüfer/.test(hay)) return MEAL_ROLE.FISH
  if (/yumurta/.test(hay)) return MEAL_ROLE.EGG
  if (/tavuk|hindi/.test(hay) && !/çorba/.test(hay)) return MEAL_ROLE.LEAN_POULTRY
  if (/köfte|dana|kuzu|biftek|antrikot|bonfile|yağsız et|izgara et/.test(hay)) return MEAL_ROLE.LEAN_MEAT
  if (/pilav|ekmek|bulgur|yulaf|makarna|erişte|gözleme|börek|mısır|galeta/.test(hay)) return MEAL_ROLE.GRAIN
  if (/yoğurt|peynir|lor|kefir/.test(hay) && !/salata/.test(hay)) return MEAL_ROLE.DAIRY
  if (/mercimek|fasulye|nohut|bakla|barbunya|börülce/.test(hay)) return MEAL_ROLE.LEGUME
  if (/salata|sebze|brokoli|ıspanak|kabak|domates|biber|havuç|roka/.test(hay)) return MEAL_ROLE.VEGETABLE
  if (/çorba/.test(hay)) return MEAL_ROLE.SOUP
  if (/döner|dürüm|lahmacun|pide|pizza|hamburger|sandviç|tost|kebap|şiş|sote/.test(hay)) return MEAL_ROLE.MIXED_DISH
  if (/badem|ceviz|fıstık|kuruyemiş|çekirdek|findik/.test(hay)) return MEAL_ROLE.SNACK
  if (/sos|ketçap|mayonez/.test(hay)) return MEAL_ROLE.SAUCE

  const protein = Number(food.protein) || 0
  const carbs = Number(food.carbs) || 0
  const fat = Number(food.fat) || 0
  if (protein >= 18 && carbs < 12) return MEAL_ROLE.LEAN_POULTRY
  if (carbs >= 28 && protein < 10) return MEAL_ROLE.GRAIN
  if (carbs >= 20 && fat >= 12) return MEAL_ROLE.DESSERT

  return MEAL_ROLE.OTHER
}

function isRoleCompatible(contextRole, candidateRole) {
  if (LIMITED_ROLES.has(candidateRole) && !LIMITED_ROLES.has(contextRole)) return false

  const similar = SIMILAR_ROLES[contextRole] ?? SIMILAR_ROLES[MEAL_ROLE.OTHER]
  if (!similar.includes(candidateRole)) return false

  if (contextRole === MEAL_ROLE.LEAN_POULTRY || contextRole === MEAL_ROLE.LEAN_MEAT) {
    if ([MEAL_ROLE.EGG, MEAL_ROLE.SHELLFISH, MEAL_ROLE.FRUIT, MEAL_ROLE.DESSERT, MEAL_ROLE.DRINK, MEAL_ROLE.SNACK].includes(candidateRole)) {
      return false
    }
  }

  if (contextRole === MEAL_ROLE.FRUIT && [MEAL_ROLE.LEAN_POULTRY, MEAL_ROLE.LEAN_MEAT, MEAL_ROLE.FISH, MEAL_ROLE.EGG].includes(candidateRole)) {
    return false
  }

  if (contextRole === MEAL_ROLE.GRAIN && [MEAL_ROLE.LEAN_POULTRY, MEAL_ROLE.FISH, MEAL_ROLE.EGG, MEAL_ROLE.DESSERT].includes(candidateRole)) {
    return false
  }

  return true
}

function scoreCandidate(food, context, userProfile) {
  const contextRole = inferMealRole(context)
  const foodRole = inferMealRole(food)
  const goal = userProfile?.primaryGoal ?? userProfile?.goal ?? ''

  let score = 0
  if (foodRole === contextRole) score += 60
  else if ((SIMILAR_ROLES[contextRole] ?? []).includes(foodRole)) score += 35
  else score -= 50

  const ctxTags = context.tags ?? []
  const tags = food.tags ?? []
  score += tags.filter(t => ctxTags.includes(t)).length * 4

  const ctxKcal = Number(context.calories) || 0
  const ctxProtein = Number(context.protein) || 0
  const ctxCarbs = Number(context.carbs) || 0
  const ctxFat = Number(context.fat) || 0

  if (ctxKcal > 0 && food.calories <= ctxKcal) score += 8
  if (ctxKcal > 0 && food.calories < ctxKcal * 0.85) score += 6
  if (isProteinGoal(goal) && food.protein > ctxProtein) score += 10
  if (isWeightLossGoal(goal) && food.calories < ctxKcal) score += 8
  if (tags.includes('Yüksek Lif')) score += 4
  if (tags.includes('Düşük GI')) score += 3
  if (ctxCarbs > 20 && food.carbs < ctxCarbs) score += 5
  if (ctxFat > 12 && food.fat < ctxFat) score += 4

  const nameHay = normalizeFoodName(food.name)
  if (contextRole === MEAL_ROLE.LEAN_POULTRY) {
    if (/tavuk göğsü|hindi göğsü|izgara balık|ton balığı|yağsız|köfte/.test(nameHay)) score += 15
    if (/yumurta|karides|baklava|çay|muz\b/.test(nameHay)) score -= 40
  }
  if (contextRole === MEAL_ROLE.FRUIT && /meyve|muz|elma|çilek|portakal|üzüm|kivi|armut/.test(nameHay)) score += 12
  if (contextRole === MEAL_ROLE.DESSERT && /tatlı|baklava|yoğurt|meyve|muz/.test(nameHay)) score += 10
  if (contextRole === MEAL_ROLE.GRAIN && /pilav|bulgur|yulaf|ekmek|mercimek|fasulye/.test(nameHay)) score += 10

  return score
}

/** Shared context-aware candidate pool for AI and local fallback. */
function buildCandidatePool({ selectedFood, basketItems, userProfile, localCatalog }) {
  const catalog = localCatalog?.length ? localCatalog : FOOD_DB
  const usedIds = (basketItems ?? []).map(b => b.foodId).filter(Boolean)
  if (selectedFood?.id) usedIds.push(selectedFood.id)

  const context = resolveContextFood(selectedFood, basketItems, catalog)
  if (!context) return { context: null, candidates: [] }

  const profilePool = filterPoolByProfile(catalog, usedIds, userProfile)
  const contextRole = inferMealRole(context)

  let roleFiltered = profilePool.filter(f => isRoleCompatible(contextRole, inferMealRole(f)))

  if (roleFiltered.length < MAX_ALTERNATIVES) {
    const relaxed = profilePool.filter(f => {
      const role = inferMealRole(f)
      if (LIMITED_ROLES.has(role) && !LIMITED_ROLES.has(contextRole)) return false
      return true
    })
    roleFiltered = relaxed
  }

  const scored = roleFiltered
    .map(food => ({ food, score: scoreCandidate(food, context, userProfile) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.food.calories - b.food.calories)

  const seen = new Set()
  const candidates = []
  for (const { food } of scored) {
    if (seen.has(food.id)) continue
    seen.add(food.id)
    candidates.push(food)
    if (candidates.length >= MAX_CANDIDATES) break
  }

  return { context, contextRole, candidates }
}

function buildCompactCatalog(foods) {
  return foods.map(f => ({
    id: f.id,
    name: f.name,
    role: ROLE_LABELS_TR[inferMealRole(f)] || 'genel',
    kcal100: Math.round(f.calories),
    protein: Math.round(f.protein * 10) / 10,
    carbs: Math.round(f.carbs * 10) / 10,
    fat: Math.round(f.fat * 10) / 10,
    tags: (f.tags ?? []).slice(0, 4),
  }))
}

function isProcessedMixedDish(food) {
  const hay = normalizeFoodName(`${food.name} ${food.slug?.replace(/_/g, ' ') ?? ''}`)
  return /döner|doner|dürüm|durum|lahmacun|pide|pizza|hamburger|tost|kebap|fast food/.test(hay)
}

function isSimilarStyleVariant(food, context) {
  const hay = normalizeFoodName(food.name)
  const ctxHay = normalizeFoodName(context.name)
  if (/şiş|sote|kanat|but|döner|doner/.test(hay) && /tavuk|hindi/.test(ctxHay)) return true
  return false
}

/** True only when catalog macros support a genuinely healthier / goal-aligned swap. */
function qualifiesAsHealthier(context, food, userProfile) {
  if (!context || food.id === context.id) return false
  if (isProcessedMixedDish(food)) return false
  if (isSimilarStyleVariant(food, context) && !qualifiesAsHealthierByMacros(context, food)) return false

  return qualifiesAsHealthierByMacros(context, food, userProfile)
}

function qualifiesAsHealthierByMacros(context, food, userProfile = null) {
  const ctxKcal = Number(context.calories) || 0
  const ctxProtein = Number(context.protein) || 0
  const ctxFat = Number(context.fat) || 0
  const ctxCarbs = Number(context.carbs) || 0
  const goal = userProfile?.primaryGoal ?? userProfile?.goal ?? ''

  let signals = 0
  if (ctxKcal > 0 && food.calories < ctxKcal * 0.92) signals++
  if (food.protein > ctxProtein + 3 && food.fat <= ctxFat + 1) signals++
  if (ctxFat > 6 && food.fat < ctxFat * 0.82) signals++
  if (ctxCarbs > 18 && food.carbs < ctxCarbs * 0.78) signals++
  if ((food.tags ?? []).includes('Yüksek Lif')) signals++
  if ((food.tags ?? []).includes('Düşük GI') && ctxCarbs > 15) signals++
  if (isProteinGoal(goal) && food.protein > ctxProtein + 5) signals++
  if (isWeightLossGoal(goal) && ctxKcal > 0 && food.calories < ctxKcal * 0.88) signals++

  const contextRole = inferMealRole(context)
  const foodRole = inferMealRole(food)
  if ([MEAL_ROLE.LEAN_POULTRY, MEAL_ROLE.LEAN_MEAT, MEAL_ROLE.FISH].includes(contextRole)) {
    if ([MEAL_ROLE.VEGETABLE, MEAL_ROLE.DAIRY].includes(foodRole) && food.calories < ctxKcal) signals += 2
    if (foodRole === MEAL_ROLE.FISH && food.fat < ctxFat) signals += 2
    if (foodRole === MEAL_ROLE.LEAN_POULTRY && food.calories <= ctxKcal && food.fat < ctxFat) signals += 2
  }

  return signals >= 1
}

function qualifiesAsSimilar(context, food) {
  if (!context || food.id === context.id) return false
  const contextRole = inferMealRole(context)
  const foodRole = inferMealRole(food)

  if (isSimilarStyleVariant(food, context)) return true
  if (isProcessedMixedDish(food) && contextRole === MEAL_ROLE.LEAN_POULTRY) return true
  if (foodRole === contextRole) return true
  if ((SIMILAR_ROLES[contextRole] ?? []).includes(foodRole)) return true
  if (contextRole === MEAL_ROLE.LEAN_POULTRY && foodRole === MEAL_ROLE.MIXED_DISH) return true
  return false
}

function filterExcluded(foods, excludedIds = [], excludedNames = []) {
  const idSet = new Set(excludedIds)
  const nameSet = new Set(excludedNames.map(normalizeFoodName))
  return foods.filter(f => !idSet.has(f.id) && !nameSet.has(normalizeFoodName(f.name)))
}

function scoreHealthierCandidate(food, context, userProfile) {
  let score = scoreCandidate(food, context, userProfile)
  if (!qualifiesAsHealthier(context, food, userProfile)) return -999
  const ctxKcal = Number(context.calories) || 0
  if (ctxKcal > 0 && food.calories < ctxKcal * 0.85) score += 12
  if ((food.tags ?? []).includes('Yüksek Lif')) score += 8
  if (isProcessedMixedDish(food)) score -= 100
  return score
}

function scoreSimilarCandidate(food, context, userProfile) {
  if (!qualifiesAsSimilar(context, food)) return -999
  let score = scoreCandidate(food, context, userProfile)
  if (isSimilarStyleVariant(food, context)) score += 25
  if (isProcessedMixedDish(food)) score += 10
  if (inferMealRole(food) === inferMealRole(context)) score += 15
  if (qualifiesAsHealthier(context, food, userProfile)) score -= 5
  return score
}

function findCatalogByPatterns(catalog, patterns) {
  for (const pattern of patterns) {
    const key = normalizeFoodName(pattern)
    const found = catalog.find(f => normalizeFoodName(f.name).includes(key))
    if (found) return found
  }
  return null
}

function buildMenuItem(food) {
  const alt = catalogFoodToAlternative(food, '')
  const unitName = Object.keys(food.units || {})[0] || 'Gram'
  const qty = unitName === 'Gram' || unitName === 'Mililitre' ? 100 : 1
  return {
    foodId: food.id,
    id: food.id,
    name: food.name,
    unit: unitName,
    qty,
    calories: alt.calories,
    protein: alt.protein,
    carbs: alt.carbs,
    fat: alt.fat,
    units: food.units,
  }
}

function buildMenuFromFoods(foods, title, reason) {
  const items = foods.filter(Boolean).map(buildMenuItem)
  if (items.length < 2) return null
  return {
    id:       `menu-${items.map(i => i.foodId).join('-')}`,
    type:     'menu',
    title,
    reason,
    items,
    allMatched: items.length === foods.filter(Boolean).length,
  }
}

function buildLocalMenus({ context, basketItems, catalog, userProfile }) {
  const usedIds = (basketItems ?? []).map(b => b.foodId).filter(Boolean)
  if (context?.id) usedIds.push(context.id)
  const pool = filterPoolByProfile(catalog, usedIds, userProfile)
  const ctxRole = inferMealRole(context)
  const menus = []

  const bulgur = findCatalogByPatterns(pool, ['bulgur pilav'])
  const ekmek = findCatalogByPatterns(pool, ['tam buğday ekmek'])
  const ayran = findCatalogByPatterns(pool, ['ayran'])
  const salata = findCatalogByPatterns(pool, ['zeytinyağlı salata', 'çoban salata', 'tavuklu salata'])
  const yogurt = findCatalogByPatterns(pool, ['süzme yoğurt', 'yoğurt yarım', 'yoğurt tam'])

  const leanProtein = findCatalogByPatterns(pool, [
    'tavuk göğsü',
    'hindi göğsü',
    'balık izgara',
    'ton balığı',
  ]) ?? (ctxRole === MEAL_ROLE.LEAN_POULTRY || ctxRole === MEAL_ROLE.FISH ? context : null)

  if ([MEAL_ROLE.LEAN_POULTRY, MEAL_ROLE.LEAN_MEAT, MEAL_ROLE.FISH, MEAL_ROLE.MIXED_DISH].includes(ctxRole)) {
    const m1 = buildMenuFromFoods(
      [leanProtein || context, bulgur, yogurt],
      'Dengeli Protein Menüsü',
      'Protein + bulgur + yoğurt — dengeli bir öğün olabilir',
    )
    if (m1) menus.push(m1)

    const m2 = buildMenuFromFoods(
      [leanProtein || context, ekmek, ayran, salata],
      'Dengeli Tavuk Menüsü',
      'Protein + tam buğday + ayran + salata — daha dengeli bir menü olabilir',
    )
    if (m2) menus.push(m2)
  }

  if (ctxRole === MEAL_ROLE.GRAIN) {
    const m3 = buildMenuFromFoods(
      [findCatalogByPatterns(pool, ['mercimek çorbası', 'yoğurt']), context, salata],
      'Dengeli Karbonhidrat Menüsü',
      'Çorba/garnitür ile daha dengeli bir öğün olabilir',
    )
    if (m3) menus.push(m3)
  }

  if (ctxRole === MEAL_ROLE.FRUIT) {
    const m4 = buildMenuFromFoods(
      [context, yogurt, findCatalogByPatterns(pool, ['badem', 'ceviz'])],
      'Dengeli Atıştırmalık',
      'Meyve + yoğurt/kuruyemiş — daha tok tutan bir ara öğün olabilir',
    )
    if (m4) menus.push(m4)
  }

  return menus.slice(0, MAX_MENUS)
}

function pickLocalRecommendations({
  selectedFood,
  basketItems,
  userProfile,
  localCatalog,
  excludedSuggestionIds = [],
  excludedSuggestionNames = [],
}) {
  const catalog = localCatalog?.length ? localCatalog : FOOD_DB
  const { context, contextRole, candidates } = buildCandidatePool({
    selectedFood,
    basketItems,
    userProfile,
    localCatalog: catalog,
  })

  if (!context) return { ...EMPTY_RECOMMENDATIONS }

  const usedIds = (basketItems ?? []).map(b => b.foodId).filter(Boolean)
  if (selectedFood?.id) usedIds.push(selectedFood.id)
  const profilePool = filterExcluded(
    filterPoolByProfile(catalog, usedIds, userProfile),
    excludedSuggestionIds,
    excludedSuggestionNames,
  )

  const healthierScored = profilePool
    .map(food => ({ food, score: scoreHealthierCandidate(food, context, userProfile) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)

  const similarScored = profilePool
    .map(food => ({ food, score: scoreSimilarCandidate(food, context, userProfile) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)

  const healthierIds = new Set()
  const healthier = []
  for (const { food } of healthierScored) {
    if (healthier.length >= MAX_ALTERNATIVES) break
    if (healthierIds.has(food.id)) continue
    healthierIds.add(food.id)
    healthier.push(catalogFoodToAlternative(food, buildHealthierReason(food, context, userProfile)))
  }

  const similar = []
  for (const { food } of similarScored) {
    if (similar.length >= MAX_ALTERNATIVES) break
    if (healthierIds.has(food.id)) continue
    similar.push(catalogFoodToAlternative(food, buildSimilarReason(food, context)))
  }

  const menus = buildLocalMenus({ context, basketItems, catalog, userProfile })
    .filter(m => !excludedSuggestionIds.includes(m.id))

  return { healthier, similar, menus }
}

function buildHealthierReason(food, context, userProfile) {
  const goal = userProfile?.primaryGoal ?? userProfile?.goal ?? ''
  if (isProteinGoal(goal) && food.protein > (context.protein ?? 0) + 3) {
    return 'Daha yüksek protein — hedefinize daha uygun olabilir'
  }
  if (food.calories < (context.calories ?? 999) * 0.9) {
    return 'Daha düşük kalori — daha dengeli bir seçenek olabilir'
  }
  if ((food.tags ?? []).includes('Yüksek Lif')) {
    return 'Daha fazla lif — daha tok tutan bir seçenek olabilir'
  }
  if (food.fat < (context.fat ?? 999) * 0.85) {
    return 'Daha düşük yağ — daha hafif bir seçenek olabilir'
  }
  return 'Daha sağlıklı veya hedefe daha uygun olabilir'
}

function buildSimilarReason(food, context) {
  if (isProcessedMixedDish(food)) {
    return 'Benzer tavuk yemeği — farklı bir hazırlanış şekli'
  }
  if (isSimilarStyleVariant(food, context)) {
    return 'Benzer tavuk yemeği — aynı öğün rolünde alternatif'
  }
  return 'Benzer öğün rolünde alternatif bir seçenek'
}

function getLocalHealthierAlternatives(opts) {
  const recommendations = pickLocalRecommendations(opts)
  return { recommendations, usedFallback: true, error: null }
}

function isProteinGoal(goal) {
  return /kas/i.test(String(goal || ''))
}

function isWeightLossGoal(goal) {
  return /kilo ver/i.test(String(goal || ''))
}

function filterPoolByProfile(catalog, usedIds, userProfile) {
  const used = new Set(usedIds)
  const allergies = userProfile?.allergies ?? []
  const medicalHistory = userProfile?.medicalHistory ?? []
  const dietPhilosophy = userProfile?.dietPhilosophy ?? 'standart'

  return catalog.filter(f => {
    if (used.has(f.id)) return false
    if (allergies.includes('gluten') && !(f.tags ?? []).includes('Glutensiz')) return false
    if (allergies.includes('laktoz') && !(f.tags ?? []).includes('Laktozsuz')) return false
    if (allergies.includes('kuruyemis') && !(f.tags ?? []).includes('Kuruyemişsiz')) return false
    if (allergies.includes('deniz_urunleri') && !(f.tags ?? []).includes('Deniz Ürünsüz')) return false
    if (dietPhilosophy === 'vegan' && !(f.tags ?? []).includes('Vegan')) return false
    if (dietPhilosophy === 'vejetaryen' && !(f.tags ?? []).includes('Vejetaryen')) return false
    if (dietPhilosophy === 'keto' && !(f.tags ?? []).includes('Keto')) return false
    const needsLowGI =
      medicalHistory.includes('diyabet_tip1') ||
      medicalHistory.includes('diyabet_tip2') ||
      medicalHistory.includes('insulin_direnci')
    if (needsLowGI && (f.tags ?? []).includes('Yüksek GI')) return false
    return true
  })
}

function resolveContextFood(selectedFood, basketItems, catalog) {
  if (selectedFood) return selectedFood

  if (!basketItems?.length) return null

  const enriched = basketItems.map(item => {
    if (item.foodId) {
      const food = catalog.find(f => f.id === item.foodId)
      if (food) return { ...food, _basketKcal: item.kcal }
    }
    return {
      id: null,
      name: item.foodName,
      calories: item.kcal ?? 0,
      protein: item.protein ?? 0,
      carbs: item.carbs ?? 0,
      fat: item.fat ?? 0,
      sugar: item.sugar ?? 0,
      tags: [],
      _basketKcal: item.kcal ?? 0,
    }
  })

  return enriched.sort((a, b) => (b._basketKcal ?? 0) - (a._basketKcal ?? 0))[0]
}

function matchFoodSuggestion(item, candidatePool, catalog, allowedIds) {
  const itemId = Number(item.id)
  let matched = Number.isFinite(itemId) && itemId > 0
    ? candidatePool.find(f => f.id === itemId) ?? catalog.find(f => f.id === itemId)
    : null
  if (!matched) matched = matchCatalogFood(candidatePool, item.name ?? item.id)
  if (!matched || !allowedIds.has(matched.id)) return null
  return matched
}

function parseAiFoodSuggestions(items, candidatePool, catalog, allowedIds, usedSet, max) {
  const results = []
  for (const item of items ?? []) {
    if (results.length >= max) break
    const matched = matchFoodSuggestion(item, candidatePool, catalog, allowedIds)
    if (!matched || usedSet.has(matched.id)) continue
    const reason = String(item.reason || item.note || '').trim()
    results.push(catalogFoodToAlternative(matched, reason))
    usedSet.add(matched.id)
  }
  return results
}

function parseAiMenuSuggestions(menuItems, catalog, usedMenuIds, max) {
  const menus = []
  for (const menu of menuItems ?? []) {
    if (menus.length >= max) break
    const menuId = menu.id || `menu-ai-${menus.length}`
    if (usedMenuIds.has(menuId)) continue

    const matchedItems = []
    for (const raw of menu.items ?? []) {
      const food = matchCatalogFood(catalog, raw.id ?? raw.name)
      if (!food) continue
      const unitName = raw.unit && food.units?.[raw.unit]
        ? raw.unit
        : Object.keys(food.units || {})[0] || 'Gram'
      const qty = Number(raw.amount) || (unitName === 'Gram' || unitName === 'Mililitre' ? 100 : 1)
      const alt = catalogFoodToAlternative(food, '')
      matchedItems.push({
        foodId: food.id,
        id: food.id,
        name: food.name,
        unit: unitName,
        qty,
        calories: alt.calories,
        protein: alt.protein,
        carbs: alt.carbs,
        fat: alt.fat,
        units: food.units,
      })
    }

    if (matchedItems.length < 2) continue

    menus.push({
      id: menuId,
      type: 'menu',
      title: String(menu.title || 'Menü Önerisi').trim(),
      reason: String(menu.reason || '').trim() || 'Dengeli bir öğün kombinasyonu olabilir',
      items: matchedItems,
      allMatched: matchedItems.length === (menu.items ?? []).length,
    })
    usedMenuIds.add(menuId)
  }
  return menus
}

async function fetchAiRecommendations({
  selectedFood,
  basketItems,
  mealType,
  userProfile,
  goals,
  localCatalog,
  forceRefresh = false,
  excludedSuggestionIds = [],
  excludedSuggestionNames = [],
}) {
  const catalog = localCatalog?.length ? localCatalog : FOOD_DB
  const usedIds = (basketItems ?? []).map(b => b.foodId).filter(Boolean)
  if (selectedFood?.id) usedIds.push(selectedFood.id)

  const { context, contextRole, candidates } = buildCandidatePool({
    selectedFood,
    basketItems,
    userProfile,
    localCatalog: catalog,
  })

  const candidatePool = filterExcluded(candidates, excludedSuggestionIds, excludedSuggestionNames)

  devLog('AI request', {
    selectedFood: selectedFood?.name ?? context?.name,
    contextRole,
    forceRefresh,
    excluded: excludedSuggestionIds.length,
    candidatePool: candidatePool.map(f => f.name),
  })

  if (candidatePool.length === 0) {
    console.warn('[fetchAiRecommendations] No candidates after exclusion')
    return null
  }

  const allowedIds = new Set(candidatePool.map(f => f.id))
  const compactCatalog = buildCompactCatalog(candidatePool)
  const goal = goals?.primaryGoal ?? userProfile?.primaryGoal ?? userProfile?.goal ?? 'Sağlıklı Beslenmek'
  const conditions = [
    ...(userProfile?.healthConditions ?? []),
    ...(userProfile?.allergies ?? []),
    ...(userProfile?.medicalHistory ?? []),
  ].filter(Boolean)

  const basketDesc = (basketItems ?? []).map(b => b.foodName).join(', ')
  const contextName = selectedFood?.name ?? context?.name ?? 'seçili besin'
  const roleLabel = ROLE_LABELS_TR[contextRole] ?? 'genel'

  const prompt = `Kullanıcı ${mealType || 'öğün'} için yemek seçiyor.
Seçili besin: ${contextName}
Sepet: ${basketDesc || 'boş'}
Öğün rolü: ${roleLabel}
Hedef: ${goal}
Sağlık notları: ${conditions.length ? conditions.join(', ') : 'yok'}
Daha önce gösterilen öneriler (tekrarlama): ${[...excludedSuggestionIds, ...excludedSuggestionNames].join(', ') || 'yok'}

Görev: Aşağıdaki aday listeden üç grup öneri üret.

KURALLAR:
1) "healthier": Gerçekten daha sağlıklı veya hedefe daha uygun seçenekler. Daha düşük kalori/yağ, daha yüksek protein/lif.
   - Izgara tavuk için: tavuk göğsü, hindi, ızgara balık, ton balığı, yoğurt, salata OLABİLİR.
   - Tavuk Döner, şiş, sote BURAYA KOYMA (bunlar "similar" grubuna gider).
2) "similar": Benzer öğün rolü/tat. Sağlıklı olmak zorunda değil.
   - Izgara tavuk için: tavuk döner, tavuk şiş, tavuk sote OLABİLİR.
3) "menus": Tam öğün menüsü (2-4 katalog ürünü). Türk alışkanlıkları: ayran, yoğurt, salata, bulgur, tam buğday ekmek.
   - Örn: Izgara tavuk + tam buğday ekmek + ayran + salata

SADECE aday listedeki id/name kullan. Makro UYDURMA. Tıbbi iddia yapma.

Aday liste:
${JSON.stringify(compactCatalog)}

Yanıt: SADECE geçerli JSON obje:
{"healthier":[{"type":"food","id":2,"name":"Tavuk Göğsü (Izgara)","reason":"..."}],"similar":[{"type":"food","id":5,"name":"Döner (Tavuk)","reason":"..."}],"menus":[{"type":"menu","title":"Dengeli Tavuk Menüsü","items":[{"id":2,"name":"...","amount":1,"unit":"Porsiyon"}],"reason":"..."}]}`

  let rawText = ''
  try {
    rawText = await groqChat([
      {
        role: 'system',
        content: 'Sen Türkçe beslenme asistanısın. Sadece verilen aday listedeki id/name kullan. healthier ve similar gruplarını karıştırma. Yanıtında yalnızca JSON obje döndür.',
      },
      { role: 'user', content: prompt },
    ], { temperature: forceRefresh ? 0.45 : 0.25, maxTokens: 1200, jsonMode: true })
  } catch (err) {
    console.error('[fetchAiRecommendations] Groq chat request failed:', err?.message || err, err)
    throw err
  }

  let parsed = null
  try {
    parsed = JSON.parse(stripMarkdown(rawText))
  } catch (parseErr) {
    console.error('[fetchAiRecommendations] JSON parse failed:', parseErr?.message, 'Raw:', rawText)
    return null
  }

  const usedFoodSet = new Set(usedIds)
  const usedMenuIds = new Set(excludedSuggestionIds.filter(id => String(id).startsWith('menu')))

  const healthier = parseAiFoodSuggestions(
    parsed?.healthier,
    candidatePool,
    catalog,
    allowedIds,
    usedFoodSet,
    MAX_ALTERNATIVES,
  ).filter(f => {
    const catalogFood = catalog.find(c => c.id === f.id) ?? f
    return qualifiesAsHealthier(context, catalogFood, userProfile)
  })

  const similar = parseAiFoodSuggestions(
    parsed?.similar,
    candidatePool,
    catalog,
    allowedIds,
    usedFoodSet,
    MAX_ALTERNATIVES,
  )

  const menus = parseAiMenuSuggestions(parsed?.menus, catalog, usedMenuIds, MAX_MENUS)

  devLog('AI result', {
    healthier: healthier.map(a => a.name),
    similar: similar.map(a => a.name),
    menus: menus.map(m => m.title),
  })

  if (healthier.length + similar.length + menus.length === 0) return null
  return { healthier, similar, menus }
}

/**
 * Suggest smarter alternatives from the local catalog only.
 * AI returns ids/names + reasons; macros always come from FOOD_DB.
 * Falls back to local rule-based suggestions when AI is unavailable.
 *
 * @returns {Promise<{ recommendations: { healthier, similar, menus }, usedFallback: boolean, error: string|null, aiCalled: boolean }>}
 */
export async function getHealthierAlternatives({
  selectedFood = null,
  basketItems = [],
  mealType = '',
  userProfile = null,
  goals = null,
  localCatalog = null,
  forceRefresh = false,
  excludedSuggestionIds = [],
  excludedSuggestionNames = [],
} = {}) {
  if (!selectedFood && !basketItems?.length) {
    return { recommendations: { ...EMPTY_RECOMMENDATIONS }, usedFallback: false, error: null, aiCalled: false }
  }

  const catalog = localCatalog?.length ? localCatalog : FOOD_DB
  const hasGroqKey = Boolean(import.meta.env.VITE_GROQ_API_KEY)

  const { context, contextRole, candidates } = buildCandidatePool({
    selectedFood,
    basketItems,
    userProfile,
    localCatalog: catalog,
  })

  const localOpts = {
    selectedFood,
    basketItems,
    userProfile,
    localCatalog: catalog,
    excludedSuggestionIds,
    excludedSuggestionNames,
  }

  devLog('context', {
    selectedFood: selectedFood?.name,
    contextRole,
    candidatePool: candidates.map(f => f.name),
    forceRefresh,
    hasGroqKey,
    excluded: excludedSuggestionIds.length,
  })

  if (!hasGroqKey) {
    console.error('[getHealthierAlternatives] VITE_GROQ_API_KEY is missing')
    const local = getLocalHealthierAlternatives(localOpts)
    return { ...local, error: FALLBACK_MSG, aiCalled: false }
  }

  try {
    getGroqKey()
    devLog(forceRefresh ? 'Calling Groq (forced refresh)' : 'Calling Groq')

    const aiRecommendations = await fetchAiRecommendations({
      selectedFood,
      basketItems,
      mealType,
      userProfile,
      goals,
      localCatalog: catalog,
      forceRefresh,
      excludedSuggestionIds,
      excludedSuggestionNames,
    })

    if (aiRecommendations) {
      const total = aiRecommendations.healthier.length
        + aiRecommendations.similar.length
        + aiRecommendations.menus.length
      if (total > 0) {
        devLog('final recommendations (AI)', {
          healthier: aiRecommendations.healthier.map(a => a.name),
          similar: aiRecommendations.similar.map(a => a.name),
          menus: aiRecommendations.menus.map(m => m.title),
        })
        return { recommendations: aiRecommendations, usedFallback: false, error: null, aiCalled: true }
      }
    }

    console.warn('[getHealthierAlternatives] AI returned zero matched recommendations, using local fallback', {
      selectedFood: selectedFood?.name,
      contextRole,
      forceRefresh,
    })
    const local = getLocalHealthierAlternatives(localOpts)
    devLog('final recommendations (fallback)', local.recommendations)
    return { ...local, error: FALLBACK_MSG, aiCalled: true }
  } catch (err) {
    console.error('[getHealthierAlternatives] Groq failed:', err?.message || err, err)
    const local = getLocalHealthierAlternatives(localOpts)
    devLog('final recommendations (fallback after error)', local.recommendations)
    return { ...local, error: FALLBACK_MSG, aiCalled: true }
  }
}

/** @deprecated Use getHealthierAlternatives */
export async function getHealthyAlternatives(basketItems) {
  const result = await getHealthierAlternatives({ basketItems })
  return [...result.recommendations.healthier, ...result.recommendations.similar]
}

/**
 * Estimate average gram weight of one serving unit for a Turkish food.
 * @param {string} foodName
 * @param {string} unit — e.g. Porsiyon, Adet, Dilim, Kase
 * @returns {Promise<number|null>}
 */
export async function estimatePortionWeight(foodName, unit) {
  if (!foodName?.trim() || !unit?.trim()) return null

  const prompt = `What is the average weight in grams of 1 ${unit} of ${foodName} in Turkey? Return ONLY digits. No text, no markdown.`

  try {
    const rawText = await groqChat([
      { role: 'user', content: prompt },
    ], { maxTokens: 50 })

    const digitsOnly = String(rawText).replace(/[^\d]/g, '')
    const match = digitsOnly.match(/\d+/) || rawText.match(/\d+/)
    if (!match) {
      console.log('[estimatePortionWeight] No digits in response:', rawText)
      return null
    }
    const grams = parseInt(match[0], 10)
    return grams > 0 ? grams : null
  } catch (err) {
    console.log('[estimatePortionWeight] Request failed:', err)
    return null
  }
}
