import { CloseIcon } from './MealIcons'

export default function BasketItem({ basket, totals, onRemove }) {
  if (basket.length === 0) return null
  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
      <p className="mb-2 text-[10px] font-extrabold uppercase tracking-widest text-emerald-700">
        Sepet · {basket.length} ürün
      </p>
      <div className="space-y-1.5">
        {basket.map(item => (
          <div key={item.id} className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <span className="text-xs font-semibold text-slate-800 truncate block">{item.foodName}</span>
              <span className="text-[10px] text-slate-500">{item.qty} {item.unit}</span>
            </div>
            <span className="flex-shrink-0 text-xs font-extrabold text-slate-700">{item.kcal} kcal</span>
            <button type="button" onClick={() => onRemove(item.id)}
              className="flex-shrink-0 text-slate-300 hover:text-red-400 transition-colors">
              <CloseIcon />
            </button>
          </div>
        ))}
      </div>
      {basket.length > 1 && (
        <div className="mt-2.5 flex justify-between border-t border-emerald-200 pt-2">
          <span className="text-xs font-bold text-emerald-700">Toplam</span>
          <div className="text-right">
            <span className="text-sm font-extrabold text-emerald-700">{totals.kcal} kcal</span>
            <span className="ml-2 text-[10px] text-emerald-600">
              P:{totals.protein}g K:{totals.carbs}g Y:{totals.fat}g
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
