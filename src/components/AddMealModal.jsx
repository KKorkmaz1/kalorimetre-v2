import { useState, useMemo, useEffect } from 'react'
import { useDiet } from '../context/DietContext'
import { FOOD_DB, MEAL_TYPES, checkHealthImpact, getSuggestedAlternatives, calcPreview } from './Meal/foodData'
import { PlusIcon, CloseIcon } from './Meal/MealIcons'
import SearchBar from './Meal/SearchBar'
import BasketItem from './Meal/BasketItem'
import MacroSummary from './Meal/MacroSummary'

// ─── OpenFoodFacts API helper ─────────────────────────────────────────────────

async function fetchOpenFoodFacts(barcode) {
  const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`)
  if (!res.ok) throw new Error('HTTP ' + res.status)
  return res.json()
}

// ─── Serving unit pool ────────────────────────────────────────────────────────

const ALL_UNITS = {
  gram:    { id: 'gram',    label: 'Gram',     grams: null },
  kase:    { id: 'kase',    label: 'Kase',     grams: 50   },
  dilim:   { id: 'dilim',   label: 'Dilim',    grams: 30   },
  piece:   { id: 'piece',   label: 'Adet/Bar', grams: 50   },
  spoon:   { id: 'spoon',   label: 'Kaşık',    grams: 15   },
  glass:   { id: 'glass',   label: 'Bardak',   grams: 200  },
  portion: { id: 'portion', label: 'Porsiyon', grams: 150  },
}

/**
 * Derive context-aware serving units from a product name using keyword rules.
 * Always starts with Gram so the user can type any value.
 */
function deriveSmartServingUnits(name) {
  const n = (name || '').toLowerCase()
  // Cereal / oat bowl items
  if (/gevrek|flakes|müsli|yulaf|muesli/.test(n))
    return [ALL_UNITS.gram, ALL_UNITS.kase]
  // Bread / pizza / slice items
  if (/ekmek|pizza|dilim/.test(n))
    return [ALL_UNITS.gram, ALL_UNITS.dilim]
  // Chocolate / bar / biscuit items
  if (/çikolata|chocolate|tadelle|biskuvi|bisküvi|\bbar\b/.test(n))
    return [ALL_UNITS.gram, ALL_UNITS.piece]
  // Spreads — hazelnut creams, nut butters, Nutella-type (spoon only, no glass)
  if (/sarelle|nutella|fıstık ezmesi|fındık|krema|hazelnut|noisettes|spread/.test(n))
    return [ALL_UNITS.gram, ALL_UNITS.spoon]
  // Dairy & liquids — yogurt, water, juice (spoon + glass)
  if (/yoğurt|sıvı|\bsu\b/.test(n))
    return [ALL_UNITS.gram, ALL_UNITS.spoon, ALL_UNITS.glass]
  // Default
  return [ALL_UNITS.gram, ALL_UNITS.portion]
}

// ─── Saved foods localStorage key ────────────────────────────────────────────

const SAVED_FOODS_KEY = 'kalorimetre_saved_foods'

export default function AddMealModal({ isOpen, onClose, defaultMealType = null }) {
  const { addLog, profile } = useDiet()

  // ── All hooks before early return ─────────────────────────────────────────
  const [tab,       setTab]       = useState('search') // 'search' | 'manual'
  const [mealType,  setMealType]  = useState(defaultMealType || 'Öğle')

  // Sync meal type when opened from a specific slot
  useEffect(() => {
    if (isOpen && defaultMealType) setMealType(defaultMealType)
  }, [isOpen, defaultMealType])

  // Load saved foods from localStorage each time modal opens
  useEffect(() => {
    if (!isOpen) return
    try {
      const raw = window.localStorage.getItem(SAVED_FOODS_KEY)
      setSavedFoods(raw ? JSON.parse(raw) : [])
    } catch { setSavedFoods([]) }
  }, [isOpen])
  const [mealLabel, setMealLabel] = useState('')
  const [basket,    setBasket]    = useState([])
  const [error,     setError]     = useState('')

  // Search sub-state
  const [query,   setQuery]   = useState('')
  const [selFood, setSelFood] = useState(null)
  const [selUnit, setSelUnit] = useState('')
  const [qty,     setQty]     = useState('1')

  // Manual sub-state
  const [mName, setMName] = useState('')
  const [mKcal, setMKcal] = useState('')
  const [mProt, setMProt] = useState('')
  const [mCarb, setMCarb] = useState('')
  const [mFat,  setMFat]  = useState('')
  const [mFib,  setMFib]  = useState('')
  const [mSug,  setMSug]  = useState('')

  // Barcode sub-state
  const [barcodeOpen,    setBarcodeOpen]    = useState(false)
  const [barcodeInput,   setBarcodeInput]   = useState('')
  const [barcodeLoading, setBarcodeLoading] = useState(false)
  const [barcodeError,   setBarcodeError]   = useState('')
  const [barcodeProduct, setBarcodeProduct] = useState(null)
  const [barcodeGrams,   setBarcodeGrams]   = useState('100')
  const [barcodeUnit,    setBarcodeUnit]    = useState('gram')

  // Unknown-product (not-found) inline form
  const [barcodeUnknown,  setBarcodeUnknown]  = useState(false)
  const [unknownName,     setUnknownName]     = useState('')
  const [unknownKcal100,  setUnknownKcal100]  = useState('')
  const [unknownProt100,  setUnknownProt100]  = useState('')
  const [unknownCarb100,  setUnknownCarb100]  = useState('')
  const [unknownFat100,   setUnknownFat100]   = useState('')
  const [unknownFib100,   setUnknownFib100]   = useState('')
  const [unknownSug100,   setUnknownSug100]   = useState('')
  const [unknownUnit,     setUnknownUnit]     = useState('gram')
  const [unknownGrams,    setUnknownGrams]    = useState('100')

  // Saved foods sub-state
  const [savedFoods,     setSavedFoods]     = useState([])
  const [saveNickname,   setSaveNickname]   = useState('')
  const [showSaveForm,   setShowSaveForm]   = useState(false)
  const [savedFoodGrams, setSavedFoodGrams] = useState({}) // { [foodId]: gramsString }

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? FOOD_DB.filter(f => f.name.toLowerCase().includes(q)) : FOOD_DB
  }, [query])

  const preview = useMemo(() => calcPreview(selFood, selUnit, qty), [selFood, selUnit, qty])

  const basketTotals = useMemo(() => ({
    kcal:    basket.reduce((s, i) => s + i.kcal,    0),
    protein: Math.round(basket.reduce((s, i) => s + i.protein,        0) * 10) / 10,
    carbs:   Math.round(basket.reduce((s, i) => s + i.carbs,          0) * 10) / 10,
    fat:     Math.round(basket.reduce((s, i) => s + i.fat,            0) * 10) / 10,
    fiber:   Math.round(basket.reduce((s, i) => s + (i.fiber || 0),   0) * 10) / 10,
    sugar:   Math.round(basket.reduce((s, i) => s + (i.sugar || 0),   0) * 10) / 10,
  }), [basket])

  const healthImpact = useMemo(() => checkHealthImpact(basket, profile),       [basket, profile])
  const alternatives = useMemo(() => getSuggestedAlternatives(basket, profile), [basket, profile])

  // ── Early return (after all hooks) ────────────────────────────────────────
  if (!isOpen) return null

  // ── Barcode API ────────────────────────────────────────────────────────────
  async function handleFetchBarcode() {
    const code = barcodeInput.trim()
    if (!code) { setBarcodeError('Barkod numarası giriniz.'); return }
    setBarcodeLoading(true)
    setBarcodeError('')
    setBarcodeProduct(null)
    setBarcodeUnknown(false)
    try {
      const data = await fetchOpenFoodFacts(code)
      if (data.status !== 1 || !data.product) {
        // Product not found → enter unknown-product manual mode
        setBarcodeUnknown(true)
        setUnknownName('')
        setUnknownKcal100(''); setUnknownProt100(''); setUnknownCarb100('')
        setUnknownFat100(''); setUnknownFib100(''); setUnknownSug100('')
        setUnknownUnit('gram'); setUnknownGrams('100')
        return
      }
      setBarcodeUnknown(false)
      const p = data.product
      const n = p.nutriments || {}
      const kcal100 = Math.round(
        n['energy-kcal_100g'] ??
        (n['energy-kj_100g'] ? n['energy-kj_100g'] / 4.184 : 0)
      )
      const productName = (p.product_name_tr || p.product_name || '').trim()
      setBarcodeProduct({
        name: productName || 'Bilinmeyen Ürün',
        kcal100,
        protein100: Math.round((n['proteins_100g']       || 0) * 10) / 10,
        carbs100:   Math.round((n['carbohydrates_100g']  || 0) * 10) / 10,
        fat100:     Math.round((n['fat_100g']            || 0) * 10) / 10,
        fiber100:   Math.round((n['fiber_100g']          || 0) * 10) / 10,
        sugar100:   Math.round((n['sugars_100g']         || 0) * 10) / 10,
      })
      // Auto-select first smart unit that has a gram preset (not "Gram")
      const smartUnits = deriveSmartServingUnits(productName)
      const firstPreset = smartUnits.find(u => u.grams !== null)
      if (firstPreset) { setBarcodeUnit(firstPreset.id); setBarcodeGrams(String(firstPreset.grams)) }
      else             { setBarcodeUnit('gram');          setBarcodeGrams('100') }
    } catch {
      setBarcodeError('Bağlantı hatası. İnternet bağlantınızı kontrol edin.')
    } finally {
      setBarcodeLoading(false)
    }
  }

  // ── Unknown-product basket add ─────────────────────────────────────────────
  function addUnknownToBasket() {
    if (!unknownName.trim())                       { setError('Ürün adı zorunludur.');            return }
    if (!unknownKcal100 || Number(unknownKcal100) <= 0) { setError('Kalori değeri zorunludur.'); return }
    const grams = Math.max(1, Number(unknownGrams) || 100)
    const r = grams / 100
    setBasket(prev => [...prev, {
      id:       crypto.randomUUID(),
      foodId:   null,
      foodName: unknownName.trim(),
      unit:     `${grams}g`,
      qty:      1,
      kcal:     Math.round(Number(unknownKcal100) * r),
      protein:  Math.round(Number(unknownProt100 || 0) * r * 10) / 10,
      carbs:    Math.round(Number(unknownCarb100 || 0) * r * 10) / 10,
      fat:      Math.round(Number(unknownFat100  || 0) * r * 10) / 10,
      fiber:    Math.round(Number(unknownFib100  || 0) * r * 10) / 10,
      sugar:    Math.round(Number(unknownSug100  || 0) * r * 10) / 10,
    }])
    setUnknownName(''); setUnknownKcal100(''); setUnknownProt100(''); setUnknownCarb100('')
    setUnknownFat100(''); setUnknownFib100(''); setUnknownSug100('')
    setUnknownUnit('gram'); setUnknownGrams('100')
    setBarcodeUnknown(false); setBarcodeOpen(false); setBarcodeInput('')
    setError('')
  }

  function addBarcodeToBasket() {
    if (!barcodeProduct) return
    const grams = Math.max(1, Number(barcodeGrams) || 100)
    const r = grams / 100
    setBasket(prev => [...prev, {
      id:       crypto.randomUUID(),
      foodId:   null,
      foodName: barcodeProduct.name,
      unit:     `${grams}g`,
      qty:      1,
      kcal:     Math.round(barcodeProduct.kcal100     * r),
      protein:  Math.round(barcodeProduct.protein100  * r * 10) / 10,
      carbs:    Math.round(barcodeProduct.carbs100    * r * 10) / 10,
      fat:      Math.round(barcodeProduct.fat100      * r * 10) / 10,
      fiber:    Math.round(barcodeProduct.fiber100    * r * 10) / 10,
      sugar:    Math.round(barcodeProduct.sugar100    * r * 10) / 10,
    }])
    setBarcodeOpen(false); setBarcodeInput(''); setBarcodeProduct(null)
    setBarcodeGrams('100'); setBarcodeUnit('gram'); setBarcodeError('')
    setShowSaveForm(false); setSaveNickname('')
  }

  // ── Saved foods ────────────────────────────────────────────────────────────
  function persistSavedFoods(foods) {
    try { window.localStorage.setItem(SAVED_FOODS_KEY, JSON.stringify(foods)) } catch {}
  }

  function handleSaveFavorite() {
    if (!barcodeProduct || !saveNickname.trim()) return
    const newFood = {
      id:           crypto.randomUUID(),
      nickname:     saveNickname.trim(),
      originalName: barcodeProduct.name,
      kcal100:      barcodeProduct.kcal100,
      protein100:   barcodeProduct.protein100,
      carbs100:     barcodeProduct.carbs100,
      fat100:       barcodeProduct.fat100,
      fiber100:     barcodeProduct.fiber100,
      sugar100:     barcodeProduct.sugar100,
      savedAt:      new Date().toISOString(),
    }
    setSavedFoods(prev => {
      const next = [...prev, newFood]
      persistSavedFoods(next)
      return next
    })
    setShowSaveForm(false)
    setSaveNickname('')
  }

  function deleteSavedFood(id) {
    setSavedFoods(prev => {
      const next = prev.filter(f => f.id !== id)
      persistSavedFoods(next)
      return next
    })
  }

  function addSavedFoodToBasket(food) {
    const grams = Math.max(1, Number(savedFoodGrams[food.id]) || 100)
    const r = grams / 100
    setBasket(prev => [...prev, {
      id:       crypto.randomUUID(),
      foodId:   null,
      foodName: food.nickname,
      unit:     `${grams}g`,
      qty:      1,
      kcal:     Math.round(food.kcal100     * r),
      protein:  Math.round(food.protein100  * r * 10) / 10,
      carbs:    Math.round(food.carbs100    * r * 10) / 10,
      fat:      Math.round(food.fat100      * r * 10) / 10,
      fiber:    Math.round(food.fiber100    * r * 10) / 10,
      sugar:    Math.round(food.sugar100    * r * 10) / 10,
    }])
  }

  // ── Basket actions ─────────────────────────────────────────────────────────
  function addToBasketFromSearch() {
    if (!selFood || !preview || preview.kcal <= 0) {
      setError('Geçerli bir miktar girin.')
      return
    }
    setBasket(prev => [...prev, {
      id:       crypto.randomUUID(),
      foodId:   selFood.id,
      foodName: selFood.name,
      unit:     selUnit,
      qty:      Number(qty),
      kcal:     preview.kcal,
      protein:  preview.protein,
      carbs:    preview.carbs,
      fat:      preview.fat,
      fiber:    0,
      sugar:    0,
    }])
    setSelFood(null); setSelUnit(''); setQuery(''); setQty('1'); setError('')
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
    setQuery(''); setSelFood(null); setSelUnit(''); setQty('1')
    setMName(''); setMKcal(''); setMProt(''); setMCarb(''); setMFat('')
    setMFib(''); setMSug(''); setError('')
    setBarcodeOpen(false); setBarcodeInput(''); setBarcodeLoading(false)
    setBarcodeError(''); setBarcodeProduct(null); setBarcodeGrams('100'); setBarcodeUnit('gram')
    setBarcodeUnknown(false)
    setUnknownName(''); setUnknownKcal100(''); setUnknownProt100(''); setUnknownCarb100('')
    setUnknownFat100(''); setUnknownFib100(''); setUnknownSug100('')
    setUnknownUnit('gram'); setUnknownGrams('100')
    setShowSaveForm(false); setSaveNickname(''); setSavedFoodGrams({})
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      onClick={e => { if (e.target === e.currentTarget) { resetAll(); onClose() } }}
      aria-modal="true" role="dialog"
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { resetAll(); onClose() }} />

      <div className="relative flex max-h-[94vh] w-full max-w-app flex-col rounded-t-3xl bg-white dark:bg-night-card shadow-2xl">

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
              onClick={() => { resetAll(); onClose() }}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-slate-100 dark:bg-night-muted text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-night-border"
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
          <div className="flex rounded-2xl bg-slate-100 dark:bg-night-muted p-1">
            {[
              { id: 'search', label: 'Gıda Ara' },
              { id: 'manual', label: 'Manuel'   },
              { id: 'saved',  label: '⭐ Kayıtlı' },
            ].map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => { setTab(id); setError('') }}
                className={`flex-1 cursor-pointer rounded-xl py-2 text-xs font-bold transition-all ${
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
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">

          {/* ═══ SEARCH TAB ═══ */}
          {tab === 'search' && (
            <>
              {/* Barkod header row: toggle button + manual input */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setBarcodeOpen(o => !o); setBarcodeError(''); setBarcodeProduct(null); setShowSaveForm(false) }}
                  className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed py-3 text-xs font-extrabold transition-all active:scale-[0.98] ${
                    barcodeOpen
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                      : 'border-emerald-300 dark:border-emerald-700/60 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/10 text-emerald-700 dark:text-emerald-400 hover:border-emerald-400'
                  }`}
                >
                  <span className="text-base leading-none">📷</span>
                  <span>Barkod Tara</span>
                </button>
                {/* Quick barcode text input always visible */}
                <div className="flex flex-1 items-center gap-1.5 rounded-2xl border-2 border-slate-200 dark:border-night-border bg-white dark:bg-night-card px-3 py-2.5 focus-within:border-emerald-400 transition-all">
                  <svg className="h-4 w-4 flex-shrink-0 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 17.25h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" />
                  </svg>
                  <input
                    type="text" inputMode="numeric"
                    value={barcodeInput}
                    onChange={e => { setBarcodeInput(e.target.value); setBarcodeError('') }}
                    onKeyDown={e => { if (e.key === 'Enter') { setBarcodeOpen(true); handleFetchBarcode() } }}
                    placeholder="Barkod no…"
                    className="min-w-0 flex-1 bg-transparent text-xs font-medium text-slate-800 dark:text-slate-100 outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600"
                  />
                  {barcodeInput && (
                    <button type="button" onClick={() => { setBarcodeOpen(true); handleFetchBarcode() }}
                      disabled={barcodeLoading}
                      className="flex-shrink-0 cursor-pointer rounded-lg bg-emerald-500 px-2 py-1 text-[9px] font-extrabold text-white hover:bg-emerald-600 disabled:opacity-60">
                      {barcodeLoading ? '…' : 'Git'}
                    </button>
                  )}
                </div>
              </div>

              {/* Barcode expanded panel */}
              {barcodeOpen && (
                <div className="rounded-2xl border border-slate-200 dark:border-night-border bg-slate-50 dark:bg-night-muted p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Barkod Sorgulama</p>
                    <span className="rounded-full bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 text-[9px] font-extrabold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">
                      OpenFoodFacts
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <input type="text" inputMode="numeric"
                      value={barcodeInput}
                      onChange={e => { setBarcodeInput(e.target.value); setBarcodeError('') }}
                      onKeyDown={e => e.key === 'Enter' && handleFetchBarcode()}
                      placeholder="örn. 8690526430031"
                      className="flex-1 rounded-xl border border-slate-200 dark:border-night-border bg-white dark:bg-night-card px-3 py-2.5 text-sm font-medium text-slate-800 dark:text-slate-100 outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-night-muted focus:border-emerald-400" />
                    <button type="button" onClick={handleFetchBarcode} disabled={barcodeLoading}
                      className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-extrabold text-white transition-all hover:bg-emerald-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60">
                      {barcodeLoading
                        ? <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                        : 'Sorgula'}
                    </button>
                  </div>

                  {/* Connection / validation error */}
                  {barcodeError && !barcodeUnknown && (
                    <p className="flex items-center gap-2 rounded-xl bg-red-50 dark:bg-red-900/20 px-3 py-2 text-xs font-semibold text-red-600 dark:text-red-400">
                      <span>❌</span> {barcodeError}
                    </p>
                  )}

                  {/* ── Unknown product — inline manual entry form ── */}
                  {barcodeUnknown && (
                    <div className="rounded-xl border-2 border-dashed border-amber-300 dark:border-amber-700/70 bg-amber-50 dark:bg-amber-900/10 p-3 space-y-3">

                      {/* Header */}
                      <div className="flex items-center gap-2">
                        <span className="text-lg leading-none">❓</span>
                        <div>
                          <p className="text-sm font-extrabold text-amber-800 dark:text-amber-300">Bilinmeyen Ürün — Manuel Ekle</p>
                          <p className="text-[10px] text-amber-600 dark:text-amber-500">Barkod veritabanında bulunamadı. Bilgileri kendiniz girin.</p>
                        </div>
                      </div>

                      {/* Nickname input — drives smart serving units */}
                      <input
                        type="text"
                        value={unknownName}
                        onChange={e => { setUnknownName(e.target.value); setError('') }}
                        placeholder="Ürün / Takma ad (örn. Kırmızı şekersiz çikolata)"
                        className="w-full rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-night-card px-3 py-2.5 text-sm font-medium text-slate-800 dark:text-slate-100 outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:border-amber-500"
                      />

                      {/* Per-100g macro inputs */}
                      <div>
                        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400">Değerler 100g Başına</p>
                        <div className="grid grid-cols-3 gap-1.5">
                          {[
                            { val: unknownKcal100, set: setUnknownKcal100, label: 'Kalori *', color: 'text-emerald-600 dark:text-emerald-400', focus: 'focus-within:border-emerald-400' },
                            { val: unknownProt100, set: setUnknownProt100, label: 'Protein',  color: 'text-indigo-600 dark:text-indigo-400',  focus: 'focus-within:border-indigo-400'  },
                            { val: unknownCarb100, set: setUnknownCarb100, label: 'Karb',     color: 'text-amber-600 dark:text-amber-400',    focus: 'focus-within:border-amber-400'   },
                            { val: unknownFat100,  set: setUnknownFat100,  label: 'Yağ',      color: 'text-rose-500 dark:text-rose-400',      focus: 'focus-within:border-rose-400'    },
                            { val: unknownFib100,  set: setUnknownFib100,  label: 'Lif',      color: 'text-teal-600 dark:text-teal-400',      focus: 'focus-within:border-teal-400'    },
                            { val: unknownSug100,  set: setUnknownSug100,  label: 'Şeker',    color: 'text-pink-600 dark:text-pink-400',      focus: 'focus-within:border-pink-400'    },
                          ].map(({ val, set, label, color, focus }) => (
                            <div key={label} className={`rounded-xl border-2 border-slate-200 dark:border-night-border bg-white dark:bg-night-card px-2 py-2 text-center transition-all ${focus}`}>
                              <label className={`block text-[9px] font-bold ${color}`}>{label}</label>
                              <input
                                type="number" inputMode="decimal" min="0"
                                value={val}
                                onChange={e => { set(e.target.value); setError('') }}
                                placeholder="0"
                                className="mt-0.5 w-full bg-transparent text-center text-base font-extrabold text-slate-800 dark:text-slate-100 outline-none placeholder:text-slate-200 dark:placeholder:text-night-muted"
                              />
                              <span className="text-[9px] text-slate-400">{label === 'Kalori *' ? 'kcal' : 'g'}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Smart serving units derived from typed name */}
                      <div>
                        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Porsiyon Büyüklüğü</p>
                        <div className="flex flex-wrap gap-1 mb-2">
                          {deriveSmartServingUnits(unknownName).map(u => (
                            <button key={u.id} type="button"
                              onClick={() => {
                                setUnknownUnit(u.id)
                                if (u.grams) setUnknownGrams(String(u.grams))
                              }}
                              className={`cursor-pointer rounded-lg px-2.5 py-1 text-[10px] font-bold transition-all ${
                                unknownUnit === u.id
                                  ? 'bg-amber-500 text-white shadow-sm'
                                  : 'bg-white dark:bg-night-border text-slate-600 dark:text-slate-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 border border-amber-200 dark:border-amber-800'
                              }`}>
                              {u.label}
                            </button>
                          ))}
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number" inputMode="numeric" min="1"
                            value={unknownGrams}
                            onChange={e => { setUnknownGrams(e.target.value); setUnknownUnit('gram') }}
                            className="w-20 rounded-xl border border-slate-200 dark:border-night-border bg-white dark:bg-night-card px-3 py-2 text-sm font-bold text-slate-800 dark:text-slate-100 outline-none text-center focus:border-amber-400"
                          />
                          <span className="text-xs text-slate-400 dark:text-slate-500">gram</span>
                          <button type="button" onClick={addUnknownToBasket}
                            className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-amber-500 py-2 text-xs font-extrabold text-white transition-all hover:bg-amber-600 active:scale-95">
                            <PlusIcon />
                            Sepete Ekle
                            {unknownKcal100 && Number(unknownKcal100) > 0
                              ? ` · ${Math.round(Number(unknownKcal100) * (Math.max(1, Number(unknownGrams) || 100) / 100))} kcal`
                              : ''}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {barcodeProduct && (
                    <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-night-card p-3 space-y-3">
                      {/* Product header */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-extrabold text-slate-900 dark:text-slate-100 leading-tight">{barcodeProduct.name}</p>
                          <p className="mt-0.5 text-[10px] font-semibold text-slate-400 dark:text-slate-500">100g başına değerler</p>
                        </div>
                        <span className="flex-shrink-0 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 px-2 py-1 text-xs font-extrabold text-emerald-700 dark:text-emerald-400">
                          {barcodeProduct.kcal100} kcal
                        </span>
                      </div>

                      {/* Macro chips */}
                      <div className="grid grid-cols-5 gap-1 text-center">
                        {[
                          { label: 'Protein', val: barcodeProduct.protein100, color: 'text-indigo-600 dark:text-indigo-400' },
                          { label: 'Karb',    val: barcodeProduct.carbs100,   color: 'text-amber-600 dark:text-amber-400'  },
                          { label: 'Yağ',     val: barcodeProduct.fat100,     color: 'text-rose-500 dark:text-rose-400'    },
                          { label: 'Lif',     val: barcodeProduct.fiber100,   color: 'text-teal-600 dark:text-teal-400'    },
                          { label: 'Şeker',   val: barcodeProduct.sugar100,   color: 'text-pink-600 dark:text-pink-400'    },
                        ].map(({ label, val, color }) => (
                          <div key={label} className="rounded-lg bg-slate-50 dark:bg-night-muted px-1 py-1.5">
                            <p className={`text-[9px] font-bold ${color}`}>{label}</p>
                            <p className="text-[10px] font-extrabold text-slate-800 dark:text-slate-100">{val}g</p>
                          </div>
                        ))}
                      </div>

                      {/* Serving unit selector — smart units derived from product name */}
                      <div>
                        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Porsiyon Büyüklüğü</p>
                        <div className="flex flex-wrap gap-1 mb-2">
                          {deriveSmartServingUnits(barcodeProduct.name).map(u => (
                            <button key={u.id} type="button"
                              onClick={() => {
                                setBarcodeUnit(u.id)
                                if (u.grams) setBarcodeGrams(String(u.grams))
                              }}
                              className={`cursor-pointer rounded-lg px-2.5 py-1 text-[10px] font-bold transition-all ${
                                barcodeUnit === u.id
                                  ? 'bg-emerald-500 text-white shadow-sm'
                                  : 'bg-slate-100 dark:bg-night-border text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                              }`}>
                              {u.label}
                            </button>
                          ))}
                        </div>
                        <div className="flex items-center gap-2">
                          <input type="number" inputMode="numeric" min="1"
                            value={barcodeGrams}
                            onChange={e => { setBarcodeGrams(e.target.value); setBarcodeUnit('gram') }}
                            className="w-20 rounded-xl border border-slate-200 dark:border-night-border bg-white dark:bg-night-card px-3 py-2 text-sm font-bold text-slate-800 dark:text-slate-100 outline-none text-center focus:border-emerald-400" />
                          <span className="text-xs text-slate-400 dark:text-slate-500">gram</span>
                          <button type="button" onClick={addBarcodeToBasket}
                            className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-emerald-500 py-2 text-xs font-extrabold text-white transition-all hover:bg-emerald-600 active:scale-95">
                            <PlusIcon />
                            Sepete Ekle · {Math.round(barcodeProduct.kcal100 * (Math.max(1, Number(barcodeGrams) || 100) / 100))} kcal
                          </button>
                        </div>
                      </div>

                      {/* Save to favorites */}
                      <div className="border-t border-slate-100 dark:border-night-border pt-2.5">
                        {!showSaveForm ? (
                          <button type="button"
                            onClick={() => { setShowSaveForm(true); setSaveNickname(barcodeProduct.name) }}
                            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-900/10 py-2 text-xs font-bold text-amber-700 dark:text-amber-400 transition-all hover:bg-amber-100 dark:hover:bg-amber-900/20">
                            <span>⭐</span> Favorilere Kaydet
                          </button>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">Takma Ad Girin</p>
                            <div className="flex gap-2">
                              <input type="text" value={saveNickname}
                                onChange={e => setSaveNickname(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSaveFavorite()}
                                placeholder="örn. Kırmızı şekersiz çikolata"
                                className="flex-1 rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-night-card px-3 py-2 text-xs font-medium text-slate-800 dark:text-slate-100 outline-none focus:border-amber-500" />
                              <button type="button" onClick={handleSaveFavorite}
                                className="cursor-pointer rounded-xl bg-amber-500 px-3 py-2 text-xs font-extrabold text-white hover:bg-amber-600 transition-colors">
                                ⭐
                              </button>
                              <button type="button" onClick={() => setShowSaveForm(false)}
                                className="cursor-pointer rounded-xl bg-slate-100 dark:bg-night-muted px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-200 transition-colors">
                                İptal
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-slate-100 dark:bg-night-border" />
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">veya ara</span>
                <div className="h-px flex-1 bg-slate-100 dark:bg-night-border" />
              </div>

              <SearchBar
                query={query}       setQuery={setQuery}
                selFood={selFood}   setSelFood={setSelFood}
                selUnit={selUnit}   setSelUnit={setSelUnit}
                qty={qty}           setQty={setQty}
                results={results}   preview={preview}
                onAddToBasket={addToBasketFromSearch}
                setError={setError}
              />
            </>
          )}

          {/* ═══ SAVED FOODS TAB ═══ */}
          {tab === 'saved' && (
            <div className="space-y-3">
              {savedFoods.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                  <span className="text-4xl">⭐</span>
                  <p className="text-sm font-bold text-slate-600 dark:text-slate-400">Henüz kayıtlı yemek yok</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed max-w-xs">
                    Barkod taradıktan sonra ürün kartındaki "Favorilere Kaydet" butonuyla buraya ekleyebilirsiniz.
                  </p>
                </div>
              ) : savedFoods.map(food => (
                <div key={food.id} className="rounded-2xl border border-slate-100 dark:border-night-border bg-white dark:bg-night-card p-3 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-extrabold text-slate-900 dark:text-slate-100">{food.nickname}</p>
                      {food.originalName && food.originalName !== food.nickname && (
                        <p className="mt-0.5 truncate text-[10px] text-slate-400 dark:text-slate-500">{food.originalName}</p>
                      )}
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-1.5">
                      <span className="rounded-lg bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700 dark:text-emerald-400">
                        {food.kcal100} kcal/100g
                      </span>
                      <button type="button" onClick={() => deleteSavedFood(food.id)}
                        className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-lg text-slate-300 dark:text-night-muted hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-400 transition-colors"
                        aria-label="Sil">
                        <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-1 text-center">
                    {[
                      { label: 'P', val: food.protein100, color: 'text-indigo-500' },
                      { label: 'K', val: food.carbs100,   color: 'text-amber-500'  },
                      { label: 'Y', val: food.fat100,     color: 'text-rose-400'   },
                      { label: 'L', val: food.fiber100,   color: 'text-teal-500'   },
                      { label: 'Ş', val: food.sugar100,   color: 'text-pink-500'   },
                    ].map(({ label, val, color }) => (
                      <div key={label} className="flex-1 rounded-lg bg-slate-50 dark:bg-night-muted px-1 py-1">
                        <p className={`text-[9px] font-extrabold ${color}`}>{label}</p>
                        <p className="text-[9px] font-bold text-slate-700 dark:text-slate-300">{val}g</p>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Smart serving unit quick-select based on food nickname */}
                    <div className="flex gap-1">
                      {deriveSmartServingUnits(food.nickname).filter(u => u.grams !== null).map(u => (
                        <button key={u.id} type="button"
                          onClick={() => setSavedFoodGrams(prev => ({ ...prev, [food.id]: String(u.grams) }))}
                          className="cursor-pointer rounded-lg bg-slate-100 dark:bg-night-muted px-2 py-1 text-[9px] font-bold text-slate-600 dark:text-slate-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 hover:text-emerald-700 transition-colors">
                          {u.label}
                        </button>
                      ))}
                    </div>
                    <input type="number" inputMode="numeric" min="1"
                      value={savedFoodGrams[food.id] ?? '100'}
                      onChange={e => setSavedFoodGrams(prev => ({ ...prev, [food.id]: e.target.value }))}
                      className="w-14 rounded-xl border border-slate-200 dark:border-night-border bg-white dark:bg-night-card px-2 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none text-center focus:border-emerald-400" />
                    <span className="text-[10px] text-slate-400">g</span>
                    <button type="button" onClick={() => addSavedFoodToBasket(food)}
                      className="flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-xl bg-emerald-500 py-2 text-xs font-extrabold text-white transition-all hover:bg-emerald-600 active:scale-95">
                      <PlusIcon />
                      {Math.round(food.kcal100 * (Math.max(1, Number(savedFoodGrams[food.id] ?? 100)) / 100))} kcal
                    </button>
                  </div>
                </div>
              ))}
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

          {/* Basket preview */}
          <BasketItem basket={basket} totals={basketTotals} onRemove={removeFromBasket} />

          {/* Health impact */}
          {basket.length > 0 && (
            <MacroSummary impact={healthImpact} alternatives={alternatives} />
          )}
        </div>

        {/* ── FIXED FOOTER ── */}
        <div className="flex-shrink-0 px-5 pb-8 pt-3 space-y-2 border-t border-slate-100 dark:border-night-border bg-white dark:bg-night-card">

          {error && (
            <p className={`rounded-xl px-3 py-2 text-xs font-semibold ${
              error.startsWith('✓')
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
    </div>
  )
}
