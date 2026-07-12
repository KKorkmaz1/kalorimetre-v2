import { useState, useMemo, useEffect, useRef } from 'react'
import { useDiet } from '../context/DietContext'
import { MEAL_TYPES, checkHealthImpact, calcPreview, parseQuantity, unitNeedsGramInput, FOOD_DB } from './Meal/foodData'
import { searchFoodsLocal } from '../services/foodService'
import { PlusIcon, CloseIcon } from './Meal/MealIcons'
import SearchBar from './Meal/SearchBar'
import BasketItem from './Meal/BasketItem'
import BarcodeTab from './Meal/BarcodeTab'
import MacroSummary from './Meal/MacroSummary'
import BarcodeScanner from './BarcodeScanner'
import { parseMealTextWithAI, getHealthierAlternatives, estimatePortionWeight } from '../services/aiService'
import { supabase } from '../utils/supabaseClient'
import { lookupBarcode } from '../utils/openFoodFacts'

// ─── Serving units (no fixed gram weights — user defines per food) ────────────

const SERVING_UNITS = [
  { id: 'gram',     label: 'Gram'     },
  { id: 'porsiyon', label: 'Porsiyon' },
  { id: 'adet',     label: 'Adet'     },
  { id: 'dilim',    label: 'Dilim'    },
]

function getUnitLabel(unitId) {
  return SERVING_UNITS.find(u => u.id === unitId)?.label ?? unitId
}

function calcTotalGrams(unit, qty, gramsPerUnit) {
  const q = parseQuantity(qty)
  if (!Number.isFinite(q) || q <= 0) return 0
  if (unit === 'gram') return Math.max(1, q)
  const gpu = parseQuantity(gramsPerUnit)
  if (!Number.isFinite(gpu) || gpu <= 0) return 0
  return Math.max(1, q * gpu)
}

function isServingValid(unit, qty, gramsPerUnit) {
  const q = parseQuantity(qty)
  if (!Number.isFinite(q) || q <= 0) return false
  if (unit === 'gram') return true
  const gpu = parseQuantity(gramsPerUnit)
  return Number.isFinite(gpu) && gpu > 0
}

function buildAlternativesCacheKey(selFood, basket, profile, mealType) {
  const foodKey = selFood?.id
    ?? `basket:${basket.map(b => `${b.foodId ?? b.foodName}`).join('|')}`
  const goalKey = profile?.primaryGoal ?? profile?.goal ?? 'default'
  const profileKey = [
    ...(profile?.healthConditions ?? []),
    ...(profile?.allergies ?? []),
    profile?.dietPhilosophy ?? '',
  ].sort().join('|')
  return `${foodKey}::${goalKey}::${profileKey}::${mealType}`
}

function macrosFrom100g(values, totalGrams) {
  const r = totalGrams / 100
  return {
    kcal:    Math.round(values.kcal100    * r),
    protein: Math.round(values.protein100 * r * 10) / 10,
    carbs:   Math.round(values.carbs100   * r * 10) / 10,
    fat:     Math.round(values.fat100     * r * 10) / 10,
    fiber:   Math.round((values.fiber100  || 0) * r * 10) / 10,
    sugar:   Math.round((values.sugar100  || 0) * r * 10) / 10,
  }
}

export default function AddMealModal({ isOpen, onClose, defaultMealType = null }) {
  const { addLog, profile, userId } = useDiet()

  // ── All hooks before early return ─────────────────────────────────────────
  const [tab,       setTab]       = useState('search') // 'search' | 'ai' | 'manual' | 'saved' | 'menus'
  const [mealType,  setMealType]  = useState(defaultMealType || 'Öğle')

  // Sync meal type when opened from a specific slot
  useEffect(() => {
    if (isOpen && defaultMealType) setMealType(defaultMealType)
  }, [isOpen, defaultMealType])

  // Load saved foods & menus from Supabase each time modal opens
  useEffect(() => {
    if (!isOpen || !userId) return
    supabase
      .from('saved_foods')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (!data) return
        setSavedFoods(data.map(row => ({
          id:           row.id,
          nickname:     row.nickname,
          originalName: row.original_name,
          kcal100:      Number(row.kcal),
          protein100:   Number(row.protein),
          carbs100:     Number(row.carbs),
          fat100:       Number(row.fat),
          fiber100:     Number(row.fiber),
          sugar100:     Number(row.sugar),
          defaultGrams: row.default_weight ?? 100,
          defaultUnit:  row.default_unit ?? 'gram',
          savedAt:      row.created_at,
        })))
      })
    supabase
      .from('saved_menus')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (!data) return
        setSavedMenus(data.map(row => ({
          id:         row.id,
          name:       row.name,
          items:      Array.isArray(row.items) ? row.items : [],
          totalKcal:  Number(row.total_kcal) || 0,
          savedAt:    row.created_at,
        })))
      })
  }, [isOpen, userId])
  const [mealLabel, setMealLabel] = useState('')
  const [basket,    setBasket]    = useState([])
  const [error,     setError]     = useState('')

  // Search sub-state
  const [query,   setQuery]   = useState('')
  const [selFood, setSelFood] = useState(null)
  const [selUnit, setSelUnit] = useState('')
  const [qty,     setQty]     = useState('1')
  const [gramsPerUnit, setGramsPerUnit] = useState('')
  const [searchPortionLoading, setSearchPortionLoading] = useState(false)
  const [searchPortionAiHint,  setSearchPortionAiHint]  = useState(false)

  // Manual sub-state
  const [mName, setMName] = useState('')
  const [mKcal, setMKcal] = useState('')
  const [mProt, setMProt] = useState('')
  const [mCarb, setMCarb] = useState('')
  const [mFat,  setMFat]  = useState('')
  const [mFib,  setMFib]  = useState('')
  const [mSug,  setMSug]  = useState('')

  // Barcode sub-state
  const [scannerOpen,         setScannerOpen]         = useState(false)
  const [barcodeInput,        setBarcodeInput]        = useState('')
  const [barcodeLoading,      setBarcodeLoading]      = useState(false)
  const [barcodeError,        setBarcodeError]        = useState('')
  const [barcodeProduct,      setBarcodeProduct]      = useState(null)
  const [barcodeQty,          setBarcodeQty]          = useState('100')
  const [barcodeUnit,         setBarcodeUnit]         = useState('gram')
  const [barcodeGramsPerUnit, setBarcodeGramsPerUnit] = useState('')
  const [barcodePackageGrams, setBarcodePackageGrams] = useState(null)
  const [barcodePortionLoading, setBarcodePortionLoading] = useState(false)
  const [barcodePortionAiHint,  setBarcodePortionAiHint]  = useState(false)

  // Unknown-product (not-found) inline form
  const [barcodeUnknown,  setBarcodeUnknown]  = useState(false)
  const [unknownName,     setUnknownName]     = useState('')
  const [unknownKcal100,  setUnknownKcal100]  = useState('')
  const [unknownProt100,  setUnknownProt100]  = useState('')
  const [unknownCarb100,  setUnknownCarb100]  = useState('')
  const [unknownFat100,   setUnknownFat100]   = useState('')
  const [unknownFib100,   setUnknownFib100]   = useState('')
  const [unknownSug100,   setUnknownSug100]   = useState('')
  const [unknownUnit,         setUnknownUnit]         = useState('gram')
  const [unknownQty,          setUnknownQty]          = useState('100')
  const [unknownGramsPerUnit, setUnknownGramsPerUnit] = useState('')
  const [unknownPortionLoading, setUnknownPortionLoading] = useState(false)
  const [unknownPortionAiHint,  setUnknownPortionAiHint]  = useState(false)

  // Saved foods & menus sub-state
  const [savedFoods,       setSavedFoods]       = useState([])
  const [savedMenus,       setSavedMenus]       = useState([])
  const [savingMenuId,     setSavingMenuId]     = useState(null)
  const [saveNickname,     setSaveNickname]     = useState('')
  const [showSaveForm,     setShowSaveForm]     = useState(false)
  const [savedFoodServing, setSavedFoodServing] = useState({}) // { [id]: { unit, qty, gramsPerUnit } }

  // Inline edit state for saved foods
  const [editingFoodId, setEditingFoodId] = useState(null)
  const [editFields,    setEditFields]    = useState({})

  // AI NLP sub-state
  const [aiText,      setAiText]      = useState('')
  const [aiLoading,   setAiLoading]   = useState(false)
  const [aiResults,   setAiResults]   = useState([])   // parsed food items from AI
  const [aiError,     setAiError]     = useState('')
  const [aiGrams,     setAiGrams]     = useState({})   // { [idx]: gramsString }
  const [aiSaveIdx,   setAiSaveIdx]   = useState(null) // index of item being saved
  const [aiSaveName,  setAiSaveName]  = useState('')

  // AI smart recommendations (lazy-loaded, cached)
  const EMPTY_RECOMMENDATIONS = { healthier: [], similar: [], menus: [] }
  const [aiRecommendations,       setAiRecommendations]       = useState(EMPTY_RECOMMENDATIONS)
  const [alternativesLoading,     setAlternativesLoading]     = useState(false)
  const [alternativesExpanded,    setAlternativesExpanded]    = useState(false)
  const [alternativesError,       setAlternativesError]       = useState('')
  const [alternativesUsedFallback,setAlternativesUsedFallback]= useState(false)
  const alternativesCache = useRef(new Map())
  const alternativesRequestId = useRef(0)
  const alternativesRefreshCounter = useRef(0)
  const alternativesShownHistory = useRef({ ids: [], names: [], menuIds: [] })
  const [savedPortionLoading,  setSavedPortionLoading]  = useState({})
  const [savedPortionAiHint,   setSavedPortionAiHint]   = useState({})

  const searchPortionRequestId = useRef(0)
  const barcodePortionRequestId = useRef(0)
  const unknownPortionRequestId = useRef(0)

  const searchResults = useMemo(
    () => (isOpen ? searchFoodsLocal(query) : []),
    [isOpen, query],
  )

  // Reset search UI whenever the modal opens (query may already be "" after close)
  useEffect(() => {
    if (!isOpen) return

    setQuery('')
    setSelFood(null)
    setSelUnit('')
    setQty('1')
    setGramsPerUnit('')
    setSearchPortionLoading(false)
    setSearchPortionAiHint(false)
  }, [isOpen])

  const preview = useMemo(
    () => calcPreview(selFood, selUnit, qty, gramsPerUnit),
    [selFood, selUnit, qty, gramsPerUnit]
  )

  const basketTotals = useMemo(() => ({
    kcal:    basket.reduce((s, i) => s + i.kcal,    0),
    protein: Math.round(basket.reduce((s, i) => s + i.protein,        0) * 10) / 10,
    carbs:   Math.round(basket.reduce((s, i) => s + i.carbs,          0) * 10) / 10,
    fat:     Math.round(basket.reduce((s, i) => s + i.fat,            0) * 10) / 10,
    fiber:   Math.round(basket.reduce((s, i) => s + (i.fiber || 0),   0) * 10) / 10,
    sugar:   Math.round(basket.reduce((s, i) => s + (i.sugar || 0),   0) * 10) / 10,
  }), [basket])

  const healthImpact = useMemo(() => checkHealthImpact(basket, profile), [basket, profile])

  const alternativesContextKey = useMemo(
    () => buildAlternativesCacheKey(selFood, basket, profile, mealType),
    [selFood?.id, basket, profile, mealType],
  )

  // Clear visible recommendations when context changes (no auto AI call)
  useEffect(() => {
    if (!isOpen) return
    setAiRecommendations(EMPTY_RECOMMENDATIONS)
    setAlternativesError('')
    setAlternativesUsedFallback(false)
    alternativesShownHistory.current = { ids: [], names: [], menuIds: [] }
  }, [alternativesContextKey, isOpen])

  function mergeShownHistory(recs) {
    const prev = alternativesShownHistory.current
    const foodIds = [...recs.healthier, ...recs.similar].map(f => f.id)
    const foodNames = [...recs.healthier, ...recs.similar].map(f => f.name)
    const menuIds = (recs.menus ?? []).map(m => m.id)
    alternativesShownHistory.current = {
      ids: [...new Set([...prev.ids, ...foodIds])],
      names: [...new Set([...prev.names, ...foodNames])],
      menuIds: [...new Set([...prev.menuIds, ...menuIds])],
    }
  }

  async function loadAlternatives({ forceRefresh = false } = {}) {
    if (!selFood && basket.length === 0) return

    const cacheKey = alternativesContextKey
    const history = alternativesShownHistory.current

    if (forceRefresh) {
      alternativesCache.current.delete(cacheKey)
      alternativesRefreshCounter.current += 1
      if (import.meta.env.DEV) {
        console.log('[alternatives] force refresh', {
          cacheKey,
          refreshCount: alternativesRefreshCounter.current,
          excludedIds: history.ids,
          excludedNames: history.names,
        })
      }
    } else {
      const cached = alternativesCache.current.get(cacheKey)
      if (cached) {
        if (import.meta.env.DEV) {
          console.log('[alternatives] using cache', {
            cacheKey,
            recommendations: cached.recommendations,
          })
        }
        setAiRecommendations(cached.recommendations ?? EMPTY_RECOMMENDATIONS)
        setAlternativesUsedFallback(cached.usedFallback)
        setAlternativesError(cached.error ?? '')
        return
      }
    }

    const requestId = ++alternativesRequestId.current
    setAlternativesLoading(true)
    setAlternativesError('')

    try {
      const result = await getHealthierAlternatives({
        selectedFood: selFood,
        basketItems: basket,
        mealType,
        userProfile: profile,
        goals: { primaryGoal: profile?.primaryGoal ?? profile?.goal },
        localCatalog: FOOD_DB,
        forceRefresh,
        excludedSuggestionIds: forceRefresh
          ? [...history.ids, ...history.menuIds]
          : [],
        excludedSuggestionNames: forceRefresh ? history.names : [],
      })
      if (alternativesRequestId.current !== requestId) return

      const recs = result.recommendations ?? EMPTY_RECOMMENDATIONS

      if (!forceRefresh || !result.usedFallback) {
        alternativesCache.current.set(cacheKey, result)
      }

      setAiRecommendations(recs)
      setAlternativesUsedFallback(result.usedFallback)
      setAlternativesError(result.error ?? '')
      mergeShownHistory(recs)

      if (import.meta.env.DEV) {
        console.log('[alternatives] loaded', {
          forceRefresh,
          aiCalled: result.aiCalled,
          usedFallback: result.usedFallback,
          recommendations: recs,
        })
      }
    } catch (err) {
      if (alternativesRequestId.current !== requestId) return
      console.error('[AddMealModal] getHealthierAlternatives failed:', err)
      setAlternativesError('YZ önerisi alınamadı, yerel öneriler gösteriliyor.')
      setAiRecommendations(EMPTY_RECOMMENDATIONS)
    } finally {
      if (alternativesRequestId.current === requestId) setAlternativesLoading(false)
    }
  }

  function handleToggleAlternatives() {
    const next = !alternativesExpanded
    setAlternativesExpanded(next)
    if (next) loadAlternatives()
  }

  function handleRefreshAlternatives() {
    loadAlternatives({ forceRefresh: true })
  }

  async function runSearchPortionEstimate(foodName, unit) {
    if (!foodName?.trim() || unit === 'Gram' || unit === 'Mililitre') {
      setSearchPortionLoading(false)
      return
    }
    const requestId = ++searchPortionRequestId.current
    setSearchPortionLoading(true)
    setSearchPortionAiHint(false)
    setGramsPerUnit('')
    try {
      const weight = await estimatePortionWeight(foodName.trim(), unit)
      if (searchPortionRequestId.current !== requestId) return
      if (weight) {
        setGramsPerUnit(String(weight))
        setSearchPortionAiHint(true)
      }
    } finally {
      if (searchPortionRequestId.current === requestId) setSearchPortionLoading(false)
    }
  }

  async function runBarcodePortionEstimate(productName, unitId) {
    if (!productName?.trim() || unitId === 'gram' || unitId === 'paket') {
      setBarcodePortionLoading(false)
      return
    }
    const requestId = ++barcodePortionRequestId.current
    setBarcodePortionLoading(true)
    setBarcodePortionAiHint(false)
    setBarcodeGramsPerUnit('')
    try {
      const weight = await estimatePortionWeight(productName.trim(), getUnitLabel(unitId))
      if (barcodePortionRequestId.current !== requestId) return
      if (weight) {
        setBarcodeGramsPerUnit(String(weight))
        setBarcodePortionAiHint(true)
      }
    } finally {
      if (barcodePortionRequestId.current === requestId) setBarcodePortionLoading(false)
    }
  }

  async function runUnknownPortionEstimate(name, unitId) {
    if (!name?.trim() || unitId === 'gram') {
      setUnknownPortionLoading(false)
      return
    }
    const requestId = ++unknownPortionRequestId.current
    setUnknownPortionLoading(true)
    setUnknownPortionAiHint(false)
    setUnknownGramsPerUnit('')
    try {
      const weight = await estimatePortionWeight(name.trim(), getUnitLabel(unitId))
      if (unknownPortionRequestId.current !== requestId) return
      if (weight) {
        setUnknownGramsPerUnit(String(weight))
        setUnknownPortionAiHint(true)
      }
    } finally {
      if (unknownPortionRequestId.current === requestId) setUnknownPortionLoading(false)
    }
  }

  // Re-estimate unknown product when name changes (debounced); unit changes trigger via button onClick
  useEffect(() => {
    if (!unknownName.trim() || unknownUnit === 'gram') return
    const timer = setTimeout(() => {
      runUnknownPortionEstimate(unknownName, unknownUnit)
    }, 600)
    return () => clearTimeout(timer)
  }, [unknownName])

  // ── Early return (after all hooks) ────────────────────────────────────────
  if (!isOpen) return null

  // ── Barcode API ────────────────────────────────────────────────────────────
  function applyBarcodeProduct(product) {
    setBarcodeProduct({
      name:       product.name,
      kcal100:    product.kcal100,
      protein100: product.protein100,
      carbs100:   product.carbs100,
      fat100:     product.fat100,
      fiber100:   product.fiber100,
      sugar100:   product.sugar100,
    })
    const servingG = product.servingQuantity
    const pkgG = product.packageGrams
    setBarcodePackageGrams(pkgG)

    if (servingG) {
      setBarcodeUnit('porsiyon')
      setBarcodeGramsPerUnit(String(servingG))
      setBarcodeQty('1')
    } else if (pkgG) {
      setBarcodeUnit('paket')
      setBarcodeGramsPerUnit(String(pkgG))
      setBarcodeQty('1')
    } else {
      setBarcodeUnit('gram')
      setBarcodeGramsPerUnit('')
      setBarcodeQty('100')
    }
  }

  function getSavedServing(food) {
    const saved = savedFoodServing[food.id]
    if (saved) return saved
    const unit = food.defaultUnit || 'gram'
    return {
      unit,
      qty: unit === 'gram' ? String(food.defaultGrams || 100) : '1',
      gramsPerUnit: unit === 'gram' ? '' : String(food.defaultGrams || ''),
    }
  }

  function updateSavedServing(food, patch) {
    setSavedFoodServing(prev => {
      const unit = food.defaultUnit || 'gram'
      const current = prev[food.id] ?? {
        unit,
        qty: unit === 'gram' ? String(food.defaultGrams || 100) : '1',
        gramsPerUnit: unit === 'gram' ? '' : String(food.defaultGrams || ''),
      }
      return { ...prev, [food.id]: { ...current, ...patch } }
    })
  }

  async function handleFetchBarcode(codeOverride) {
    const code = (codeOverride ?? barcodeInput).trim()
    if (!code) { setBarcodeError('Barkod numarası giriniz.'); return }
    setBarcodeInput(code)
    setTab('barcode')
    setBarcodeLoading(true)
    setBarcodeError('')
    setBarcodeProduct(null)
    setBarcodeUnknown(false)
    try {
      const result = await lookupBarcode(code)
      if (!result.found) {
        setBarcodeUnknown(true)
        setUnknownName('')
        setUnknownKcal100(''); setUnknownProt100(''); setUnknownCarb100('')
        setUnknownFat100(''); setUnknownFib100(''); setUnknownSug100('')
        setUnknownUnit('gram'); setUnknownQty('100'); setUnknownGramsPerUnit('')
        return
      }
      setBarcodeUnknown(false)
      applyBarcodeProduct(result.product)
    } catch {
      setBarcodeError('Bağlantı hatası. İnternet bağlantınızı kontrol edin.')
    } finally {
      setBarcodeLoading(false)
    }
  }

  function handleBarcodeScanned(code) {
    setScannerOpen(false)
    handleFetchBarcode(code)
  }

  function openBarcodeScanner() {
    setTab('barcode')
    setScannerOpen(true)
    setBarcodeError('')
  }

  // ── Unknown-product basket add ─────────────────────────────────────────────
  function addUnknownToBasket() {
    if (!unknownName.trim())                       { setError('Ürün adı zorunludur.');            return }
    if (!unknownKcal100 || Number(unknownKcal100) <= 0) { setError('Kalori değeri zorunludur.'); return }
    if (!isServingValid(unknownUnit, unknownQty, unknownGramsPerUnit)) {
      setError(unknownUnit === 'gram' ? 'Geçerli bir miktar girin.' : `"1 ${getUnitLabel(unknownUnit)} kaç gram?" alanını doldurun.`)
      return
    }
    const grams = calcTotalGrams(unknownUnit, unknownQty, unknownGramsPerUnit)
    const macros = macrosFrom100g({
      kcal100: Number(unknownKcal100),
      protein100: Number(unknownProt100 || 0),
      carbs100: Number(unknownCarb100 || 0),
      fat100: Number(unknownFat100 || 0),
      fiber100: Number(unknownFib100 || 0),
      sugar100: Number(unknownSug100 || 0),
    }, grams)
    setBasket(prev => [...prev, {
      id:       crypto.randomUUID(),
      foodId:   null,
      foodName: unknownName.trim(),
      unit:     unknownUnit === 'gram' ? `${grams}g` : `${unknownQty} ${getUnitLabel(unknownUnit)}`,
      qty:      1,
      ...macros,
    }])
    setUnknownName(''); setUnknownKcal100(''); setUnknownProt100(''); setUnknownCarb100('')
    setUnknownFat100(''); setUnknownFib100(''); setUnknownSug100('')
    setUnknownUnit('gram'); setUnknownQty('100'); setUnknownGramsPerUnit('')
    setBarcodeUnknown(false); setBarcodeInput('')
    setError('')
  }

  function addBarcodeToBasket() {
    if (!barcodeProduct) return
    if (!isServingValid(barcodeUnit, barcodeQty, barcodeGramsPerUnit)) {
      setError(barcodeUnit === 'gram' ? 'Geçerli bir miktar girin.' : `"1 ${getUnitLabel(barcodeUnit)} kaç gram?" alanını doldurun.`)
      return
    }
    const grams = calcTotalGrams(barcodeUnit, barcodeQty, barcodeGramsPerUnit)
    const macros = macrosFrom100g(barcodeProduct, grams)
    setBasket(prev => [...prev, {
      id:       crypto.randomUUID(),
      foodId:   null,
      foodName: barcodeProduct.name,
      unit:     barcodeUnit === 'gram' ? `${grams}g` : `${barcodeQty} ${getUnitLabel(barcodeUnit)}`,
      qty:      1,
      ...macros,
    }])
    setBarcodeInput(''); setBarcodeProduct(null)
    setBarcodeQty('100'); setBarcodeUnit('gram'); setBarcodeGramsPerUnit(''); setBarcodeError('')
    setShowSaveForm(false); setSaveNickname('')
  }

  // ── Saved foods (Supabase) ────────────────────────────────────────────────

  async function handleSaveFavorite() {
    if (!barcodeProduct || !saveNickname.trim() || !userId) return
    if (!isServingValid(barcodeUnit, barcodeQty, barcodeGramsPerUnit)) {
      setError(barcodeUnit === 'gram' ? 'Geçerli bir miktar girin.' : `"1 ${getUnitLabel(barcodeUnit)} kaç gram?" alanını doldurun.`)
      return
    }
    const defaultUnit = barcodeUnit
    const defaultGrams = defaultUnit === 'gram'
      ? Math.max(1, Number(barcodeQty) || 100)
      : Math.max(1, Number(barcodeGramsPerUnit) || 0)
    const newId = crypto.randomUUID()
    const newFood = {
      id:           newId,
      nickname:     saveNickname.trim(),
      originalName: barcodeProduct.name,
      kcal100:      barcodeProduct.kcal100,
      protein100:   barcodeProduct.protein100,
      carbs100:     barcodeProduct.carbs100,
      fat100:       barcodeProduct.fat100,
      fiber100:     barcodeProduct.fiber100,
      sugar100:     barcodeProduct.sugar100,
      defaultUnit,
      defaultGrams,
      savedAt:      new Date().toISOString(),
    }
    setSavedFoods(prev => [newFood, ...prev])
    setShowSaveForm(false)
    setSaveNickname('')
    await supabase.from('saved_foods').insert({
      id:             newId,
      user_id:        userId,
      nickname:       newFood.nickname,
      original_name:  newFood.originalName,
      kcal:           newFood.kcal100,
      protein:        newFood.protein100,
      carbs:          newFood.carbs100,
      fat:            newFood.fat100,
      fiber:          newFood.fiber100,
      sugar:          newFood.sugar100,
      default_unit:   defaultUnit,
      default_weight: defaultGrams,
    })
  }

  async function deleteSavedFood(id) {
    // Optimistic update
    setSavedFoods(prev => prev.filter(f => f.id !== id))
    if (editingFoodId === id) { setEditingFoodId(null); setEditFields({}) }
    if (userId) await supabase.from('saved_foods').delete().eq('id', id).eq('user_id', userId)
  }

  function quickAddSavedFood(food) {
    const serving = getSavedServing(food)
    if (!isServingValid(serving.unit, serving.qty, serving.gramsPerUnit)) {
      setError(serving.unit === 'gram' ? 'Geçerli bir miktar girin.' : `"1 ${getUnitLabel(serving.unit)} kaç gram?" alanını doldurun.`)
      return
    }
    const grams = calcTotalGrams(serving.unit, serving.qty, serving.gramsPerUnit)
    const macros = macrosFrom100g(food, grams)
    setBasket(prev => [...prev, {
      id:       crypto.randomUUID(),
      foodId:   null,
      foodName: food.nickname,
      unit:     serving.unit === 'gram' ? `${grams}g` : `${serving.qty} ${getUnitLabel(serving.unit)}`,
      qty:      1,
      ...macros,
    }])
  }

  function handleStartEdit(food) {
    setEditingFoodId(food.id)
    setEditFields({
      nickname:     food.nickname,
      defaultUnit:  food.defaultUnit || 'gram',
      defaultGrams: String(food.defaultGrams || 100),
      kcal100:      String(food.kcal100),
      protein100:   String(food.protein100),
      carbs100:     String(food.carbs100),
      fat100:       String(food.fat100),
      fiber100:     String(food.fiber100 || 0),
      sugar100:     String(food.sugar100 || 0),
    })
  }

  async function handleEditSave(foodId) {
    if (!editFields.nickname?.trim()) return
    const defaultUnit = editFields.defaultUnit || 'gram'
    const updates = {
      nickname:     editFields.nickname.trim(),
      defaultUnit,
      defaultGrams: Math.max(1, Number(editFields.defaultGrams) || 100),
      kcal100:      Math.max(0, Number(editFields.kcal100)     || 0),
      protein100:   Math.max(0, Number(editFields.protein100)  || 0),
      carbs100:     Math.max(0, Number(editFields.carbs100)    || 0),
      fat100:       Math.max(0, Number(editFields.fat100)      || 0),
      fiber100:     Math.max(0, Number(editFields.fiber100)    || 0),
      sugar100:     Math.max(0, Number(editFields.sugar100)    || 0),
    }
    setSavedFoods(prev => prev.map(f => f.id !== foodId ? f : { ...f, ...updates }))
    setEditingFoodId(null)
    setEditFields({})
    if (userId) {
      await supabase.from('saved_foods').update({
        nickname:       updates.nickname,
        kcal:           updates.kcal100,
        protein:        updates.protein100,
        carbs:          updates.carbs100,
        fat:            updates.fat100,
        fiber:          updates.fiber100,
        sugar:          updates.sugar100,
        default_unit:   updates.defaultUnit,
        default_weight: updates.defaultGrams,
      }).eq('id', foodId).eq('user_id', userId)
    }
  }

  function addSavedFoodToBasket(food) {
    const serving = getSavedServing(food)
    if (!isServingValid(serving.unit, serving.qty, serving.gramsPerUnit)) {
      setError(serving.unit === 'gram' ? 'Geçerli bir miktar girin.' : `"1 ${getUnitLabel(serving.unit)} kaç gram?" alanını doldurun.`)
      return
    }
    const grams = calcTotalGrams(serving.unit, serving.qty, serving.gramsPerUnit)
    const macros = macrosFrom100g(food, grams)
    setBasket(prev => [...prev, {
      id:       crypto.randomUUID(),
      foodId:   null,
      foodName: food.nickname,
      unit:     serving.unit === 'gram' ? `${grams}g` : `${serving.qty} ${getUnitLabel(serving.unit)}`,
      qty:      1,
      ...macros,
    }])
  }

  // ── AI NLP actions (Groq) ──────────────────────────────────────────────────
  async function handleAIParse() {
    if (!import.meta.env.VITE_GROQ_API_KEY) {
      setAiError('Groq API anahtarı eksik. Lütfen .env dosyanıza VITE_GROQ_API_KEY ekleyin.')
      return
    }
    if (!aiText.trim()) { setAiError('Lütfen ne yediğinizi yazın.'); return }
    setAiLoading(true)
    setAiError('')
    setAiResults([])
    setAiGrams({})
    try {
      const items = await parseMealTextWithAI(aiText)
      if (items.length === 0) {
        setAiError('Hiçbir besin tanımlanamadı. Daha açık bir şekilde yazmayı deneyin.')
      } else {
        const basketItems = items.map(item => ({
          id:       crypto.randomUUID(),
          foodId:   null,
          foodName: item.name,
          unit:     item.amount,
          qty:      1,
          kcal:     item.calories,
          protein:  item.protein,
          carbs:    item.carbs,
          fat:      item.fat,
          fiber:    0,
          sugar:    0,
        }))
        setBasket(prev => [...prev, ...basketItems])
        setError('')
      }
    } catch (err) {
      setAiError(err.message || 'Yanıt işlenirken bir hata oluştu. Lütfen tekrar deneyin.')
    } finally {
      setAiLoading(false)
    }
  }

  function addAIItemToBasket(item, idx) {
    const grams = Math.max(1, Number(aiGrams[idx]) || item.grams)
    const scale = grams / Math.max(1, item.grams)
    setBasket(prev => [...prev, {
      id:       crypto.randomUUID(),
      foodId:   null,
      foodName: item.name,
      unit:     `${grams}g`,
      qty:      1,
      kcal:     Math.round(item.calories * scale),
      protein:  Math.round(item.protein  * scale * 10) / 10,
      carbs:    Math.round(item.carbs    * scale * 10) / 10,
      fat:      Math.round(item.fat      * scale * 10) / 10,
      fiber:    0,
      sugar:    0,
    }])
    setError('')
  }

  function addAllAIItemsToBasket() {
    aiResults.forEach((item, idx) => addAIItemToBasket(item, idx))
  }

  async function handleSaveAIItem(idx) {
    const item = aiResults[idx]
    const nickname = aiSaveName.trim() || item.name
    if (!nickname || !userId) return
    const grams = Math.max(1, Number(aiGrams[idx]) || item.grams)
    const scale = grams / Math.max(1, item.grams)
    const kcal100 = Math.round((item.calories * scale) / (grams / 100))
    const newId = crypto.randomUUID()
    const newFood = {
      id:           newId,
      nickname,
      originalName: item.name,
      kcal100,
      protein100:   Math.round((item.protein * scale) / (grams / 100) * 10) / 10,
      carbs100:     Math.round((item.carbs   * scale) / (grams / 100) * 10) / 10,
      fat100:       Math.round((item.fat     * scale) / (grams / 100) * 10) / 10,
      fiber100:     0,
      sugar100:     0,
      defaultGrams: grams,
      savedAt:      new Date().toISOString(),
    }
    // Optimistic update
    setSavedFoods(prev => [newFood, ...prev])
    setAiSaveIdx(null)
    setAiSaveName('')
    // Persist
    await supabase.from('saved_foods').insert({
      id:             newId,
      user_id:        userId,
      nickname:       newFood.nickname,
      original_name:  newFood.originalName,
      kcal:           newFood.kcal100,
      protein:        newFood.protein100,
      carbs:          newFood.carbs100,
      fat:            newFood.fat100,
      fiber:          newFood.fiber100,
      sugar:          newFood.sugar100,
      default_weight: newFood.defaultGrams,
    })
  }

  // ── Basket actions ─────────────────────────────────────────────────────────
  function addToBasketFromSearch() {
    if (!selFood) return
    const previewNow = calcPreview(selFood, selUnit, qty, gramsPerUnit)
    if (!previewNow || previewNow.kcal <= 0) {
      setError(
        unitNeedsGramInput(selUnit, selFood)
          ? `"1 ${selUnit} kaç gram?" alanını doldurun.`
          : 'Geçerli bir miktar girin.'
      )
      return
    }
    const factor = previewNow.grams / 100
    setBasket(prev => [...prev, {
      id:       crypto.randomUUID(),
      foodId:   selFood.id,
      foodName: selFood.name,
      unit:     selUnit,
      qty:      parseQuantity(qty),
      kcal:     previewNow.kcal,
      protein:  previewNow.protein,
      carbs:    previewNow.carbs,
      fat:      previewNow.fat,
      fiber:    Math.round((selFood.fiber || 0) * factor * 10) / 10,
      sugar:    Math.round((selFood.sugar || 0) * factor * 10) / 10,
    }])
    setSelFood(null); setSelUnit(''); setQuery(''); setQty('1'); setGramsPerUnit('')
    setSearchPortionAiHint(false); setError('')
  }

  function addToBasketManual() {
    if (!mName.trim())                 { setError('Yemek adı zorunludur.');            return }
    if (!mKcal || Number(mKcal) <= 0) { setError('Geçerli bir kalori değeri girin.'); return }
    setBasket(prev => [...prev, {
      id:       crypto.randomUUID(),
      foodId:   null,
      foodName: mName.trim(),
      unit:     'Manuel',
      qty:      1,
      kcal:     Number(mKcal) || 0,
      protein:  Number(mProt) || 0,
      carbs:    Number(mCarb) || 0,
      fat:      Number(mFat)  || 0,
      fiber:    Number(mFib)  || 0,
      sugar:    Number(mSug)  || 0,
    }])
    setMName(''); setMKcal(''); setMProt(''); setMCarb(''); setMFat('')
    setMFib(''); setMSug(''); setError('')
  }

  function removeFromBasket(id) {
    setBasket(prev => prev.filter(i => i.id !== id))
  }

  function foodToBasketItem(food) {
    const unitName = Object.keys(food.units)[0]
    const qty = unitName === 'Gram' || unitName === 'Mililitre' ? '100' : '1'
    const preview = calcPreview(food, unitName, qty)
    if (!preview || preview.kcal <= 0) return null
    return {
      id:       crypto.randomUUID(),
      foodId:   food.id,
      foodName: food.name,
      unit:     unitName,
      qty:      Number(qty),
      kcal:     preview.kcal,
      protein:  preview.protein,
      carbs:    preview.carbs,
      fat:      preview.fat,
      fiber:    0,
      sugar:    0,
    }
  }

  function handleSelectFood(food) {
    if (!food) return
    setSelFood(food)
    const firstUnit = Object.keys(food.units || {})[0] || 'Gram'
    setSelUnit(firstUnit)
    if (firstUnit === 'Gram' || firstUnit === 'Mililitre') {
      setQty('100')
      setGramsPerUnit('')
    } else {
      setQty('1')
      const mult = food.units?.[firstUnit]
      setGramsPerUnit(mult != null ? String(Math.round(mult * 100)) : '')
    }
    setQuery('')
    setSearchPortionLoading(false)
    setSearchPortionAiHint(false)
    setError('')
    if (firstUnit !== 'Gram' && firstUnit !== 'Mililitre' && food.units?.[firstUnit] == null) {
      runSearchPortionEstimate(food.name, firstUnit)
    }
  }

  function menuItemToBasketItem(menuItem) {
    const food = FOOD_DB.find(f => f.id === menuItem.foodId)
    if (!food) return null
    const unitName = menuItem.unit && food.units?.[menuItem.unit]
      ? menuItem.unit
      : Object.keys(food.units || {})[0] || 'Gram'
    const qty = String(menuItem.qty ?? (unitName === 'Gram' || unitName === 'Mililitre' ? 100 : 1))
    const preview = calcPreview(food, unitName, qty)
    if (!preview || preview.kcal <= 0) return null
    return {
      id:       crypto.randomUUID(),
      foodId:   food.id,
      foodName: food.name,
      unit:     unitName,
      qty:      Number(qty),
      kcal:     preview.kcal,
      protein:  preview.protein,
      carbs:    preview.carbs,
      fat:      preview.fat,
      fiber:    0,
      sugar:    0,
    }
  }

  function handleAddMenuToBasket(menu) {
    const items = (menu.items ?? [])
      .map(menuItemToBasketItem)
      .filter(Boolean)
    if (items.length === 0) {
      setError('Menü öğeleri katalogda bulunamadı.')
      return
    }
    setBasket(prev => [...prev, ...items])
    setError('')
  }

  function handleSelectAlternative(alt) {
    const food = FOOD_DB.find(f => f.id === alt.id)
    if (!food) {
      console.warn('[AddMealModal] Alternative not found in catalog:', alt.id, alt.name)
      return
    }
    if (tab !== 'search') setTab('search')
    handleSelectFood(food)
  }

  function aiAlternativeToBasketItem(alt) {
    return {
      id:       crypto.randomUUID(),
      foodId:   null,
      foodName: alt.name,
      unit:     '1 porsiyon',
      qty:      1,
      kcal:     alt.calories ?? alt.kcal ?? 0,
      protein:  alt.protein ?? 0,
      carbs:    alt.carbs ?? 0,
      fat:      alt.fat ?? 0,
      fiber:    0,
      sugar:    0,
    }
  }

  function addAlternativeToBasket(alt) {
    if (alt.units) {
      const item = foodToBasketItem(alt)
      if (!item) {
        setError('Geçerli bir miktar girin.')
        return
      }
      setBasket(prev => [...prev, item])
    } else {
      setBasket(prev => [...prev, aiAlternativeToBasketItem(alt)])
    }
    setError('')
  }

  function basketItemToMenuItem(item) {
    return {
      foodId:   item.foodId ?? null,
      foodName: item.foodName,
      unit:     item.unit,
      qty:      item.qty,
      kcal:     item.kcal,
      protein:  item.protein,
      carbs:    item.carbs,
      fat:      item.fat,
      fiber:    item.fiber || 0,
      sugar:    item.sugar || 0,
    }
  }

  async function handleSaveAlternativeMenu(alt) {
    if (!userId) return
    setSavingMenuId(alt.id)
    const altItem = alt.units
      ? foodToBasketItem(alt)
      : {
          foodId:   null,
          foodName: alt.name,
          unit:     '1 porsiyon',
          qty:      1,
          kcal:     alt.calories ?? alt.kcal ?? 0,
          protein:  alt.protein ?? 0,
          carbs:    alt.carbs ?? 0,
          fat:      alt.fat ?? 0,
          fiber:    0,
          sugar:    0,
        }
    if (!altItem) {
      setSavingMenuId(null)
      setError('Menü kaydedilemedi.')
      return
    }
    const items = [
      ...basket.map(basketItemToMenuItem),
      basketItemToMenuItem(altItem),
    ]
    const name = mealLabel.trim() || alt.name
    const totalKcal = items.reduce((s, i) => s + (Number(i.kcal) || 0), 0)
    const newId = crypto.randomUUID()
    const newMenu = { id: newId, name, items, totalKcal, savedAt: new Date().toISOString() }
    setSavedMenus(prev => [newMenu, ...prev])
    try {
      await supabase.from('saved_menus').insert({
        id:         newId,
        user_id:    userId,
        name,
        items,
        total_kcal: totalKcal,
      })
      setError('Menü kaydedildi.')
    } catch {
      setSavedMenus(prev => prev.filter(m => m.id !== newId))
      setError('Menü kaydedilemedi. Tekrar deneyin.')
    } finally {
      setSavingMenuId(null)
    }
  }

  function applySavedMenu(menu) {
    if (!menu.items?.length) return
    const newItems = menu.items.map(item => ({
      id:       crypto.randomUUID(),
      foodId:   item.foodId ?? null,
      foodName: item.foodName,
      unit:     item.unit,
      qty:      Number(item.qty) || 1,
      kcal:     Number(item.kcal) || 0,
      protein:  Number(item.protein) || 0,
      carbs:    Number(item.carbs) || 0,
      fat:      Number(item.fat) || 0,
      fiber:    Number(item.fiber) || 0,
      sugar:    Number(item.sugar) || 0,
    }))
    setBasket(prev => [...prev, ...newItems])
    if (!mealLabel.trim()) setMealLabel(menu.name)
    setError('')
  }

  async function deleteSavedMenu(id) {
    setSavedMenus(prev => prev.filter(m => m.id !== id))
    if (userId) await supabase.from('saved_menus').delete().eq('id', id).eq('user_id', userId)
  }

  function handleSave() {
    if (basket.length === 0) { setError('Sepete en az bir ürün ekleyin.'); return }
    const name = mealLabel.trim() || mealType
    addLog({
      name, mealType,
      kcal:    basketTotals.kcal,
      protein: basketTotals.protein,
      carbs:   basketTotals.carbs,
      fat:     basketTotals.fat,
      fiber:   basketTotals.fiber,
      sugar:   basketTotals.sugar,
      items:   basket.map(i => ({
        foodName: i.foodName, unit: i.unit, qty: i.qty,
        kcal: i.kcal, protein: i.protein, carbs: i.carbs, fat: i.fat,
        fiber: i.fiber || 0, sugar: i.sugar || 0,
      })),
    })
    resetAll()
    onClose()
  }

  function resetAll() {
    setBasket([]); setMealLabel(''); setMealType('Öğle'); setTab('search')
    setQuery(''); setSelFood(null); setSelUnit(''); setQty('1'); setGramsPerUnit('')
    setSearchPortionLoading(false); setSearchPortionAiHint(false)
    setMName(''); setMKcal(''); setMProt(''); setMCarb(''); setMFat('')
    setMFib(''); setMSug(''); setError('')
    setScannerOpen(false); setBarcodeInput(''); setBarcodeLoading(false)
    setBarcodeError(''); setBarcodeProduct(null); setBarcodeQty('100'); setBarcodeUnit('gram')
    setBarcodeGramsPerUnit(''); setBarcodePackageGrams(null); setBarcodeUnknown(false)
    setBarcodePortionLoading(false); setBarcodePortionAiHint(false)
    setUnknownName(''); setUnknownKcal100(''); setUnknownProt100(''); setUnknownCarb100('')
    setUnknownFat100(''); setUnknownFib100(''); setUnknownSug100('')
    setUnknownUnit('gram'); setUnknownQty('100'); setUnknownGramsPerUnit('')
    setUnknownPortionLoading(false); setUnknownPortionAiHint(false)
    setShowSaveForm(false); setSaveNickname(''); setSavedFoodServing({})
    setEditingFoodId(null); setEditFields({})
    setAiText(''); setAiLoading(false); setAiResults([]); setAiError('')
    setAiGrams({}); setAiSaveIdx(null); setAiSaveName('')
    setAiRecommendations(EMPTY_RECOMMENDATIONS); setAlternativesLoading(false)
    setAlternativesExpanded(false); setAlternativesError(''); setAlternativesUsedFallback(false)
    setSavedPortionLoading({}); setSavedPortionAiHint({})
    setSavedMenus([]); setSavingMenuId(null)
  }

  function handleModalClose() {
    resetAll()
    onClose()
  }

  // List-only nested scroll; when a food is selected the main pane scrolls instead
  const searchResultsMode = tab === 'search' && !selFood

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      onClick={e => { if (e.target === e.currentTarget) handleModalClose() }}
      aria-modal="true" role="dialog"
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleModalClose} />

      <div
        className="relative flex max-h-[90vh] min-h-0 w-full max-w-app flex-col overflow-hidden rounded-t-3xl bg-white dark:bg-night-card shadow-2xl"
        onClick={e => e.stopPropagation()}
      >

        {/* ── FIXED HEADER ── */}
        <div className="flex-shrink-0 px-5 pt-3 pb-0">

          {/* Drag handle */}
          <div className="mb-3 flex justify-center">
            <div className="h-1 w-10 rounded-full bg-slate-200 dark:bg-night-muted" />
          </div>

          {/* Title row */}
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-slate-100">Öğün Ekle</h2>
              <p className="mt-0.5 text-[10px] font-medium text-slate-400 dark:text-slate-500">
                Bugünkü öğününüzü kaydedin
              </p>
            </div>
            <button
              type="button"
              onClick={e => { e.stopPropagation(); handleModalClose() }}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-slate-100 dark:bg-night-muted text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-night-border"
              aria-label="Modalı kapat"
            >
              <CloseIcon />
            </button>
          </div>

          {/* Meal type chips */}
          <div className="mb-3 grid grid-cols-4 gap-1.5">
            {MEAL_TYPES.map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setMealType(t)}
                className={`cursor-pointer rounded-xl py-1.5 text-xs font-bold transition-all ${
                  mealType === t
                    ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30'
                    : 'bg-slate-100 dark:bg-night-muted text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-night-border'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Meal label input */}
          <input
            type="text"
            value={mealLabel}
            onChange={e => setMealLabel(e.target.value)}
            placeholder="Öğün Etiketi (opsiyonel, örn. Spor Öncesi)"
            className="mb-3 w-full rounded-xl border border-slate-200 dark:border-night-border bg-white dark:bg-night-card px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:border-emerald-400"
          />

          {/* Sub-tab bar */}
          <div className="flex overflow-x-auto rounded-2xl bg-slate-100 dark:bg-night-muted p-1 gap-0.5">
            {[
              { id: 'search',  label: '🔍 Gıda Ara' },
              { id: 'barcode', label: '📷 Barkod' },
              { id: 'ai',      label: '🤖 YZ ile' },
              { id: 'manual',  label: '✍️ Manuel' },
              { id: 'saved',   label: '⭐ Kayıtlı' },
              { id: 'menus',   label: '📋 Menüler' },
            ].map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => { setTab(id); setError('') }}
                className={`flex-shrink-0 flex-1 cursor-pointer rounded-xl px-2 py-2 text-[10px] font-bold transition-all whitespace-nowrap ${
                  tab === id
                    ? 'bg-white dark:bg-night-card text-slate-900 dark:text-slate-100 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── SCROLLABLE CONTENT ── */}
        <div
          className={`min-h-0 flex-1 px-5 py-3 ${
            searchResultsMode
              ? 'flex flex-col overflow-hidden'
              : 'overflow-y-auto overscroll-contain space-y-3 pb-4'
          }`}
        >

          {/* ═══ SEARCH TAB ═══ */}
          {tab === 'search' && (
            <div className={searchResultsMode ? 'flex min-h-0 flex-1 flex-col gap-3' : 'flex flex-col gap-3'}>
              {(selFood || basket.length > 0) && (
                <div className="flex-shrink-0">
                  <MacroSummary
                    mode="alternatives"
                    recommendations={aiRecommendations}
                    alternativesLoading={alternativesLoading}
                    alternativesExpanded={alternativesExpanded}
                    onToggleAlternatives={handleToggleAlternatives}
                    onRefreshAlternatives={handleRefreshAlternatives}
                    alternativesError={alternativesError}
                    alternativesUsedFallback={alternativesUsedFallback}
                    onSelectAlternative={handleSelectAlternative}
                    onSaveAlternative={handleSaveAlternativeMenu}
                    onAddMenuToBasket={handleAddMenuToBasket}
                    savingMenuId={savingMenuId}
                  />
                </div>
              )}

              <div className={searchResultsMode ? 'flex min-h-0 flex-1 flex-col' : ''}>
                <SearchBar
                  query={query}       setQuery={setQuery}
                  selFood={selFood}   setSelFood={setSelFood}
                  selUnit={selUnit}   setSelUnit={setSelUnit}
                  qty={qty}           setQty={setQty}
                  gramsPerUnit={gramsPerUnit}
                  setGramsPerUnit={(val) => {
                    setGramsPerUnit(val)
                    setSearchPortionAiHint(false)
                  }}
                  portionLoading={searchPortionLoading}
                  portionAiHint={searchPortionAiHint}
                  onPortionEstimate={runSearchPortionEstimate}
                  results={searchResults}
                  preview={preview}
                  onAddToBasket={addToBasketFromSearch}
                  setError={setError}
                />
              </div>
            </div>
          )}

          {/* ═══ BARCODE TAB ═══ */}
          {tab === 'barcode' && (
            <BarcodeTab
              barcodeInput={barcodeInput}
              setBarcodeInput={setBarcodeInput}
              barcodeLoading={barcodeLoading}
              barcodeError={barcodeError}
              barcodeUnknown={barcodeUnknown}
              barcodeProduct={barcodeProduct}
              barcodeQty={barcodeQty}
              setBarcodeQty={setBarcodeQty}
              barcodeUnit={barcodeUnit}
              setBarcodeUnit={setBarcodeUnit}
              barcodeGramsPerUnit={barcodeGramsPerUnit}
              setBarcodeGramsPerUnit={setBarcodeGramsPerUnit}
              barcodePackageGrams={barcodePackageGrams}
              barcodePortionLoading={barcodePortionLoading}
              barcodePortionAiHint={barcodePortionAiHint}
              unknownName={unknownName}
              setUnknownName={setUnknownName}
              unknownKcal100={unknownKcal100}
              setUnknownKcal100={setUnknownKcal100}
              unknownProt100={unknownProt100}
              setUnknownProt100={setUnknownProt100}
              unknownCarb100={unknownCarb100}
              setUnknownCarb100={setUnknownCarb100}
              unknownFat100={unknownFat100}
              setUnknownFat100={setUnknownFat100}
              unknownFib100={unknownFib100}
              setUnknownFib100={setUnknownFib100}
              unknownSug100={unknownSug100}
              setUnknownSug100={setUnknownSug100}
              unknownUnit={unknownUnit}
              setUnknownUnit={setUnknownUnit}
              unknownQty={unknownQty}
              setUnknownQty={setUnknownQty}
              unknownGramsPerUnit={unknownGramsPerUnit}
              setUnknownGramsPerUnit={setUnknownGramsPerUnit}
              unknownPortionLoading={unknownPortionLoading}
              unknownPortionAiHint={unknownPortionAiHint}
              showSaveForm={showSaveForm}
              setShowSaveForm={setShowSaveForm}
              saveNickname={saveNickname}
              setSaveNickname={setSaveNickname}
              onOpenScanner={openBarcodeScanner}
              onFetchBarcode={handleFetchBarcode}
              onAddBarcodeToBasket={addBarcodeToBasket}
              onAddUnknownToBasket={addUnknownToBasket}
              onSaveFavorite={handleSaveFavorite}
              onRunBarcodePortionEstimate={runBarcodePortionEstimate}
              onRunUnknownPortionEstimate={runUnknownPortionEstimate}
              getUnitLabel={getUnitLabel}
              isServingValid={isServingValid}
              calcTotalGrams={calcTotalGrams}
              macrosFrom100g={macrosFrom100g}
              setError={setError}
              setBarcodeError={setBarcodeError}
            />
          )}

          {/* ═══ AI NLP TAB ═══ */}
          {tab === 'ai' && (
            <div className="space-y-3">

              {/* Prompt header */}
              <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/10 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl leading-none">🤖</span>
                  <div>
                    <p className="text-sm font-extrabold text-emerald-800 dark:text-emerald-300">Yapay Zeka ile Ekle</p>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-500">Doğal dilde ne yediğinizi yazın, AI besinleri ve makroları otomatik hesaplasın.</p>
                  </div>
                </div>

                <textarea
                  value={aiText}
                  onChange={e => { setAiText(e.target.value); setAiError('') }}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleAIParse() }}
                  rows={3}
                  placeholder="Ne yedin? Örn: Bugün kahvaltıda az yağlı 2 yumurtalı omlet, 1 dilim beyaz peynir ve 3 bardak çay içtim."
                  className="w-full resize-none rounded-xl border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-night-card px-3 py-2.5 text-sm font-medium text-slate-800 dark:text-slate-100 outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:border-emerald-500"
                />

                <button
                  type="button"
                  onClick={handleAIParse}
                  disabled={aiLoading || !aiText.trim()}
                  className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-sm font-extrabold text-white transition-all hover:bg-emerald-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {aiLoading ? (
                    <>
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Çözümleniyor…
                    </>
                  ) : (
                    <>✨ Çözümle ve Sepete Ekle</>
                  )}
                </button>

                {aiError && (
                  <p className="flex items-center gap-2 rounded-xl bg-red-50 dark:bg-red-900/20 px-3 py-2 text-xs font-semibold text-red-600 dark:text-red-400">
                    <span>❌</span> {aiError}
                  </p>
                )}
              </div>

              {/* AI Results */}
              {aiResults.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-extrabold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                      Tanımlanan Besinler ({aiResults.length})
                    </p>
                    <button
                      type="button"
                      onClick={addAllAIItemsToBasket}
                      className="flex cursor-pointer items-center gap-1 rounded-lg bg-emerald-500 px-3 py-1.5 text-[10px] font-extrabold text-white transition-all hover:bg-emerald-600 active:scale-95"
                    >
                      <PlusIcon /> Tümünü Ekle
                    </button>
                  </div>

                  {aiResults.map((item, idx) => {
                    const grams = Math.max(1, Number(aiGrams[idx]) || item.grams)
                    const scale = grams / Math.max(1, item.grams)
                    const totalKcal = Math.round(item.calories * scale)

                    return (
                      <div key={idx} className="rounded-2xl border border-slate-100 dark:border-night-border bg-white dark:bg-night-card p-3 space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-extrabold text-slate-900 dark:text-slate-100">{item.name}</p>
                            <p className="mt-0.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                              YZ tahmini: {item.grams}g porsiyon
                            </p>
                          </div>
                          <span className="flex-shrink-0 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 px-2 py-1 text-xs font-extrabold text-emerald-700 dark:text-emerald-400">
                            {totalKcal} kcal
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-1 text-center">
                          {[
                            { label: 'Protein', val: Math.round(item.protein * scale * 10) / 10, color: 'text-indigo-600 dark:text-indigo-400' },
                            { label: 'Karb',    val: Math.round(item.carbs   * scale * 10) / 10, color: 'text-amber-600 dark:text-amber-400'  },
                            { label: 'Yağ',     val: Math.round(item.fat     * scale * 10) / 10, color: 'text-rose-500 dark:text-rose-400'    },
                          ].map(({ label, val, color }) => (
                            <div key={label} className="rounded-lg bg-slate-50 dark:bg-night-muted px-1 py-1.5">
                              <p className={`text-[9px] font-bold ${color}`}>{label}</p>
                              <p className="text-[10px] font-extrabold text-slate-800 dark:text-slate-100">{val}g</p>
                            </div>
                          ))}
                        </div>

                        <div>
                          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">Porsiyon (gram)</p>
                          <div className="flex items-center gap-2">
                            <input
                              type="number" inputMode="numeric" min="1"
                              value={aiGrams[idx] ?? String(item.grams)}
                              onChange={e => setAiGrams(prev => ({ ...prev, [idx]: e.target.value }))}
                              className="w-20 rounded-xl border border-slate-200 dark:border-night-border bg-white dark:bg-night-card px-3 py-2 text-sm font-bold text-slate-800 dark:text-slate-100 outline-none text-center focus:border-emerald-400"
                            />
                            <span className="text-xs text-slate-400 dark:text-slate-500">gram</span>
                            <button type="button" onClick={() => addAIItemToBasket(item, idx)}
                              className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-emerald-500 py-2 text-xs font-extrabold text-white transition-all hover:bg-emerald-600 active:scale-95">
                              <PlusIcon /> Sepete Ekle · {totalKcal} kcal
                            </button>
                          </div>
                        </div>

                        {/* Save to favorites */}
                        <div className="border-t border-slate-100 dark:border-night-border pt-2">
                          {aiSaveIdx === idx ? (
                            <div className="flex gap-2">
                              <input type="text"
                                value={aiSaveName}
                                onChange={e => setAiSaveName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSaveAIItem(idx)}
                                placeholder={item.name}
                                className="flex-1 rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-night-card px-3 py-2 text-xs font-medium text-slate-800 dark:text-slate-100 outline-none focus:border-amber-500"
                              />
                              <button type="button" onClick={() => handleSaveAIItem(idx)}
                                className="cursor-pointer rounded-xl bg-amber-500 px-3 py-2 text-xs font-extrabold text-white hover:bg-amber-600 transition-colors">⭐</button>
                              <button type="button" onClick={() => { setAiSaveIdx(null); setAiSaveName('') }}
                                className="cursor-pointer rounded-xl bg-slate-100 dark:bg-night-muted px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-200 transition-colors">İptal</button>
                            </div>
                          ) : (
                            <button type="button"
                              onClick={() => { setAiSaveIdx(idx); setAiSaveName(item.name) }}
                              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-900/10 py-1.5 text-[10px] font-bold text-amber-700 dark:text-amber-400 transition-all hover:bg-amber-100 dark:hover:bg-amber-900/20">
                              <span>⭐</span> Favorilere Kaydet
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ═══ SAVED MENUS TAB ═══ */}
          {tab === 'menus' && (
            <div className="space-y-3">
              {savedMenus.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                  <p className="text-sm font-bold text-slate-600 dark:text-slate-400">Henüz kaydedilmiş menü yok</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed max-w-xs">
                    Gıda Ara sekmesindeki &quot;Daha Sağlıklı Alternatifler&quot; bölümünden &quot;Bunu Kaydet&quot; ile menü oluşturabilirsiniz.
                  </p>
                </div>
              ) : savedMenus.map(menu => (
                <div key={menu.id} className="rounded-2xl border border-slate-100 dark:border-night-border bg-white dark:bg-night-card p-3 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-extrabold text-slate-900 dark:text-slate-100">{menu.name}</p>
                      <p className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500">
                        {menu.items.length} ürün · {menu.totalKcal} kcal
                      </p>
                    </div>
                    <button type="button" onClick={() => deleteSavedMenu(menu.id)}
                      className="flex h-7 w-7 flex-shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-300 dark:text-slate-600 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-400 transition-colors"
                      aria-label="Sil">
                      <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                  <div className="space-y-1">
                    {menu.items.map((item, idx) => (
                      <p key={idx} className="text-[10px] text-slate-500 dark:text-slate-400">
                        {item.foodName} · {item.kcal} kcal
                      </p>
                    ))}
                  </div>
                  <button type="button" onClick={() => applySavedMenu(menu)}
                    className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-500 py-2.5 text-xs font-extrabold text-white shadow-sm transition-all hover:bg-emerald-600 active:scale-95">
                    <PlusIcon />
                    Sepete Ekle · {menu.totalKcal} kcal
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* ═══ SAVED FOODS TAB ═══ */}
          {tab === 'saved' && (
            <div className="space-y-3">
              {savedFoods.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                  <p className="text-sm font-bold text-slate-600 dark:text-slate-400">Henüz kayıtlı yemek yok</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed max-w-xs">
                    "YZ ile Ekle" veya "Barkod Tara" sekmesindeki ürün kartlarından "Favorilere Kaydet" butonuyla buraya ekleyebilirsiniz.
                  </p>
                </div>
              ) : savedFoods.map(food => {
                const serving = getSavedServing(food)
                const totalGrams = isServingValid(serving.unit, serving.qty, serving.gramsPerUnit)
                  ? calcTotalGrams(serving.unit, serving.qty, serving.gramsPerUnit)
                  : 0
                const r = totalGrams / 100
                const totalKcal = Math.round(food.kcal100 * r)
                const quickServing = getSavedServing(food)
                const quickGrams = isServingValid(quickServing.unit, quickServing.qty, quickServing.gramsPerUnit)
                  ? calcTotalGrams(quickServing.unit, quickServing.qty, quickServing.gramsPerUnit)
                  : food.defaultGrams || 100
                const quickKcal = Math.round(food.kcal100 * (quickGrams / 100))
                const isEditing = editingFoodId === food.id

                return (
                  <div key={food.id} className={`rounded-2xl border bg-white dark:bg-night-card p-3 space-y-2.5 transition-all ${
                    isEditing ? 'border-amber-300 dark:border-amber-700' : 'border-slate-100 dark:border-night-border'
                  }`}>

                    {/* ── Card header: name + action icons ── */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-extrabold text-slate-900 dark:text-slate-100">{food.nickname}</p>
                        {food.originalName && food.originalName !== food.nickname && (
                          <p className="mt-0.5 truncate text-[10px] text-slate-400 dark:text-slate-500">{food.originalName}</p>
                        )}
                        <p className="text-[10px] text-slate-400 dark:text-slate-500">
                          {food.kcal100} kcal · P:{food.protein100}g K:{food.carbs100}g Y:{food.fat100}g / 100g
                        </p>
                      </div>
                      <div className="flex flex-shrink-0 items-center gap-1">
                        {/* Düzenle */}
                        <button type="button"
                          onClick={() => isEditing ? (setEditingFoodId(null), setEditFields({})) : handleStartEdit(food)}
                          className={`flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg transition-colors ${
                            isEditing
                              ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                              : 'text-slate-300 dark:text-slate-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 hover:text-amber-500'
                          }`}
                          aria-label="Düzenle">
                          <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                          </svg>
                        </button>
                        {/* Sil */}
                        <button type="button" onClick={() => deleteSavedFood(food.id)}
                          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-slate-300 dark:text-slate-600 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-400 transition-colors"
                          aria-label="Sil">
                          <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* ── Inline edit form ── */}
                    {isEditing && (
                      <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 p-3 space-y-2.5">
                        <p className="text-[10px] font-extrabold uppercase tracking-wide text-amber-700 dark:text-amber-400">Düzenle</p>
                        <input type="text"
                          value={editFields.nickname || ''}
                          onChange={e => setEditFields(f => ({ ...f, nickname: e.target.value }))}
                          placeholder="Takma ad"
                          className="w-full rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-night-card px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-amber-500"
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">Varsayılan birim:</label>
                          <select
                            value={editFields.defaultUnit || 'gram'}
                            onChange={e => setEditFields(f => ({ ...f, defaultUnit: e.target.value }))}
                            className="rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-night-card px-2 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-amber-500"
                          >
                            {SERVING_UNITS.map(u => (
                              <option key={u.id} value={u.id}>{u.label}</option>
                            ))}
                          </select>
                          <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            {editFields.defaultUnit === 'gram' ? 'Gram:' : `1 ${getUnitLabel(editFields.defaultUnit || 'gram')} =`}
                          </label>
                          <input type="number" inputMode="numeric" min="1"
                            value={editFields.defaultGrams || ''}
                            onChange={e => setEditFields(f => ({ ...f, defaultGrams: e.target.value }))}
                            className="w-16 rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-night-card px-2 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none text-center focus:border-amber-500"
                          />
                          <span className="text-[10px] text-slate-400">g</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          {[
                            { key: 'kcal100',    label: 'Kal*',   color: 'text-emerald-600 dark:text-emerald-400' },
                            { key: 'protein100', label: 'Protein', color: 'text-indigo-600 dark:text-indigo-400'  },
                            { key: 'carbs100',   label: 'Karb',    color: 'text-amber-600 dark:text-amber-400'    },
                            { key: 'fat100',     label: 'Yağ',     color: 'text-rose-500 dark:text-rose-400'      },
                            { key: 'fiber100',   label: 'Lif',     color: 'text-teal-600 dark:text-teal-400'      },
                            { key: 'sugar100',   label: 'Şeker',   color: 'text-pink-600 dark:text-pink-400'      },
                          ].map(({ key, label, color }) => (
                            <div key={key} className="rounded-xl border border-amber-200 dark:border-amber-800 bg-white dark:bg-night-card px-2 py-1.5 text-center">
                              <label className={`block text-[9px] font-bold ${color}`}>{label}</label>
                              <input type="number" inputMode="decimal" min="0"
                                value={editFields[key] ?? ''}
                                onChange={e => setEditFields(f => ({ ...f, [key]: e.target.value }))}
                                placeholder="0"
                                className="mt-0.5 w-full bg-transparent text-center text-sm font-extrabold text-slate-800 dark:text-slate-100 outline-none placeholder:text-slate-200"
                              />
                              <span className="text-[9px] text-slate-400">{key === 'kcal100' ? 'kcal' : 'g'}</span>
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => handleEditSave(food.id)}
                            className="flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-xl bg-amber-500 py-2 text-xs font-extrabold text-white transition-all hover:bg-amber-600 active:scale-95">
                            ✓ Kaydet
                          </button>
                          <button type="button" onClick={() => { setEditingFoodId(null); setEditFields({}) }}
                            className="cursor-pointer rounded-xl bg-slate-100 dark:bg-night-muted px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-200 transition-colors">
                            İptal
                          </button>
                        </div>
                      </div>
                    )}

                    {/* ── Macro chips (scaled to current gram input) ── */}
                    {!isEditing && (
                      <div className="flex gap-1 text-center">
                        {[
                          { label: 'P', val: Math.round(food.protein100 * r * 10) / 10, color: 'text-indigo-500' },
                          { label: 'K', val: Math.round(food.carbs100   * r * 10) / 10, color: 'text-amber-500'  },
                          { label: 'Y', val: Math.round(food.fat100     * r * 10) / 10, color: 'text-rose-400'   },
                          { label: 'L', val: Math.round((food.fiber100 || 0) * r * 10) / 10, color: 'text-teal-500' },
                          { label: 'Ş', val: Math.round((food.sugar100 || 0) * r * 10) / 10, color: 'text-pink-500' },
                        ].map(({ label, val, color }) => (
                          <div key={label} className="flex-1 rounded-lg bg-slate-50 dark:bg-night-muted px-1 py-1">
                            <p className={`text-[9px] font-extrabold ${color}`}>{label}</p>
                            <p className="text-[9px] font-bold text-slate-700 dark:text-slate-300">{val}g</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* ── Hızlı Ekle button (uses saved default serving) ── */}
                    {!isEditing && (
                      <button type="button" onClick={() => quickAddSavedFood(food)}
                        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-500 py-2.5 text-xs font-extrabold text-white shadow-sm shadow-emerald-200 dark:shadow-none transition-all hover:bg-emerald-600 active:scale-95">
                        <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                        </svg>
                        Hızlı Ekle
                        <span className="rounded-full bg-emerald-400/40 px-2 py-0.5 text-[9px] font-extrabold">
                          {quickGrams}g · {quickKcal} kcal
                        </span>
                      </button>
                    )}

                    {/* ── Unit selector + custom gram input ── */}
                    {!isEditing && (
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-1">
                          {SERVING_UNITS.map(u => (
                            <button key={u.id} type="button"
                              onClick={() => {
                                updateSavedServing(food, {
                                  unit: u.id,
                                  gramsPerUnit: '',
                                  qty: u.id === 'gram' ? String(food.defaultGrams || 100) : '1',
                                })
                                setSavedPortionAiHint(prev => ({ ...prev, [food.id]: false }))
                                if (u.id !== 'gram') {
                                  setSavedPortionLoading(prev => ({ ...prev, [food.id]: true }))
                                  estimatePortionWeight(food.nickname, getUnitLabel(u.id))
                                    .then(weight => {
                                      if (weight) {
                                        updateSavedServing(food, { gramsPerUnit: String(weight) })
                                        setSavedPortionAiHint(prev => ({ ...prev, [food.id]: true }))
                                      }
                                    })
                                    .finally(() => {
                                      setSavedPortionLoading(prev => ({ ...prev, [food.id]: false }))
                                    })
                                }
                              }}
                              className={`cursor-pointer rounded-lg px-2 py-1 text-[9px] font-bold transition-all ${
                                serving.unit === u.id
                                  ? 'bg-emerald-500 text-white shadow-sm'
                                  : 'bg-slate-100 dark:bg-night-muted text-slate-600 dark:text-slate-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                              }`}>
                              {u.label}
                            </button>
                          ))}
                        </div>
                        {serving.unit !== 'gram' && (
                          <div>
                            <label className="mb-1 block text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                              1 {getUnitLabel(serving.unit)} kaç gram? *
                            </label>
                            <div className="flex items-center gap-2">
                              <div className="relative">
                                <input
                                  type="text" inputMode="decimal"
                                  disabled={savedPortionLoading[food.id]}
                                  value={savedPortionLoading[food.id] ? '' : serving.gramsPerUnit}
                                  onChange={e => {
                                    updateSavedServing(food, { gramsPerUnit: e.target.value })
                                    setSavedPortionAiHint(prev => ({ ...prev, [food.id]: false }))
                                  }}
                                  placeholder={savedPortionLoading[food.id] ? 'YZ Hesaplanıyor...' : String(food.defaultGrams || '')}
                                  className="w-20 rounded-xl border border-slate-200 dark:border-night-border bg-white dark:bg-night-card px-2 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none text-center focus:border-emerald-400 disabled:opacity-70 disabled:cursor-wait dark:disabled:bg-night-muted"
                                />
                                {savedPortionLoading[food.id] && (
                                  <svg className="absolute right-1 top-1/2 h-3 w-3 -translate-y-1/2 animate-spin text-emerald-500" viewBox="0 0 24 24" fill="none">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                  </svg>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400 dark:text-slate-500">gram</span>
                            </div>
                            {savedPortionAiHint[food.id] && !savedPortionLoading[food.id] && (
                              <p className="mt-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                                ✨ YZ ile otomatik hesaplandı
                              </p>
                            )}
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <input type="number" inputMode="decimal" min="0.1" step="0.5"
                            value={serving.qty}
                            onChange={e => updateSavedServing(food, { qty: e.target.value })}
                            className="w-14 rounded-xl border border-slate-200 dark:border-night-border bg-white dark:bg-night-card px-2 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none text-center focus:border-emerald-400" />
                          <span className="text-[10px] text-slate-400 dark:text-slate-500">
                            {serving.unit === 'gram' ? 'gram' : getUnitLabel(serving.unit)}
                          </span>
                          {totalGrams > 0 && (
                            <span className="text-[10px] text-slate-400 dark:text-slate-500">≈ {totalGrams}g</span>
                          )}
                          <button type="button" onClick={() => addSavedFoodToBasket(food)}
                            className="flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-xl border border-emerald-300 dark:border-emerald-700 py-1.5 text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 transition-all hover:bg-emerald-50 dark:hover:bg-emerald-900/20 active:scale-95">
                            <PlusIcon /> {totalKcal > 0 ? `${totalKcal} kcal ekle` : 'Sepete Ekle'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* ═══ MANUAL TAB ═══ */}
          {tab === 'manual' && (
            <div className="space-y-3">
              <input
                type="text"
                value={mName}
                onChange={e => { setMName(e.target.value); setError('') }}
                placeholder="Yemek adı (örn. Ev çorbası)"
                className="w-full rounded-2xl border-2 border-slate-200 dark:border-night-border bg-white dark:bg-night-card px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100 outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:border-emerald-500"
              />

              <div className={`rounded-2xl border-2 px-4 py-3 transition-all ${mKcal ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'border-slate-200 dark:border-night-border bg-white dark:bg-night-card'}`}>
                <label className="block text-xs font-bold text-emerald-600 dark:text-emerald-400">Kalori *</label>
                <div className="flex items-baseline gap-2">
                  <input
                    type="number" inputMode="numeric" min="1" value={mKcal}
                    onChange={e => { setMKcal(e.target.value); setError('') }}
                    placeholder="0"
                    className="w-full bg-transparent text-3xl font-extrabold text-slate-900 dark:text-slate-100 outline-none placeholder:text-slate-200 dark:placeholder:text-night-muted"
                  />
                  <span className="text-base font-semibold text-slate-400 dark:text-slate-500">kcal</span>
                </div>
              </div>

              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Makrolar (opsiyonel)</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { val: mProt, set: setMProt, label: 'Protein', color: 'text-indigo-600 dark:text-indigo-400', focus: 'focus-within:border-indigo-400' },
                    { val: mCarb, set: setMCarb, label: 'Karb',    color: 'text-amber-600 dark:text-amber-400',  focus: 'focus-within:border-amber-400'  },
                    { val: mFat,  set: setMFat,  label: 'Yağ',     color: 'text-rose-500 dark:text-rose-400',   focus: 'focus-within:border-rose-400'   },
                    { val: mFib,  set: setMFib,  label: 'Lif',     color: 'text-teal-600 dark:text-teal-400',   focus: 'focus-within:border-teal-400'   },
                    { val: mSug,  set: setMSug,  label: 'Şeker',   color: 'text-pink-600 dark:text-pink-400',   focus: 'focus-within:border-pink-400'   },
                  ].map(({ val, set, label, color, focus }) => (
                    <div key={label} className={`rounded-2xl border-2 border-slate-200 dark:border-night-border bg-white dark:bg-night-card px-3 py-3 text-center transition-all ${focus}`}>
                      <label className={`block text-[10px] font-bold ${color}`}>{label}</label>
                      <input
                        type="number" inputMode="decimal" min="0"
                        value={val}
                        onChange={e => { set(e.target.value); setError('') }}
                        placeholder="0"
                        className="mt-1 w-full bg-transparent text-center text-xl font-extrabold text-slate-800 dark:text-slate-100 outline-none placeholder:text-slate-200 dark:placeholder:text-night-muted"
                      />
                      <span className="text-xs text-slate-400 dark:text-slate-500">g</span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={addToBasketManual}
                className="flex w-full items-center justify-center gap-1.5 rounded-2xl border-2 border-emerald-500 py-3 text-sm font-bold text-emerald-600 transition-all hover:bg-emerald-50 dark:hover:bg-emerald-900/20 active:scale-95 cursor-pointer"
              >
                <PlusIcon /> Sepete Ekle
              </button>
            </div>
          )}

          {/* Health impact (warnings only — alternatives shown at top of search tab) */}
          {basket.length > 0 && (
            <div className={tab === 'search' ? 'flex-shrink-0' : ''}>
              <MacroSummary mode="impact" impact={healthImpact} />
            </div>
          )}
        </div>

        {/* ── FIXED FOOTER ── */}
        <div className="relative z-10 flex-shrink-0 px-5 pb-8 pt-3 space-y-2 border-t border-slate-100 dark:border-night-border bg-white dark:bg-night-card">

          {basket.length > 0 && (
            <BasketItem basket={basket} totals={basketTotals} onRemove={removeFromBasket} />
          )}

          {error && (
            <p className={`rounded-xl px-3 py-2 text-xs font-semibold ${
              error.includes('kaydedildi')
                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
            }`}>
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={handleSave}
            className={`flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-extrabold text-white shadow-xl transition-all active:scale-95 ${
              basket.length > 0
                ? 'cursor-pointer bg-emerald-500 shadow-emerald-200 hover:bg-emerald-600'
                : 'cursor-not-allowed bg-slate-200 dark:bg-night-muted text-slate-400 shadow-none'
            }`}
          >
            <PlusIcon />
            {basket.length > 0
              ? `Öğünü Kaydet · ${basketTotals.kcal} kcal`
              : 'Sepet Boş'}
          </button>
        </div>

      </div>

      {scannerOpen && (
        <BarcodeScanner
          onScan={handleBarcodeScanned}
          onClose={() => setScannerOpen(false)}
        />
      )}
    </div>
  )
}
