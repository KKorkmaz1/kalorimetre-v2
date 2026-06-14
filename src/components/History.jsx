import { useState, useMemo } from 'react'
import { useDiet } from '../context/DietContext'

// ─── Constants ────────────────────────────────────────────────────────────────

const TR_MONTHS = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
]
const TR_DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar']

const DAY_HEADERS = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz']

const MOCK_MEAL_NAMES = [
  ['Yumurta & Peynir', 'Yulaf Ezmesi', 'Simit & Çay', 'Menemen', 'Tahıllı Ekmek & Reçel'],
  ['Tavuk Pilav', 'Mercimek Çorbası', 'Kuru Fasulye Pilav', 'Izgara Köfte', 'Makarna'],
  ['Elma & Badem', 'Yoğurt', 'Çay & Bisküvi', 'Meyve Tabağı', 'Ceviz & Peynir'],
  ['Izgara Somon', 'Tavuk Sote', 'Köfte & Salata', 'Sebze Çorbası', 'Bulgur Pilavı'],
]

// ─── Deterministic mock helpers ───────────────────────────────────────────────

function seededRand(n) {
  const x = Math.sin(n + 1) * 43758.5453123
  return x - Math.floor(x)
}

function buildDayData(year, month, day, tdee = 2000) {
  const today = new Date()
  today.setHours(23, 59, 59, 999)
  const thisDay = new Date(year, month, day)
  if (thisDay > today) return null

  const seed = year * 10000 + (month + 1) * 100 + day
  const r1 = seededRand(seed)
  const r2 = seededRand(seed * 3 + 7)
  const r3 = seededRand(seed * 5 + 13)

  if (r3 < 0.12) return { logged: false }

  const kcalDelta = Math.round((r1 - 0.42) * tdee * 0.28)
  const kcal      = Math.max(1100, Math.round((tdee + kcalDelta) / 10) * 10)
  const status    = kcal <= tdee * 1.07 ? 'success' : 'failed'
  const water     = Math.floor(r2 * 6) + 3

  return { logged: true, status, kcal, water }
}

function buildMockMeals(totalKcal, seed) {
  const pcts  = [0.25, 0.35, 0.10, 0.30]
  const times = ['07:30', '12:30', '15:30', '19:00']
  const types = ['Kahvaltı', 'Öğle', 'Ara Öğün', 'Akşam']

  return types.map((mealType, i) => {
    const r       = seededRand(seed * (i + 1) + 3)
    const nameIdx = Math.floor(seededRand(seed * (i + 2) + 7) * MOCK_MEAL_NAMES[i].length)
    const kcal    = Math.max(50, Math.round(totalKcal * pcts[i] * (0.85 + r * 0.30)))
    return {
      id:       `mock_${seed}_${i}`,
      isMock:   true,
      mealType,
      name:     MOCK_MEAL_NAMES[i][nameIdx],
      time:     times[i],
      kcal,
      protein:  Math.round(kcal * 0.25 / 4),
      carbs:    Math.round(kcal * 0.45 / 4),
      fat:      Math.round(kcal * 0.30 / 9),
    }
  })
}

function getDaysInMonth(y, m) { return new Date(y, m + 1, 0).getDate() }

function getStartOffset(y, m) {
  const dow = new Date(y, m, 1).getDay()
  return (dow + 6) % 7
}

function readDayStore(year, month, day) {
  try {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const raw = window.localStorage.getItem(`kalorimetre_day_${dateStr}`)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return null
}

function fmtTime(isoString) {
  try {
    return new Date(isoString).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  } catch { return '--:--' }
}

// ─── Small SVG icons ──────────────────────────────────────────────────────────

function CheckIcon({ className = 'h-3 w-3' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  )
}

function XIcon({ className = 'h-3 w-3' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
  )
}

function FlameIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
    </svg>
  )
}

function DropIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path fillRule="evenodd" d="M11.484 2.17a.75.75 0 011.032 0 11.209 11.209 0 017.877 10.58c0 5.799-4.338 10.5-9.893 10.5-5.554 0-9.893-4.701-9.893-10.5 0-4.368 2.667-8.112 6.503-9.858L11.484 2.17z" clipRule="evenodd" />
    </svg>
  )
}

// ─── Day-detail modal ─────────────────────────────────────────────────────────

function MiniBar({ value, total, color }) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-night-muted">
      <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

// Meal type meta: separate text + bg so dark variants are preserved
const MEAL_TYPE_META = {
  Kahvaltı:   { text: 'text-amber-600',   bg: 'bg-amber-50 dark:bg-amber-900/20'   },
  Öğle:       { text: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
  Akşam:      { text: 'text-purple-600',  bg: 'bg-purple-50 dark:bg-purple-900/20'  },
  'Ara Öğün': { text: 'text-blue-600',    bg: 'bg-blue-50 dark:bg-blue-900/20'      },
}

function DayDetailModal({ year, month, day, mockData, onClose }) {
  const { profile } = useDiet()

  const stored = useMemo(() => readDayStore(year, month, day), [year, month, day])

  const calorieTarget = (profile?.tdee ?? 0) + (profile?.goalOffset ?? 0)
  const macroTarget   = profile?.macros ?? { protein: 130, carbs: 260, fat: 65 }
  const waterGoal     = profile?.waterGoal ?? 8

  const logs  = stored?.logs  ?? buildMockMeals(mockData?.kcal ?? 1800, year * 10000 + (month + 1) * 100 + day)
  const water = stored?.water ?? mockData?.water ?? 0

  const consumed = useMemo(() => ({
    kcal:    logs.reduce((s, l) => s + (Number(l.kcal)    || 0), 0),
    protein: logs.reduce((s, l) => s + (Number(l.protein) || 0), 0),
    carbs:   logs.reduce((s, l) => s + (Number(l.carbs)   || 0), 0),
    fat:     logs.reduce((s, l) => s + (Number(l.fat)     || 0), 0),
  }), [logs])

  const kcalPct   = calorieTarget > 0 ? Math.min(100, Math.round((consumed.kcal / calorieTarget) * 100)) : 0
  const isSuccess = !mockData || mockData.status === 'success'

  const jsDay    = new Date(year, month, day).getDay()
  const dowLabel = TR_DAYS[(jsDay + 6) % 7]
  const dateLabel = `${day} ${TR_MONTHS[month]} ${year}, ${dowLabel}`

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative flex max-h-[92vh] w-full max-w-app flex-col rounded-t-3xl bg-white dark:bg-night-card shadow-2xl">

        {/* Header */}
        <div className="flex-shrink-0 border-b border-slate-100 dark:border-night-border px-6 pb-4 pt-3">
          <div className="mb-3 flex justify-center">
            <div className="h-1 w-10 rounded-full bg-slate-200 dark:bg-night-muted" />
          </div>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Günlük Özet</p>
              <h2 className="mt-0.5 text-base font-extrabold text-slate-900 dark:text-slate-100">{dateLabel}</h2>
            </div>
            <div className="flex items-center gap-2">
              {mockData?.logged && (
                <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                  isSuccess
                    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                    : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                }`}>
                  {isSuccess
                    ? <><CheckIcon className="h-3 w-3" /> Başarılı</>
                    : <><XIcon     className="h-3 w-3" /> Aşıldı</>
                  }
                </span>
              )}
              <button
                type="button" onClick={onClose}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-slate-100 dark:bg-night-muted text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-night-border">
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-4">

          {/* ── Calorie summary ── */}
          <div className="rounded-2xl border border-slate-100 dark:border-night-border bg-slate-50 dark:bg-night-muted p-4">
            <div className="mb-2 flex items-end justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">Kalori</p>
                <p className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                  {consumed.kcal.toLocaleString('tr-TR')}
                  <span className="ml-1 text-sm font-medium text-slate-400 dark:text-slate-500">kcal</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-slate-400 dark:text-slate-500">Hedef</p>
                <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
                  {(calorieTarget || 0).toLocaleString('tr-TR')} kcal
                </p>
              </div>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-night-border">
              <div
                className={`h-full rounded-full transition-all duration-700 ${kcalPct > 100 ? 'bg-red-500' : 'bg-emerald-500'}`}
                style={{ width: `${kcalPct}%` }}
              />
            </div>
            <p className="mt-1.5 text-right text-xs font-semibold text-slate-400 dark:text-slate-500">%{kcalPct}</p>
          </div>

          {/* ── Water ── */}
          <div className="flex items-center justify-between rounded-2xl border border-blue-100 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-900/20 px-4 py-3">
            <div className="flex items-center gap-2">
              <DropIcon className="h-5 w-5 text-blue-500" />
              <span className="text-sm font-semibold text-blue-800 dark:text-blue-300">Su Tüketimi</span>
            </div>
            <div className="flex items-center gap-1">
              {Array.from({ length: waterGoal }, (_, i) => (
                <div key={i} className={`h-3 w-3 rounded-full ${i < water ? 'bg-blue-500' : 'bg-blue-200 dark:bg-blue-900/60'}`} />
              ))}
              <span className="ml-2 text-sm font-bold text-blue-700 dark:text-blue-400">{water}/{waterGoal}</span>
            </div>
          </div>

          {/* ── Macro breakdown ── */}
          <div className="space-y-3 rounded-2xl border border-slate-100 dark:border-night-border bg-white dark:bg-night-card p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Makro Dağılımı</p>

            {[
              { label: '💪 Protein',      val: consumed.protein, target: macroTarget.protein, color: 'bg-indigo-500',  textColor: 'text-indigo-600 dark:text-indigo-400'  },
              { label: '🌾 Karbonhidrat', val: consumed.carbs,   target: macroTarget.carbs,   color: 'bg-amber-500',  textColor: 'text-amber-600 dark:text-amber-400'   },
              { label: '💧 Yağ',          val: consumed.fat,     target: macroTarget.fat,     color: 'bg-rose-500',   textColor: 'text-rose-500 dark:text-rose-400'    },
            ].map(({ label, val, target, color, textColor }) => (
              <div key={label}>
                <div className="mb-1 flex items-center justify-between">
                  <span className={`text-xs font-semibold ${textColor}`}>{label}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-bold text-slate-800 dark:text-slate-200">{Math.round(val)}g</span>
                    {' / '}{target}g
                  </span>
                </div>
                <MiniBar value={val} total={target} color={color} />
              </div>
            ))}

            {consumed.kcal > 0 && (
              <div className="border-t border-slate-100 dark:border-night-border pt-1">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-slate-500 dark:text-slate-400">Yağ oranı (kcal)</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    %{Math.round((consumed.fat * 9 / consumed.kcal) * 100)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* ── Meal timeline ── */}
          <div>
            <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
              Öğün Zaman Çizelgesi
            </p>
            {logs.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-200 dark:border-night-border py-5 text-center text-sm text-slate-400 dark:text-slate-500">
                Bu gün için öğün kaydı yok.
              </p>
            ) : (
              <div className="relative space-y-0">
                <div className="absolute bottom-4 left-[26px] top-4 w-px bg-slate-200 dark:bg-night-border" />

                {logs.map((log, idx) => {
                  const time = log.isMock ? log.time : fmtTime(log.createdAt)
                  const meta = MEAL_TYPE_META[log.mealType] ?? { text: 'text-slate-600', bg: 'bg-slate-100 dark:bg-night-muted' }
                  return (
                    <div key={log.id ?? idx} className="flex gap-4 pb-3">
                      {/* Timeline dot */}
                      <div className={`relative z-10 flex h-[52px] w-[52px] flex-shrink-0 flex-col items-center justify-center rounded-2xl ${meta.bg}`}>
                        <span className="text-xs font-extrabold leading-none tabular-nums text-slate-700 dark:text-slate-300">{time}</span>
                        <span className={`mt-0.5 text-[9px] font-bold ${meta.text}`}>{log.mealType}</span>
                      </div>
                      {/* Content card */}
                      <div className="flex flex-1 items-center justify-between rounded-2xl border border-slate-100 dark:border-night-border bg-white dark:bg-night-card px-3 py-2.5 shadow-sm">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{log.name}</p>
                          {(log.protein > 0 || log.carbs > 0 || log.fat > 0) && (
                            <p className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500">
                              P:{Math.round(log.protein)}g · K:{Math.round(log.carbs)}g · Y:{Math.round(log.fat)}g
                            </p>
                          )}
                          {log.servingInfo && (
                            <p className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500">{log.servingInfo}</p>
                          )}
                        </div>
                        <span className="ml-2 flex-shrink-0 text-sm font-extrabold text-slate-800 dark:text-slate-100">
                          {Math.round(log.kcal)} kcal
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}

// ─── Calendar day cell ────────────────────────────────────────────────────────

function DayCell({ day, data, isToday, onClick }) {
  // Empty padding cell
  if (!day) {
    return <div className="bg-white dark:bg-night-card" style={{ minHeight: 64 }} />
  }

  // Future date — no data
  if (!data) {
    return (
      <div className="flex flex-col items-center bg-slate-50/60 dark:bg-night-bg/60 px-0.5 py-1.5" style={{ minHeight: 64 }}>
        <span className="text-[10px] font-bold text-slate-300 dark:text-slate-600">{day}</span>
      </div>
    )
  }

  // Past day — not logged
  if (!data.logged) {
    return (
      <button
        type="button" onClick={onClick}
        className="flex w-full cursor-pointer flex-col items-center bg-white dark:bg-night-card px-0.5 py-1.5 transition-colors hover:bg-slate-50 dark:hover:bg-night-muted active:bg-slate-100 dark:active:bg-night-muted"
        style={{ minHeight: 64 }}
      >
        <span className={`text-[10px] font-bold ${isToday ? 'text-emerald-500' : 'text-slate-400 dark:text-slate-500'}`}>
          {day}
        </span>
        <span className="mb-1 mt-auto text-[9px] text-slate-300 dark:text-slate-600">—</span>
      </button>
    )
  }

  // Logged day — success or over-limit
  const isSuccess = data.status === 'success'

  return (
    <button
      type="button" onClick={onClick}
      className={`flex w-full cursor-pointer flex-col items-center px-0.5 py-1.5 transition-all hover:opacity-80 active:scale-95 ${
        isSuccess
          ? 'bg-emerald-50 dark:bg-emerald-900/20'
          : 'bg-red-50 dark:bg-red-900/20'
      }`}
      style={{ minHeight: 64 }}
    >
      <span className={`text-[10px] font-bold leading-none ${isToday ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
        {day}
      </span>

      <div className={`my-1 flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full ${
        isSuccess ? 'bg-emerald-500' : 'bg-red-500'
      }`}>
        {isSuccess
          ? <CheckIcon className="h-2.5 w-2.5 text-white" />
          : <XIcon     className="h-2.5 w-2.5 text-white" />
        }
      </div>

      <div className="flex items-center gap-px">
        <FlameIcon className="h-2 w-2 flex-shrink-0 text-amber-400" />
        <span className="text-[9px] font-semibold leading-none text-slate-600 dark:text-slate-300">
          {data.kcal >= 1000 ? (data.kcal / 1000).toFixed(1).replace('.0', '') + 'k' : data.kcal}
        </span>
      </div>

      <div className="mt-0.5 flex items-center gap-px">
        <DropIcon className="h-2 w-2 flex-shrink-0 text-blue-400" />
        <span className="text-[8px] leading-none text-slate-400 dark:text-slate-500">{data.water}/8</span>
      </div>
    </button>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function History() {
  const { profile } = useDiet()
  const today  = new Date()
  const [year,  setYear]  = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  const [selectedCell, setSelectedCell] = useState(null)

  const tdee = profile?.tdee ?? 2000

  const atMax = year === today.getFullYear() && month === today.getMonth()

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (atMax) return
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  const daysInMonth = getDaysInMonth(year, month)
  const startOffset = getStartOffset(year, month)

  const cells = useMemo(() => {
    const arr = Array(startOffset).fill(null)
    for (let d = 1; d <= daysInMonth; d++) arr.push(d)
    while (arr.length % 7 !== 0) arr.push(null)
    return arr
  }, [year, month, startOffset, daysInMonth])

  const dayDataMap = useMemo(() => {
    const map = {}
    for (let d = 1; d <= daysInMonth; d++) {
      map[d] = buildDayData(year, month, d, tdee)
    }
    return map
  }, [year, month, daysInMonth, tdee])

  const { successCount, failedCount, avgKcal } = useMemo(() => {
    let success = 0, failed = 0, total = 0, count = 0
    for (let d = 1; d <= daysInMonth; d++) {
      const dd = dayDataMap[d]
      if (!dd || !dd.logged) continue
      if (dd.status === 'success') success++
      else failed++
      total += dd.kcal; count++
    }
    return { successCount: success, failedCount: failed, avgKcal: count > 0 ? Math.round(total / count) : 0 }
  }, [dayDataMap, daysInMonth])

  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth()

  return (
    <section className="space-y-4">

      {/* ── Header ── */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Kalorimetre</p>
        <div className="mt-1 flex items-center justify-between">
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">Geçmiş</h1>

          <div className="flex items-center gap-1.5">
            <button
              type="button" onClick={prevMonth}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl border border-slate-200 dark:border-night-border bg-white dark:bg-night-card text-slate-500 dark:text-slate-400 transition-colors hover:border-slate-300 dark:hover:border-night-muted">
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
              </svg>
            </button>
            <span className="min-w-[7.5rem] text-center text-sm font-bold text-slate-800 dark:text-slate-200">
              {TR_MONTHS[month]} {year}
            </span>
            <button
              type="button" onClick={nextMonth} disabled={atMax}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl border border-slate-200 dark:border-night-border bg-white dark:bg-night-card text-slate-500 dark:text-slate-400 transition-colors hover:border-slate-300 dark:hover:border-night-muted disabled:cursor-not-allowed disabled:opacity-30">
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* ── Summary stat cards ── */}
      <div className="grid grid-cols-3 gap-2.5">
        {[
          { value: successCount, label: 'Başarılı',  iconBg: 'bg-emerald-100 dark:bg-emerald-900/30', icon: <CheckIcon className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> },
          { value: failedCount,  label: 'Başarısız', iconBg: 'bg-red-100 dark:bg-red-900/30',          icon: <XIcon     className="h-3.5 w-3.5 text-red-500 dark:text-red-400"          /> },
          {
            value: avgKcal > 0 ? avgKcal.toLocaleString('tr-TR') : '—',
            label: 'Ort. Kalori', iconBg: 'bg-amber-100 dark:bg-amber-900/30',
            icon: <FlameIcon className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />,
          },
        ].map(({ value, label, iconBg, icon }) => (
          <div key={label} className="rounded-2xl border border-slate-100 dark:border-night-border bg-white dark:bg-night-card p-3.5 shadow-sm">
            <div className={`mb-2 flex h-7 w-7 items-center justify-center rounded-full ${iconBg}`}>{icon}</div>
            <p className="text-xl font-extrabold text-slate-900 dark:text-slate-100">{value}</p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Calendar grid ── */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-night-border bg-white dark:bg-night-card shadow-sm">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-slate-100 dark:border-night-border bg-slate-50 dark:bg-night-muted">
          {DAY_HEADERS.map(d => (
            <div key={d} className="py-2 text-center text-[11px] font-bold text-slate-400 dark:text-slate-500">{d}</div>
          ))}
        </div>

        {/* Cells — gap-px creates hairline separators using the parent background color */}
        <div className="grid grid-cols-7 gap-px bg-slate-100 dark:bg-night-border">
          {cells.map((day, idx) => (
            <DayCell
              key={idx}
              day={day}
              data={day ? dayDataMap[day] : null}
              isToday={isCurrentMonth && day === today.getDate()}
              onClick={day ? () => setSelectedCell({ year, month, day, data: dayDataMap[day] }) : undefined}
            />
          ))}
        </div>
      </div>

      {/* ── Colour legend ── */}
      <div className="rounded-2xl border border-slate-100 dark:border-night-border bg-white dark:bg-night-card p-4 shadow-sm">
        <p className="mb-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Renk Kodu</p>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500">
              <CheckIcon className="h-2.5 w-2.5 text-white" />
            </div>
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Başarı</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500">
              <XIcon className="h-2.5 w-2.5 text-white" />
            </div>
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Aşıldı</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-5 w-5 rounded-full border-2 border-slate-200 dark:border-night-border bg-white dark:bg-night-card" />
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Girilmedi</span>
          </div>
          <span className="ml-auto text-[10px] text-slate-400 dark:text-slate-500">Güne tıklayarak detay görün</span>
        </div>
      </div>

      {/* ── Day detail modal ── */}
      {selectedCell && (
        <DayDetailModal
          year={selectedCell.year}
          month={selectedCell.month}
          day={selectedCell.day}
          mockData={selectedCell.data}
          onClose={() => setSelectedCell(null)}
        />
      )}

    </section>
  )
}
