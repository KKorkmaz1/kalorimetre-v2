/**
 * AI services for Kalorimetre
 * - parseMealTextWithAI / getHealthyAlternatives / estimatePortionWeight: Groq (VITE_GROQ_API_KEY)
 */

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'

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

/**
 * Suggest healthier Turkish food alternatives for current basket items.
 * @param {Array<{ foodName: string, kcal?: number, unit?: string }>} basketItems
 * @returns {Promise<Array<{ id: string, name: string, calories: number, protein: number, carbs: number, fat: number }>>}
 */
export async function getHealthyAlternatives(basketItems) {
  if (!basketItems?.length) return []

  const basketSummary = basketItems
    .map(item => `${item.foodName}${item.unit ? ` (${item.unit})` : ''}`)
    .join(', ')

  const prompt = `The user is about to eat: ${basketSummary}. Suggest 2 healthier, culturally relevant Turkish food alternatives. Return ONLY a valid JSON array like this: [{"name": "Izgara Tavuk", "calories": 150, "protein": 25, "carbs": 0, "fat": 5}]. Do not wrap in markdown, return pure JSON.`

  try {
    const rawText = await groqChat([
      { role: 'user', content: prompt },
    ])

    const parsed = parseJsonArray(rawText, 'getHealthyAlternatives')
    if (!parsed) return []

    return parsed
      .filter(item => item && typeof item.name === 'string')
      .slice(0, 2)
      .map((item, idx) => ({
        id:       `ai-alt-${idx}-${String(item.name).trim()}`,
        name:     String(item.name).trim(),
        calories: Math.round(Number(item.calories) || 0),
        protein:  Math.round(Number(item.protein)  * 10) / 10,
        carbs:    Math.round(Number(item.carbs)    * 10) / 10,
        fat:      Math.round(Number(item.fat)      * 10) / 10,
      }))
  } catch (err) {
    console.log('[getHealthyAlternatives] Request failed:', err)
    return []
  }
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
