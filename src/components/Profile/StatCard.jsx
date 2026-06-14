export function SectionLabel({ text }) {
  return (
    <p className="mb-3 text-[11px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500">
      {text}
    </p>
  )
}

export default function StatCard({ label, starting, current, unit, positiveDir }) {
  const s = Number(starting) || 0
  const c = Number(current)  || 0
  if (!s && !c) return null
  const delta     = Math.round((c - s) * 10) / 10
  const improved  = positiveDir === 'down' ? delta <= 0 : delta >= 0
  const unchanged = delta === 0

  return (
    <div className="rounded-2xl bg-slate-50 dark:bg-night-muted p-4">
      <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</p>
      <div className="mt-2 flex items-end justify-between">
        <div>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
            {c}
            <span className="ml-1 text-sm font-semibold text-slate-400 dark:text-slate-500">{unit}</span>
          </p>
          {s > 0 && (
            <p className="text-xs text-slate-400 dark:text-slate-500">Başlangıç: {s}{unit}</p>
          )}
        </div>
        {!unchanged && s > 0 && (
          <div className={`flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-extrabold ${
            improved
              ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
              : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
          }`}>
            <span>{delta > 0 ? '↑' : '↓'}</span>
            <span>{Math.abs(delta)}{unit}</span>
          </div>
        )}
      </div>
    </div>
  )
}
