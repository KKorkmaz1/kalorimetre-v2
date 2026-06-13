import { useMemo } from 'react'

function readDayKcal(dateStr) {
  try {
    const raw = window.localStorage.getItem(`kalorimetre_day_${dateStr}`)
    if (!raw) return 0
    const parsed = JSON.parse(raw)
    return parsed.logs?.reduce((s, l) => s + (Number(l.kcal) || 0), 0) ?? 0
  } catch { return 0 }
}

export function getLast7Days() {
  const labels = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz']
  const today  = new Date()
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() - (6 - i))
    const dateStr = d.toISOString().slice(0, 10)
    return {
      dateStr,
      label:   labels[(d.getDay() + 6) % 7],
      kcal:    readDayKcal(dateStr),
      isToday: i === 6,
    }
  })
}

export function SparkLine({ history, valueKey, color }) {
  const pts = history.filter(d => (d[valueKey] ?? 0) > 0)
  if (pts.length < 2) return (
    <p className="py-3 text-center text-xs text-slate-300">Trend için en az 2 ölçüm gerekiyor</p>
  )
  const values = pts.map(d => Number(d[valueKey]))
  const min = Math.min(...values); const max = Math.max(...values)
  const range = max - min || 1
  const W = 200; const H = 40
  const coords = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W
    const y = H - ((v - min) / range) * (H - 6) - 3
    return `${x},${y}`
  })
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }} preserveAspectRatio="none">
      <polyline
        points={coords.join(' ')}
        fill="none" stroke={color} strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round"
      />
      {coords.map((pt, i) => {
        const [x, y] = pt.split(',')
        return <circle key={i} cx={Number(x)} cy={Number(y)} r="3" fill={color} />
      })}
    </svg>
  )
}

export default function WeeklyChart({ target }) {
  const days = useMemo(() => getLast7Days(), [])
  const maxVal = Math.max(...days.map(d => d.kcal), target || 1)

  return (
    <div>
      <div className="flex items-end gap-1.5" style={{ height: 80 }}>
        {days.map((day, i) => {
          const pct   = target > 0 ? day.kcal / target : 0
          const barH  = maxVal > 0 ? Math.round((day.kcal / maxVal) * 72) : 0
          const barColor = day.kcal === 0
            ? 'bg-slate-100'
            : pct > 1.07
              ? 'bg-red-400'
              : pct > 0.85
                ? 'bg-emerald-500'
                : 'bg-emerald-300'

          return (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              {day.kcal > 0 && (
                <span className="text-[8px] font-semibold text-slate-400">{day.kcal}</span>
              )}
              <div
                className={`w-full rounded-t-lg transition-all duration-500 ${barColor}`}
                style={{ height: day.kcal === 0 ? 2 : barH }}
              />
              <span className={`text-[10px] font-extrabold ${day.isToday ? 'text-emerald-600' : 'text-slate-400'}`}>
                {day.label}
              </span>
            </div>
          )
        })}
      </div>
      {target > 0 && (
        <div className="mt-2 flex items-center gap-1.5">
          <div className="h-px flex-1 border-t border-dashed border-slate-200" />
          <span className="text-[9px] font-semibold text-slate-400">Hedef {target.toLocaleString('tr-TR')} kcal</span>
        </div>
      )}
    </div>
  )
}
