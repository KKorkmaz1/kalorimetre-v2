import { CloseIcon, PlusIcon } from './MealIcons'

export default function SearchBar({
  query, setQuery,
  selFood, setSelFood,
  selUnit, setSelUnit,
  qty, setQty,
  results, preview,
  onAddToBasket,
  setError,
}) {
  function selectFood(food) {
    setSelFood(food)
    setSelUnit(Object.keys(food.units)[0])
    setQty('1')
    setError('')
  }

  return (
    <>
      {selFood ? (
        <div className="rounded-2xl border-2 border-emerald-500 bg-emerald-50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-600">Seçilen Gıda</p>
              <p className="text-sm font-extrabold text-slate-900">{selFood.name}</p>
              <p className="text-[10px] text-emerald-700">
                {selFood.calories} kcal · P:{selFood.protein}g K:{selFood.carbs}g Y:{selFood.fat}g <span className="text-emerald-400">/ 100g</span>
              </p>
            </div>
            <button type="button" onClick={() => { setSelFood(null); setSelUnit(''); setError('') }}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-200 text-emerald-700 hover:bg-emerald-300">
              <CloseIcon />
            </button>
          </div>

          {/* Unit pills */}
          <div className="mb-2 flex flex-wrap gap-1.5">
            {Object.keys(selFood.units).map(u => (
              <button key={u} type="button" onClick={() => { setSelUnit(u); setError('') }}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                  selUnit === u ? 'bg-emerald-500 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:border-emerald-300'
                }`}>
                {u}
              </button>
            ))}
          </div>

          {/* Quantity input */}
          <div className="flex items-center gap-3 rounded-xl border border-emerald-300 bg-white px-3 py-2">
            <input
              type="number" inputMode="decimal" min="0.1" step="0.5"
              value={qty}
              onChange={e => { setQty(e.target.value); setError('') }}
              className="w-20 bg-transparent text-xl font-extrabold text-slate-900 outline-none"
            />
            <span className="text-sm text-slate-500">{selUnit}</span>
            {preview && preview.grams > 0 && selUnit !== 'Gram' && selUnit !== 'Mililitre' && (
              <span className="ml-auto text-[10px] text-slate-400">≈ {preview.grams}g</span>
            )}
          </div>

          {/* Live preview */}
          {preview && preview.kcal > 0 && (
            <div className="mt-2 flex items-center justify-between rounded-xl bg-white px-3 py-2 shadow-sm">
              <span className="text-xl font-extrabold text-slate-900">{preview.kcal} <span className="text-sm font-medium text-slate-400">kcal</span></span>
              <div className="flex gap-3 text-[10px]">
                <span className="font-bold text-blue-600">{preview.protein}g P</span>
                <span className="font-bold text-amber-600">{preview.carbs}g K</span>
                <span className="font-bold text-red-500">{preview.fat}g Y</span>
              </div>
            </div>
          )}

          <button type="button" onClick={onAddToBasket}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-500 py-2.5 text-xs font-extrabold text-white shadow-sm hover:bg-emerald-600 active:scale-95 transition-all">
            <PlusIcon /> Sepete Ekle
          </button>
        </div>
      ) : (
        <>
          <div className="relative">
            <svg className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
            </svg>
            <input
              type="text" value={query}
              onChange={e => { setQuery(e.target.value); setError('') }}
              placeholder="Gıda ara… (örn. Köfte, Yumurta)"
              className="w-full rounded-2xl border-2 border-slate-200 py-3 pl-10 pr-4 text-sm font-medium text-slate-900 outline-none transition-all placeholder:text-slate-300 focus:border-emerald-500"
            />
          </div>

          <div className="space-y-1.5">
            {results.map(food => (
              <button key={food.id} type="button" onClick={() => selectFood(food)}
                className="flex w-full items-start gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 text-left shadow-sm transition-all hover:border-emerald-200 hover:bg-emerald-50 active:scale-[0.98]">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800">{food.name}</p>
                  <p className="mt-0.5 text-[10px] text-slate-400">
                    <span className="font-semibold text-slate-600">{food.calories} kcal</span>
                    {' · '}P:{food.protein}g K:{food.carbs}g Y:{food.fat}g <span className="text-slate-300">/ 100g</span>
                  </p>
                </div>
                <div className="flex flex-shrink-0 flex-wrap justify-end gap-1">
                  {Object.keys(food.units).map(u => (
                    <span key={u} className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-semibold text-slate-500">{u}</span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </>
  )
}
