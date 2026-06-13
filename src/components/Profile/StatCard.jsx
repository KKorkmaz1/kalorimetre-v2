export function SectionLabel({ text }) {
  return <p className="mb-3 text-[11px] font-extrabold uppercase tracking-widest text-slate-400">{text}</p>
}

export default function StatCard({ label, starting, current, unit, positiveDir }) {
  const s = Number(starting) || 0
  const c = Number(current)  || 0
  if (!s && !c) return null
  const delta     = Math.round((c - s) * 10) / 10
  const improved  = positiveDir === 'down' ? delta <= 0 : delta >= 0
  const unchanged = delta === 0

  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">{label}</p>
      <div className="mt-2 flex items-end justify-between">
        <div>
          <p className="text-2xl font-extrabold text-slate-900">{c}<span className="ml-1 text-sm font-semibold text-slate-400">{unit}</span></p>
          {s > 0 && <p className="text-xs text-slate-400">Başlangıç: {s}{unit}</p>}
        </div>
        {!unchanged && s > 0 && (
          <div className={`flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-extrabold ${
            improved ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
          }`}>
            <span>{delta > 0 ? '↑' : '↓'}</span>
            <span>{Math.abs(delta)}{unit}</span>
          </div>
        )}
      </div>
    </div>
  )
}
