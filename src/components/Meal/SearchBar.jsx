import { CloseIcon, PlusIcon } from './MealIcons'
import { unitNeedsGramInput } from './foodData'
import { getServingPreview } from '../../utils/foodDatabase.js'
import { getDisplayUnits } from '../../services/foodService'

export default function SearchBar({
  query, setQuery,
  selFood, setSelFood,
  selUnit, setSelUnit,
  qty, setQty,
  gramsPerUnit, setGramsPerUnit,
  portionLoading = false,
  portionAiHint = false,
  onPortionEstimate,
  results, preview,
  searchLoading = false,
  onAddToBasket,
  setError,
}) {
  function applyUnitDefaults(food, unit) {
    setSelUnit(unit)
    if (unit === 'Gram' || unit === 'Mililitre') {
      setQty('100')
      setGramsPerUnit('')
    } else {
      setQty('1')
      const mult = food.units?.[unit]
      setGramsPerUnit(mult != null ? String(Math.round(mult * 100)) : '')
    }
    setError('')
    if (onPortionEstimate && food && unit !== 'Gram' && unit !== 'Mililitre' && food.units?.[unit] == null) {
      onPortionEstimate(food.name, unit)
    }
  }

  function selectFood(food) {
    setSelFood(food)
    const firstUnit = Object.keys(food.units)[0]
    applyUnitDefaults(food, firstUnit)
  }

  function selectUnit(u) {
    if (!selFood) return
    applyUnitDefaults(selFood, u)
  }

  const selServing = selFood ? getServingPreview(selFood) : null

  return (
    <div className={selFood ? '' : 'flex min-h-0 flex-1 flex-col gap-3'}>
      {selFood ? (
        <div className="rounded-2xl border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 p-3">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">Seçilen Gıda</p>
              <p className="text-sm font-extrabold text-slate-900 dark:text-slate-100">{selFood.name}</p>
              {selServing && (
                <p className="text-[10px] text-emerald-700 dark:text-emerald-400">
                  1 {selServing.unit}: {selServing.kcal} kcal · P:{selServing.protein}g K:{selServing.carbs}g Y:{selServing.fat}g
                  {selServing.grams > 0 && (
                    <span className="text-emerald-400 dark:text-emerald-600"> · ≈{selServing.grams}g</span>
                  )}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => { setSelFood(null); setSelUnit(''); setGramsPerUnit(''); setError('') }}
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-emerald-200 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-300 dark:hover:bg-emerald-900/60">
              <CloseIcon />
            </button>
          </div>

          {/* Unit pills */}
          <div className="mb-2 flex flex-wrap gap-1.5">
            {Object.keys(selFood.units).map(u => (
              <button key={u} type="button" onClick={() => selectUnit(u)}
                className={`cursor-pointer rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                  selUnit === u
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'bg-white dark:bg-night-card text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-night-border hover:border-emerald-300'
                }`}>
                {u}
              </button>
            ))}
          </div>

          {/* Custom gram weight only when no built-in multiplier */}
          {unitNeedsGramInput(selUnit, selFood) && (
            <div className="mb-2">
              <label className="mb-1 block text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                1 {selUnit} kaç gram? *
              </label>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <input
                    type="text" inputMode="decimal"
                    disabled={portionLoading}
                    value={portionLoading ? '' : (gramsPerUnit ?? '')}
                    onChange={e => { setGramsPerUnit(e.target.value); setError('') }}
                    placeholder={portionLoading ? 'YZ Hesaplanıyor...' : 'örn. 30'}
                    className="w-24 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-night-card px-3 py-2 text-sm font-bold text-slate-800 dark:text-slate-100 outline-none text-center focus:border-emerald-500 disabled:opacity-70 disabled:cursor-wait dark:disabled:bg-night-muted"
                  />
                  {portionLoading && (
                    <svg className="absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-emerald-500" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  )}
                </div>
                <span className="text-xs text-slate-400 dark:text-slate-500">gram</span>
              </div>
              {portionAiHint && !portionLoading && (
                <p className="mt-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                  ✨ YZ ile otomatik hesaplandı
                </p>
              )}
            </div>
          )}

          {/* Quantity input */}
          <div className="flex items-center gap-3 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-night-card px-3 py-2">
            <input
              type="text" inputMode="decimal"
              value={qty}
              onChange={e => { setQty(e.target.value); setError('') }}
              className="w-20 bg-transparent text-xl font-extrabold text-slate-900 dark:text-slate-100 outline-none"
            />
            <span className="text-sm text-slate-500 dark:text-slate-400">{selUnit}</span>
            {preview && preview.grams > 0 && (
              <span className="ml-auto text-[10px] text-slate-400 dark:text-slate-500">≈ {preview.grams}g</span>
            )}
          </div>

          {/* Live preview */}
          {preview && preview.kcal > 0 && (
            <div className="mt-2 flex items-center justify-between rounded-xl bg-white dark:bg-night-card px-3 py-2 shadow-sm">
              <span className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
                {preview.kcal}
                <span className="ml-1 text-sm font-medium text-slate-400 dark:text-slate-500">kcal</span>
              </span>
              <div className="flex gap-3 text-[10px]">
                <span className="font-bold text-indigo-600 dark:text-indigo-400">{preview.protein}g P</span>
                <span className="font-bold text-amber-600 dark:text-amber-400">{preview.carbs}g K</span>
                <span className="font-bold text-rose-500 dark:text-rose-400">{preview.fat}g Y</span>
              </div>
            </div>
          )}

          <button
            type="button" onClick={onAddToBasket}
            className="mt-2 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-emerald-500 py-2.5 text-xs font-extrabold text-white shadow-sm transition-all hover:bg-emerald-600 active:scale-95">
            <PlusIcon /> Sepete Ekle
          </button>
        </div>
      ) : (
        <>
          <div className="relative">
            <svg className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
            </svg>
            <input
              type="text" value={query}
              onChange={e => { setQuery(e.target.value); setError('') }}
              placeholder="Gıda ara… (örn. Köfte, Yumurta)"
              className="w-full rounded-2xl border-2 border-slate-200 dark:border-night-border bg-white dark:bg-night-card py-3 pl-10 pr-4 text-sm font-medium text-slate-900 dark:text-slate-100 outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:border-emerald-500"
            />
          </div>

          <div className="max-h-[min(320px,45vh)] min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain pr-0.5">
            {!searchLoading && results.length === 0 && query.trim() && (
              <p className="py-4 text-center text-xs font-medium text-slate-400 dark:text-slate-500">
                Sonuç bulunamadı
              </p>
            )}
            {!searchLoading && results.map(food => {
              const serving = getServingPreview(food)
              const displayUnits = getDisplayUnits(food, 2)
              const hasUsefulPortion = serving.unit !== 'Gram' && serving.unit !== 'Mililitre'

              return (
                <button
                  key={food.id} type="button" onClick={() => selectFood(food)}
                  className="flex w-full cursor-pointer items-center rounded-2xl border border-slate-100 dark:border-night-border bg-white dark:bg-night-card px-4 py-2.5 text-left shadow-sm transition-all hover:border-emerald-200 dark:hover:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 active:scale-[0.98]">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">{food.name}</p>
                    <p className="mt-0.5 truncate text-[10px] leading-snug text-slate-400 dark:text-slate-500">
                      {hasUsefulPortion && (
                        <span className="text-slate-500 dark:text-slate-400">
                          {serving.unit}
                          {serving.grams > 0 && ` · ≈${serving.grams}g`}
                          {' · '}
                        </span>
                      )}
                      <span className="font-semibold text-slate-600 dark:text-slate-300">{serving.kcal} kcal</span>
                      {' · '}
                      P:{serving.protein}g K:{serving.carbs}g Y:{serving.fat}g
                    </p>
                    {displayUnits.length > 0 && (
                      <div className="mt-1 flex gap-1 overflow-hidden">
                        {displayUnits.map(u => (
                          <span
                            key={u}
                            className="shrink-0 rounded-full bg-slate-100 dark:bg-night-muted px-2 py-0.5 text-[9px] font-semibold text-slate-500 dark:text-slate-400"
                          >
                            {u}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
