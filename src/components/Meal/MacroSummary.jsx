export default function MacroSummary({ impact, alternatives }) {
  const { warnings, positives } = impact
  if (warnings.length === 0 && positives.length === 0 && alternatives.length === 0) return null

  return (
    <div className="space-y-2">
      {warnings.map((w, i) => (
        <div key={i} className={`flex items-start gap-2.5 rounded-2xl px-3 py-2.5 ${
          w.level === 'critical'
            ? 'border border-red-200 bg-red-50'
            : 'border border-amber-200 bg-amber-50'
        }`}>
          <svg className={`mt-0.5 h-4 w-4 flex-shrink-0 ${w.level === 'critical' ? 'text-red-500' : 'text-amber-500'}`} viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
          <p className={`text-xs font-semibold ${w.level === 'critical' ? 'text-red-700' : 'text-amber-700'}`}>{w.text}</p>
        </div>
      ))}

      {positives.map((p, i) => (
        <div key={i} className="flex items-start gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
          <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
          </svg>
          <p className="text-xs font-semibold text-emerald-700">{p.text}</p>
        </div>
      ))}

      {alternatives.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-3">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">Daha Sağlıklı Alternatifler</p>
          <div className="space-y-1.5">
            {alternatives.map(f => (
              <div key={f.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                <span className="text-xs font-semibold text-slate-700">{f.name}</span>
                <span className="text-[10px] text-slate-400">{f.calories} kcal · P:{f.protein}g</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
