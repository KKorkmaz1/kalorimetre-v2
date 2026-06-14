import { useState, useMemo } from 'react'
import { useDiet } from '../context/DietContext'
import { FOOD_DB, MEAL_TYPES, checkHealthImpact, getSuggestedAlternatives, calcPreview } from './Meal/foodData'
import { TrashIcon, PlusIcon, CloseIcon } from './Meal/MealIcons'
import SearchBar from './Meal/SearchBar'
import BasketItem from './Meal/BasketItem'
import MacroSummary from './Meal/MacroSummary'

export default function AddMealModal({ isOpen, onClose }) {
  const { addLog, saveRecipe, deleteRecipe, recipes, profile } = useDiet()

  // ── ALL hooks before early return ─────────────────────────────────────────
  const [tab,       setTab]       = useState('search')  // 'search' | 'manual' | 'recipes'
  const [mealType,  setMealType]  = useState('Öğle')
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

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? FOOD_DB.filter(f => f.name.toLowerCase().includes(q)) : FOOD_DB
  }, [query])

  const preview = useMemo(() => calcPreview(selFood, selUnit, qty), [selFood, selUnit, qty])

  const basketTotals = useMemo(() => ({
    kcal:    basket.reduce((s, i) => s + i.kcal,    0),
    protein: Math.round(basket.reduce((s, i) => s + i.protein, 0) * 10) / 10,
    carbs:   Math.round(basket.reduce((s, i) => s + i.carbs,   0) * 10) / 10,
    fat:     Math.round(basket.reduce((s, i) => s + i.fat,     0) * 10) / 10,
  }), [basket])

  const healthImpact   = useMemo(() => checkHealthImpact(basket, profile),       [basket, profile])
  const alternatives   = useMemo(() => getSuggestedAlternatives(basket),          [basket])

  // ── Early return (after all hooks) ────────────────────────────────────────
  if (!isOpen) return null

  // ── Basket actions ────────────────────────────────────────────────────────

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
    }])
    setSelFood(null); setSelUnit(''); setQuery(''); setQty('1'); setError('')
  }

  function addToBasketManual() {
    if (!mName.trim())                  { setError('Yemek adı zorunludur.');            return }
    if (!mKcal || Number(mKcal) <= 0)  { setError('Geçerli bir kalori değeri girin.'); return }
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
    }])
    setMName(''); setMKcal(''); setMProt(''); setMCarb(''); setMFat(''); setError('')
  }

  function removeFromBasket(id) {
    setBasket(prev => prev.filter(i => i.id !== id))
  }

  function addRecipeToBasket(recipe) {
    const items = recipe.items.map(i => ({ ...i, id: crypto.randomUUID() }))
    setBasket(prev => [...prev, ...items])
    setMealType(recipe.mealType ?? 'Öğle')
    setMealLabel(recipe.name ?? '')
    setTab('search')
  }

  function handleSaveRecipe() {
    if (basket.length === 0) { setError('Sepete en az bir ürün ekleyin.'); return }
    const name = mealLabel.trim() || `${mealType} Tarifi`
    saveRecipe({
      name, mealType,
      items:        basket,
      totalKcal:    basketTotals.kcal,
      totalProtein: basketTotals.protein,
      totalCarbs:   basketTotals.carbs,
      totalFat:     basketTotals.fat,
    })
    setError('✓ Tarif kaydedildi!')
    setTimeout(() => setError(''), 2000)
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
      items:   basket.map(i => ({
        foodName: i.foodName, unit: i.unit, qty: i.qty,
        kcal: i.kcal, protein: i.protein, carbs: i.carbs, fat: i.fat,
      })),
    })
    resetAll()
    onClose()
  }

  function resetAll() {
    setBasket([]); setMealLabel(''); setMealType('Öğle'); setTab('search')
    setQuery(''); setSelFood(null); setSelUnit(''); setQty('1')
    setMName(''); setMKcal(''); setMProt(''); setMCarb(''); setMFat('')
    setError('')
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
          <div className="mb-3 flex justify-center">
            <div className="h-1 w-10 rounded-full bg-slate-200 dark:bg-night-muted" />
          </div>

          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-slate-100">Öğün Ekle</h2>
            <button type="button" onClick={() => { resetAll(); onClose() }}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-slate-100 dark:bg-night-muted text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-night-border">
              <CloseIcon />
            </button>
          </div>

          {/* Meal type chips */}
          <div className="mb-3 grid grid-cols-4 gap-1.5">
            {MEAL_TYPES.map(t => (
              <button key={t} type="button" onClick={() => setMealType(t)}
                className={`cursor-pointer rounded-xl py-1.5 text-xs font-bold transition-all ${
                  mealType === t
                    ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30'
                    : 'bg-slate-100 dark:bg-night-muted text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-night-border'
                }`}>
                {t}
              </button>
            ))}
          </div>

          {/* Optional custom label */}
          <input
            type="text" value={mealLabel}
            onChange={e => setMealLabel(e.target.value)}
            placeholder="Öğün Adı Etiketi (opsiyonel, örn. Spor Öncesi)"
            className="mb-3 w-full rounded-xl border border-slate-200 dark:border-night-border bg-white dark:bg-night-card px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:border-emerald-400"
          />

          {/* Tab bar */}
          <div className="flex rounded-2xl bg-slate-100 dark:bg-night-muted p-1">
            {[
              { id: 'search',  label: 'Gıda Ara'   },
              { id: 'manual',  label: 'Manuel'      },
              { id: 'recipes', label: `Tariflerim${recipes.length > 0 ? ` (${recipes.length})` : ''}` },
            ].map(({ id, label }) => (
              <button key={id} type="button" onClick={() => { setTab(id); setError('') }}
                className={`flex-1 cursor-pointer rounded-xl py-2 text-xs font-bold transition-all ${
                  tab === id
                    ? 'bg-white dark:bg-night-card text-slate-900 dark:text-slate-100 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── SCROLLABLE CONTENT ── */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">

          {/* ═══ SEARCH TAB ═══ */}
          {tab === 'search' && (
            <SearchBar
              query={query}       setQuery={setQuery}
              selFood={selFood}   setSelFood={setSelFood}
              selUnit={selUnit}   setSelUnit={setSelUnit}
              qty={qty}           setQty={setQty}
              results={results}   preview={preview}
              onAddToBasket={addToBasketFromSearch}
              setError={setError}
            />
          )}

          {/* ═══ MANUAL TAB ═══ */}
          {tab === 'manual' && (
            <div className="space-y-3">
              <input type="text" value={mName} onChange={e => { setMName(e.target.value); setError('') }}
                placeholder="Yemek adı (örn. Ev çorbası)"
                className="w-full rounded-2xl border-2 border-slate-200 dark:border-night-border bg-white dark:bg-night-card px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100 outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:border-emerald-500" />

              <div className={`rounded-2xl border-2 px-4 py-3 transition-all ${mKcal ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'border-slate-200 dark:border-night-border bg-white dark:bg-night-card'}`}>
                <label className="block text-xs font-bold text-emerald-600 dark:text-emerald-400">Kalori *</label>
                <div className="flex items-baseline gap-2">
                  <input type="number" inputMode="numeric" min="1" value={mKcal}
                    onChange={e => { setMKcal(e.target.value); setError('') }}
                    placeholder="0"
                    className="w-full bg-transparent text-3xl font-extrabold text-slate-900 dark:text-slate-100 outline-none placeholder:text-slate-200 dark:placeholder:text-night-muted" />
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
                  ].map(({ val, set, label, color, focus }) => (
                    <div key={label} className={`rounded-2xl border-2 border-slate-200 dark:border-night-border bg-white dark:bg-night-card px-3 py-3 text-center transition-all ${focus}`}>
                      <label className={`block text-[10px] font-bold ${color}`}>{label}</label>
                      <input type="number" inputMode="decimal" min="0"
                        value={val} onChange={e => { set(e.target.value); setError('') }}
                        placeholder="0"
                        className="mt-1 w-full bg-transparent text-center text-xl font-extrabold text-slate-800 dark:text-slate-100 outline-none placeholder:text-slate-200 dark:placeholder:text-night-muted" />
                      <span className="text-xs text-slate-400 dark:text-slate-500">g</span>
                    </div>
                  ))}
                </div>
              </div>

              <button type="button" onClick={addToBasketManual}
                className="flex w-full items-center justify-center gap-1.5 rounded-2xl border-2 border-emerald-500 py-3 text-sm font-bold text-emerald-600 transition-all hover:bg-emerald-50 active:scale-95">
                <PlusIcon /> Sepete Ekle
              </button>
            </div>
          )}

          {/* ═══ RECIPES TAB ═══ */}
          {tab === 'recipes' && (
            <div className="space-y-2">
              {recipes.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 dark:border-night-border py-8 text-center">
                  <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">Henüz kayıtlı tarifin yok</p>
                  <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                    Sepet oluşturduktan sonra "Tarif Kaydet" butonunu kullan
                  </p>
                </div>
              ) : (
                recipes.map(recipe => (
                  <div key={recipe.id} className="flex items-center gap-3 rounded-2xl border border-slate-100 dark:border-night-border bg-white dark:bg-night-card px-4 py-3 shadow-sm">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{recipe.name}</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500">
                        {recipe.items?.length ?? 0} ürün · {recipe.totalKcal} kcal
                        {' · '}P:{recipe.totalProtein}g K:{recipe.totalCarbs}g Y:{recipe.totalFat}g
                      </p>
                    </div>
                    <button type="button" onClick={() => addRecipeToBasket(recipe)}
                      className="cursor-pointer rounded-xl bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors">
                      Ekle
                    </button>
                    <button type="button" onClick={() => deleteRecipe(recipe.id)}
                      className="cursor-pointer text-slate-300 dark:text-slate-600 hover:text-red-400 transition-colors">
                      <TrashIcon />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Basket preview + health impact */}
          <BasketItem basket={basket} totals={basketTotals} onRemove={removeFromBasket} />

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

          {basket.length > 0 && (
            <button type="button" onClick={handleSaveRecipe}
              className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-2xl border-2 border-slate-200 dark:border-night-border py-3 text-xs font-bold text-slate-600 dark:text-slate-400 transition-all hover:border-emerald-300 dark:hover:border-emerald-700 hover:text-emerald-600 dark:hover:text-emerald-400 active:scale-95">
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z" />
                <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25 1.25v-2.5z" />
              </svg>
              Bu Öğünü Tarif Olarak Kaydet
            </button>
          )}

          <button type="button" onClick={handleSave}
            className={`flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-extrabold text-white shadow-xl transition-all active:scale-95 ${
              basket.length > 0
                ? 'bg-emerald-500 shadow-emerald-200 hover:bg-emerald-600'
                : 'cursor-not-allowed bg-slate-200 text-slate-400 shadow-none'
            }`}>
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
