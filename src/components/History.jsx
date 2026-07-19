import { useState, useMemo, useEffect } from 'react'
import { useDiet } from '../context/DietContext'
import { getDailyCalorieTarget } from '../utils/macroEngine'
import { ProteinIcon, CarbsIcon, FatIcon } from './Meal/MealIcons'
import { supabase } from '../utils/supabaseClient'
import { formatKcal, formatMacro } from '../utils/nutritionFormat'

// ─── Constants ────────────────────────────────────────────────────────────────

const TR_MONTHS = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
]
const TR_DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar']

const DAY_HEADERS = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz']

const YEAR_OPTIONS = [2024, 2025, 2026]

const selectBase =
  'appearance-none cursor-pointer bg-transparent text-center font-bold text-gray-700 outline-none transition-colors hover:text-green-600 dark:text-slate-200 dark:hover:text-emerald-400'




function getDaysInMonth(y, m) { return new Date(y, m + 1, 0).getDate() }

function getStartOffset(y, m) {
  const dow = new Date(y, m, 1).getDay()
  return (dow + 6) % 7
}

function toDateStr(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

// Build a single day's calendar entry from pre-fetched Supabase data.
// monthMap: { 'YYYY-MM-DD': { logs: [...], water: N } }
function buildDayData(year, month, day, tdee = 2000, monthMap = {}) {
  const today = new Date()
  today.setHours(23, 59, 59, 999)
  const thisDay = new Date(year, month, day)

  if (thisDay > today) return null // future

  const stored = monthMap[toDateStr(year, month, day)]
  if (!stored || !Array.isArray(stored.logs) || stored.logs.length === 0) {
    return { logged: false }
  }

  const kcal = stored.logs.reduce((s, l) => s + (Number(l.kcal) || 0), 0)
  if (kcal === 0) return { logged: false }

  const protein = stored.logs.reduce((s, l) => s + (Number(l.protein) || 0), 0)
  const carbs   = stored.logs.reduce((s, l) => s + (Number(l.carbs)   || 0), 0)
  const fat     = stored.logs.reduce((s, l) => s + (Number(l.fat)     || 0), 0)
  const water   = stored.water ?? 0
  const status  = tdee > 0 && kcal > tdee ? 'failed' : 'success'

  return {
    logged: true,
    status,
    kcal,
    water,
    protein,
    carbs,
    fat,
    remaining: tdee - kcal,
    storedData: stored,
  }
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

// storedData: the pre-fetched { logs, water } object from Supabase (may be null)
// dayEntry:   the buildDayData result ({ logged, status, kcal, water })
function DayDetailModal({ year, month, day, storedData, dayEntry, onClose }) {
  const { profile } = useDiet()

  const calorieTarget = getDailyCalorieTarget(profile)
  const macroTarget   = profile?.macros ?? { protein: 130, carbs: 260, fat: 65 }
  const waterGoal     = profile?.waterGoal ?? 8

  const logs  = storedData?.logs  ?? []
  const water = storedData?.water ?? 0

  const consumed = useMemo(() => ({
    kcal:    logs.reduce((s, l) => s + (Number(l.kcal)    || 0), 0),
    protein: logs.reduce((s, l) => s + (Number(l.protein) || 0), 0),
    carbs:   logs.reduce((s, l) => s + (Number(l.carbs)   || 0), 0),
    fat:     logs.reduce((s, l) => s + (Number(l.fat)     || 0), 0),
  }), [logs])

  const kcalPct   = calorieTarget > 0 ? Math.min(100, Math.round((consumed.kcal / calorieTarget) * 100)) : 0
  const isSuccess = !dayEntry?.logged || dayEntry.status === 'success'

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
              {dayEntry?.logged && (
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
                  {formatKcal(consumed.kcal)}
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
              { icon: <ProteinIcon className="h-3 w-3 flex-shrink-0" />, label: 'Protein',      val: consumed.protein, target: macroTarget.protein, color: 'bg-indigo-500', textColor: 'text-indigo-600 dark:text-indigo-400' },
              { icon: <CarbsIcon   className="h-3 w-3 flex-shrink-0" />, label: 'Karbonhidrat', val: consumed.carbs,   target: macroTarget.carbs,   color: 'bg-amber-500',  textColor: 'text-amber-600 dark:text-amber-400'  },
              { icon: <FatIcon     className="h-3 w-3 flex-shrink-0" />, label: 'Yağ',          val: consumed.fat,     target: macroTarget.fat,     color: 'bg-rose-500',   textColor: 'text-rose-500 dark:text-rose-400'    },
            ].map(({ icon, label, val, target, color, textColor }) => (
              <div key={label}>
                <div className="mb-1 flex items-center justify-between">
                  <span className={`flex items-center gap-1.5 text-xs font-semibold ${textColor}`}>{icon} {label}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-bold text-slate-800 dark:text-slate-200">{formatMacro(val)}g</span>
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
                              P:{formatMacro(log.protein)}g · K:{formatMacro(log.carbs)}g · Y:{formatMacro(log.fat)}g
                            </p>
                          )}
                          {log.servingInfo && (
                            <p className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500">{log.servingInfo}</p>
                          )}
                        </div>
                        <span className="ml-2 flex-shrink-0 text-sm font-extrabold text-slate-800 dark:text-slate-100">
                          {formatKcal(log.kcal)} kcal
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

const CELL_MIN_H = 'min-h-[100px] sm:min-h-[120px]'

function DayProgressRing({ day, pct, isSuccess, isToday, size = 40 }) {
  const sw = 3
  const r  = (size - sw * 2) / 2
  const C  = 2 * Math.PI * r
  const fillPct = Math.min(100, Math.max(0, pct))
  const offset  = C * (1 - fillPct / 100)
  const ringStroke = isSuccess ? '#22c55e' : '#ef4444'
  const trackStroke = isSuccess ? '#bbf7d0' : '#fecaca'

  return (
    <div className="relative flex-shrink-0 sm:hidden" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackStroke} strokeWidth={sw} className="dark:opacity-40" />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke={ringStroke}
          strokeWidth={sw}
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={offset}
          className="transition-all duration-500"
          style={{ transformOrigin: `${size / 2}px ${size / 2}px`, transform: 'rotate(-90deg)' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`text-sm font-bold leading-none ${
          isToday ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-800 dark:text-slate-100'
        }`}>
          {day}
        </span>
      </div>
    </div>
  )
}

function DayProgressRingLg({ day, pct, isSuccess, isToday, size = 48 }) {
  const sw = 3.5
  const r  = (size - sw * 2) / 2
  const C  = 2 * Math.PI * r
  const fillPct = Math.min(100, Math.max(0, pct))
  const offset  = C * (1 - fillPct / 100)
  const ringStroke = isSuccess ? '#22c55e' : '#ef4444'
  const trackStroke = isSuccess ? '#bbf7d0' : '#fecaca'

  return (
    <div className="relative hidden flex-shrink-0 sm:block" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackStroke} strokeWidth={sw} className="dark:opacity-40" />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke={ringStroke}
          strokeWidth={sw}
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={offset}
          className="transition-all duration-500"
          style={{ transformOrigin: `${size / 2}px ${size / 2}px`, transform: 'rotate(-90deg)' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`text-base font-bold leading-none ${
          isToday ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-800 dark:text-slate-100'
        }`}>
          {day}
        </span>
      </div>
    </div>
  )
}

function EmptyDayRing({ day, isToday }) {
  const dayClass = isToday
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-gray-800 dark:text-slate-200'

  return (
    <>
      <div className="relative flex-shrink-0 sm:hidden" style={{ width: 40, height: 40 }}>
        <svg width={40} height={40} aria-hidden="true">
          <circle cx={20} cy={20} r={16.5} fill="none" stroke="#e5e7eb" strokeWidth={3} className="dark:stroke-night-border" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-sm font-bold leading-none ${dayClass}`}>{day}</span>
        </div>
      </div>
      <div className="relative hidden flex-shrink-0 sm:block" style={{ width: 48, height: 48 }}>
        <svg width={48} height={48} aria-hidden="true">
          <circle cx={24} cy={24} r={20} fill="none" stroke="#e5e7eb" strokeWidth={3.5} className="dark:stroke-night-border" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-base font-bold leading-none ${dayClass}`}>{day}</span>
        </div>
      </div>
    </>
  )
}

function DayCell({ day, data, isToday, onClick, target = 2000 }) {
  const cellMotion =
    'cursor-pointer transition-transform duration-200 hover:scale-[1.03] active:scale-95'
  const cellBase = `flex w-full flex-col items-center justify-between rounded-xl p-2 ${CELL_MIN_H}`

  // Empty padding cell — invisible spacer to preserve grid rhythm
  if (!day) {
    return <div className={`rounded-xl ${CELL_MIN_H}`} aria-hidden="true" />
  }

  // Future date — muted, non-interactive
  if (!data) {
    return (
      <div className={`${cellBase} border border-transparent bg-gray-50/50 dark:bg-night-bg/40`}>
        <EmptyDayRing day={day} isToday={false} />
        <span className="text-[9px] text-gray-300 dark:text-slate-600">—</span>
      </div>
    )
  }

  // Past day — not logged
  if (!data.logged) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${cellBase} border border-transparent bg-gray-50 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-gray-100 hover:shadow-md dark:bg-night-muted dark:hover:bg-night-border ${cellMotion}`}
      >
        <EmptyDayRing day={day} isToday={isToday} />
        <p className="text-[10px] font-medium text-gray-400 dark:text-slate-500">
          0 / {target.toLocaleString('tr-TR')}
        </p>
      </button>
    )
  }

  // Logged day — mini dashboard
  const isSuccess = data.status === 'success'
  const pct = target > 0 ? (data.kcal / target) * 100 : 0
  const hasMacros = data.protein > 0 || data.carbs > 0 || data.fat > 0
  const remaining = data.remaining ?? target - data.kcal

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${cellBase} shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${cellMotion} ${
        isSuccess
          ? 'border border-green-200 bg-green-50 dark:border-emerald-800/40 dark:bg-emerald-900/20'
          : 'border border-red-200 bg-red-50 dark:border-red-800/40 dark:bg-red-900/20'
      }`}
    >
      <div className="flex flex-shrink-0 flex-col items-center">
        <DayProgressRing day={day} pct={pct} isSuccess={isSuccess} isToday={isToday} />
        <DayProgressRingLg day={day} pct={pct} isSuccess={isSuccess} isToday={isToday} />
      </div>

      <div className="mt-1 w-full min-w-0 text-center">
        <p className="truncate text-[10px] font-semibold tabular-nums text-gray-700 dark:text-slate-200 sm:text-xs">
          {formatKcal(data.kcal)} / {formatKcal(target)} kcal
        </p>
        <p className={`mt-0.5 truncate text-[8px] tabular-nums sm:text-[9px] ${
          remaining >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
        }`}>
          {remaining >= 0
            ? `${remaining.toLocaleString('tr-TR')} kalan`
            : `${Math.abs(remaining).toLocaleString('tr-TR')} fazla`}
        </p>
        {hasMacros && (
          <p className="mt-0.5 flex justify-center gap-1 truncate text-[8px] text-gray-500 tabular-nums dark:text-slate-400 sm:text-[9px]">
            <span>P:{formatMacro(data.protein)}g</span>
            <span>C:{formatMacro(data.carbs)}g</span>
            <span>Y:{formatMacro(data.fat)}g</span>
          </p>
        )}
      </div>
    </button>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function History() {
  const { profile, userId, mealsByDate } = useDiet()
  const today  = new Date()
  const [year,  setYear]  = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  const [selectedCell,  setSelectedCell]  = useState(null)
  const [monthMap,      setMonthMap]      = useState({}) // Supabase rows for displayed month
  const [loadingMonth,  setLoadingMonth]  = useState(false)

  const tdee = getDailyCalorieTarget(profile) || 2000

  const atMax = year === today.getFullYear() && month === today.getMonth()

  // Live context data overrides stale Supabase cache for the same dates
  const mergedMonthMap = useMemo(() => {
    const merged = { ...monthMap }
    for (const [dateStr, dayData] of Object.entries(mealsByDate)) {
      const [y, m] = dateStr.split('-').map(Number)
      if (y === year && m === month + 1) {
        merged[dateStr] = dayData
      }
    }
    return merged
  }, [monthMap, mealsByDate, year, month])

  // ── Fetch all daily_logs for the displayed month ───────────────────────────
  useEffect(() => {
    if (!userId) return

    let cancelled = false
    setLoadingMonth(true)

    const from = toDateStr(year, month, 1)
    const to   = toDateStr(year, month, getDaysInMonth(year, month))

    supabase
      .from('daily_logs')
      .select('date, meals_data')
      .eq('user_id', userId)
      .gte('date', from)
      .lte('date', to)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) console.error('[History] fetch error:', error)
        // Build the map from whatever rows came back (empty array = no entries yet)
        const map = {}
        for (const row of data ?? []) {
          if (row?.date && row?.meals_data) map[row.date] = row.meals_data
        }
        setMonthMap(map)
      })
      .catch(err => {
        if (!cancelled) console.error('[History] unexpected error:', err)
      })
      .finally(() => {
        if (!cancelled) setLoadingMonth(false)
      })

    return () => { cancelled = true }
  }, [userId, year, month])

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
      map[d] = buildDayData(year, month, d, tdee, mergedMonthMap)
    }
    return map
  }, [year, month, daysInMonth, tdee, mergedMonthMap])

  const selectedDayLive = useMemo(() => {
    if (!selectedCell) return null
    const { year: y, month: m, day: d } = selectedCell
    const dayEntry = buildDayData(y, m, d, tdee, mergedMonthMap)
    return {
      storedData: mergedMonthMap[toDateStr(y, m, d)] ?? null,
      dayEntry,
    }
  }, [selectedCell, tdee, mergedMonthMap])

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

          <div className="flex items-center gap-1">
            <button
              type="button" onClick={prevMonth}
              aria-label="Önceki ay"
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 dark:border-night-border dark:bg-night-card dark:text-slate-400 dark:hover:border-night-muted">
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
              </svg>
            </button>

            <div className="flex items-center">
              <select
                aria-label="Ay seçin"
                value={month}
                onChange={e => setMonth(Number(e.target.value))}
                className={`${selectBase} mx-1 text-sm`}
              >
                {TR_MONTHS.map((name, idx) => (
                  <option key={name} value={idx}>{name}</option>
                ))}
              </select>
              <select
                aria-label="Yıl seçin"
                value={year}
                onChange={e => setYear(Number(e.target.value))}
                className={`${selectBase} mx-1 text-sm`}
              >
                {YEAR_OPTIONS.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            <button
              type="button" onClick={nextMonth} disabled={atMax}
              aria-label="Sonraki ay"
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-30 dark:border-night-border dark:bg-night-card dark:text-slate-400 dark:hover:border-night-muted">
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* ── Summary stat cards ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            value: successCount,
            label: 'Başarılı',
            iconBg: 'bg-green-100/80 dark:bg-emerald-900/30',
            iconColor: 'text-green-600 dark:text-emerald-400',
            icon: CheckIcon,
          },
          {
            value: failedCount,
            label: 'Başarısız',
            iconBg: 'bg-red-100/80 dark:bg-red-900/30',
            iconColor: 'text-red-600 dark:text-red-400',
            icon: XIcon,
          },
          {
            value: avgKcal > 0 ? avgKcal.toLocaleString('tr-TR') : '—',
            label: 'Ort. Kalori',
            iconBg: 'bg-amber-100/80 dark:bg-amber-900/30',
            iconColor: 'text-amber-600 dark:text-amber-400',
            icon: FlameIcon,
          },
        ].map(({ value, label, iconBg, iconColor, icon: Icon }) => (
          <div
            key={label}
            className="group rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md dark:border-night-border dark:bg-night-card"
          >
            <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-full ${iconBg}`}>
              <Icon className={`h-4 w-4 ${iconColor}`} />
            </div>
            <p className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">{value}</p>
            <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Calendar grid ── */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-night-border dark:bg-night-card">
        {/* Loading overlay */}
        {loadingMonth && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/70 backdrop-blur-sm dark:bg-night-card/70">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-500 dark:border-night-border" />
          </div>
        )}

        {/* Day headers */}
        <div className="mb-3 grid grid-cols-7 gap-2">
          {DAY_HEADERS.map(d => (
            <div key={d} className="py-1 text-center text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              {d}
            </div>
          ))}
        </div>

        {/* Floating day cards */}
        <div className="grid grid-cols-7 gap-2 sm:gap-3">
          {cells.map((day, idx) => {
            const entry = day ? dayDataMap[day] : null
            return (
              <DayCell
                key={idx}
                day={day}
                data={entry}
                isToday={isCurrentMonth && day === today.getDate()}
                target={tdee}
                onClick={day ? () => setSelectedCell({ year, month, day }) : undefined}
              />
            )
          })}
        </div>
      </div>

      {/* ── Colour legend ── */}
      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-all duration-300 dark:border-night-border dark:bg-night-card">
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
      {selectedCell && selectedDayLive && (
        <DayDetailModal
          year={selectedCell.year}
          month={selectedCell.month}
          day={selectedCell.day}
          storedData={selectedDayLive.storedData}
          dayEntry={selectedDayLive.dayEntry}
          onClose={() => setSelectedCell(null)}
        />
      )}

    </section>
  )
}
