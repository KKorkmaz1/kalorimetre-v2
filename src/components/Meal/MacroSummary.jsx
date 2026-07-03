import { PlusIcon } from './MealIcons'

export default function MacroSummary({
  impact = { warnings: [], positives: [] },
  alternatives = [],
  alternativesLoading = false,
  onAddAlternative,
  onSaveAlternative,
  savingMenuId,
  mode = 'full', // 'full' | 'alternatives' | 'impact'
}) {
  const { warnings, positives } = impact
  const showImpact = mode === 'full' || mode === 'impact'
  const showAlternatives = (mode === 'full' || mode === 'alternatives') && (alternativesLoading || alternatives.length > 0)

  if (!showImpact && !showAlternatives) return null
  if (showImpact && !showAlternatives && warnings.length === 0 && positives.length === 0) return null

  return (
    <div className="space-y-2">
      {showImpact && warnings.map((w, i) => (
        <div key={i} className={`flex items-start gap-2.5 rounded-2xl px-3 py-2.5 ${
          w.level === 'critical'
            ? 'border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/20'
            : 'border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/20'
        }`}>
          <svg className={`mt-0.5 h-4 w-4 flex-shrink-0 ${w.level === 'critical' ? 'text-red-500' : 'text-amber-500'}`} viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
          <p className={`text-xs font-semibold ${
            w.level === 'critical'
              ? 'text-red-700 dark:text-red-400'
              : 'text-amber-700 dark:text-amber-400'
          }`}>{w.text}</p>
        </div>
      ))}

      {showImpact && positives.map((p, i) => (
        <div key={i} className="flex items-start gap-2.5 rounded-2xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2.5">
          <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
          </svg>
          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">{p.text}</p>
        </div>
      ))}

      {showAlternatives && (
        <div className="rounded-2xl border border-slate-200 dark:border-night-border bg-white dark:bg-night-card p-3">
          <div className="mb-2 flex items-center gap-2">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Daha Sağlıklı Alternatifler
            </p>
            {alternativesLoading && (
              <svg className="h-3.5 w-3.5 animate-spin text-emerald-500" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
          </div>
          <div className="space-y-1.5">
            {alternativesLoading && alternatives.length === 0 && (
              <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 py-1">
                YZ alternatifler hazırlanıyor…
              </p>
            )}
            {alternatives.map(f => (
              <div key={f.id} className="flex items-center gap-2 rounded-xl bg-slate-50 dark:bg-night-muted px-3 py-2">
                <div className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300">{f.name}</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">
                    {f.calories ?? f.kcal} kcal · P:{f.protein}g
                  </span>
                </div>
                <div className="flex flex-shrink-0 items-center gap-1">
                  {onAddAlternative && (
                    <button
                      type="button"
                      onClick={() => onAddAlternative(f)}
                      className="flex cursor-pointer items-center gap-0.5 rounded-lg bg-emerald-500 px-2 py-1 text-[9px] font-extrabold text-white transition-all hover:bg-emerald-600 active:scale-95"
                    >
                      <PlusIcon /> Ekle
                    </button>
                  )}
                  {onSaveAlternative && (
                    <button
                      type="button"
                      onClick={() => onSaveAlternative(f)}
                      disabled={savingMenuId === f.id}
                      className="cursor-pointer rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 text-[9px] font-extrabold text-amber-700 dark:text-amber-400 transition-all hover:bg-amber-100 dark:hover:bg-amber-900/30 disabled:opacity-60"
                    >
                      {savingMenuId === f.id ? '…' : 'Bunu Kaydet'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
