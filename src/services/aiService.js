/**
 * AI NLP Meal Parsing Service
 * Uses OpenAI Chat Completions API to parse free-text Turkish meal descriptions
 * into structured nutritional data with smart, context-aware serving units.
 *
 * Configure: VITE_OPENAI_API_KEY in your .env file.
 */

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'

const SYSTEM_PROMPT = `Sen "Kalorimetre" adlı Türk kalori takip uygulaması için bir beslenme verisi ayrıştırma uzmanısın.

Kullanıcının serbest metin olarak yazdığı Türkçe öğün açıklamasını analiz et ve her besin öğesi için yapılandırılmış JSON döndür.

ÇIKTI FORMATI — Kesinlikle aşağıdaki JSON array formatında döndür, başka hiçbir açıklama veya markdown olmadan:
[
  {
    "name": "Türkçe besin adı",
    "kcal100": <100g/ml başına kalori — sayı>,
    "protein100": <100g başına protein gram — sayı>,
    "carbs100": <100g başına karbonhidrat gram — sayı>,
    "fat100": <100g başına yağ gram — sayı>,
    "fiber100": <100g başına lif gram — sayı>,
    "sugar100": <100g başına şeker gram — sayı>,
    "defaultGrams": <kullanıcının tarif ettiği toplam miktar gram/ml cinsinden — sayı>,
    "servingLabel": "örn. '2 yumurta', '1 dilim peynir', '3 bardak çay'",
    "units": [
      { "id": "gram", "label": "Gram", "grams": null },
      { "id": "...", "label": "...", "grams": <birim başına gram sayısı — sayı> }
    ]
  }
]

KRİTİK KURALLAR:
1. Tüm besinsel değerler için USDA FoodData Central veya Türkomp (Türkiye Gıda Bileşim Veritabanı) referans değerlerini kullan. Değer uydurmak kesinlikle YASAKTIR.
2. "units" dizisindeki birimler o besine ÖZEL ve MANTIKLI olmalıdır:
   - Yumurta, köfte, lahmacun, simit, bisküvi → { "id": "adet", "label": "Adet", "grams": <ağırlık> }
   - Ekmek, börek, karpuz, peynir → { "id": "dilim", "label": "Dilim", "grams": <dilim ağırlığı> }
   - Çay, su, süt, ayran, meyve suyu → { "id": "bardak", "label": "Bardak", "grams": 250 }
   - Türk kahvesi → { "id": "fincan", "label": "Fincan", "grams": 60 }
   - Mısır gevreği, yulaf, yoğurt, çorba → { "id": "kase", "label": "Kase", "grams": 250 }
   - Tereyağı, bal, reçel, fıstık ezmesi → { "id": "kasik", "label": "Yemek Kaşığı", "grams": 15 }
   - Genel katı yemekler (pilav, makarna, et, sebze) → { "id": "porsiyon", "label": "Porsiyon", "grams": <mantıklı porsiyon> }
   - "gram" BİRİMİ HER ZAMAN ilk sıraya eklenmelidir: { "id": "gram", "label": "Gram", "grams": null }
3. Sadece "gram" birimini gösteren mantıksız seçenekler ASLA ekleme (örn. Mısır Gevreği için "Dilim" veya Çay için "Adet" gösterme).
4. "defaultGrams": Kullanıcının metninde belirttiği miktarı gram/ml olarak hesapla (örn. "2 yumurta" → 100, "3 bardak çay" → 750, "1 dilim ekmek" → 30).
5. Tanıyamadığın besini atla.
6. SADECE geçerli JSON array döndür. Markdown, açıklama veya ek metin KESİNLİKLE YASAKTIR.`

/**
 * Parse a free-text Turkish meal description using OpenAI.
 *
 * @param {string} text  — e.g. "Kahvaltıda 2 yumurtalı omlet, 1 dilim beyaz peynir ve 3 bardak çay"
 * @returns {Promise<Array>}  array of parsed food items
 */
export async function parseNLPMeal(text) {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('VITE_OPENAI_API_KEY tanımlanmamış. Lütfen .env dosyanıza ekleyin.')
  }

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.1,
      max_tokens: 2000,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: text },
      ],
    }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err?.error?.message || `OpenAI API hatası: ${response.status}`)
  }

  const data = await response.json()
  const raw  = data.choices?.[0]?.message?.content?.trim() ?? ''

  // Strip optional markdown code fences if present
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()

  let parsed
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new Error('AI yanıtı geçerli JSON formatında değil. Lütfen tekrar deneyin.')
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Beklenmeyen AI yanıt formatı.')
  }

  // Validate & sanitize each item
  return parsed
    .filter(item => item && typeof item.name === 'string' && item.kcal100 >= 0)
    .map(item => ({
      name:         String(item.name).trim(),
      kcal100:      Math.round(Number(item.kcal100)    || 0),
      protein100:   Math.round(Number(item.protein100) * 10) / 10,
      carbs100:     Math.round(Number(item.carbs100)   * 10) / 10,
      fat100:       Math.round(Number(item.fat100)     * 10) / 10,
      fiber100:     Math.round(Number(item.fiber100)   * 10) / 10,
      sugar100:     Math.round(Number(item.sugar100)   * 10) / 10,
      defaultGrams: Math.max(1, Math.round(Number(item.defaultGrams) || 100)),
      servingLabel: String(item.servingLabel || '').trim(),
      units: Array.isArray(item.units) ? item.units.filter(u => u && u.id && u.label) : [
        { id: 'gram', label: 'Gram', grams: null },
        { id: 'porsiyon', label: 'Porsiyon', grams: 150 },
      ],
    }))
}
