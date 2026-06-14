import { CloseIcon } from './MealIcons'

export default function BasketItem({ basket, totals, onRemove }) {
  if (basket.length === 0) return null
  return (
    <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-900/20 p-3">
      <p className="mb-2 text-[10px] font-extrabold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
        Sepet · {basket.length} ürün
      </p>
      <div className="space-y-1.5">
        {basket.map(item => (
          <div key={item.id} className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <span className="block truncate text-xs font-semibold text-slate-800 dark:text-slate-200">{item.foodName}</span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">{item.qty} {item.unit}</span>
            </div>
            <span className="flex-shrink-0 text-xs font-extrabold text-slate-700 dark:text-slate-300">{item.kcal} kcal</span>
            <button
              type="button" onClick={() => onRemove(item.id)}
              className="flex-shrink-0 cursor-pointer text-slate-300 dark:text-slate-600 hover:text-red-400 transition-colors">
              <CloseIcon />
            </button>
          </div>
        ))}
      </div>
      {basket.length > 1 && (
        <div className="mt-2.5 flex justify-between border-t border-emerald-200 dark:border-emerald-900/40 pt-2">
          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Toplam</span>
          <div className="text-right">
            <span className="text-sm font-extrabold text-emerald-700 dark:text-emerald-400">{totals.kcal} kcal</span>
            <span className="ml-2 text-[10px] text-emerald-600 dark:text-emerald-500">
              P:{totals.protein}g K:{totals.carbs}g Y:{totals.fat}g
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
