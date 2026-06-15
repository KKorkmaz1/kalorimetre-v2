import { useState, useEffect, useMemo } from 'react'
import { DietProvider, useDiet } from './context/DietContext'
import OnboardingWizard from './components/OnboardingWizard'
import History from './components/History'
import Profile from './components/Profile'
import Settings from './components/Settings'
import AddMealModal from './components/AddMealModal'

// ─── SVG icon helpers ─────────────────────────────────────────────────────────

function IconGrid(active) {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  )
}
function IconClock(active) {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}
function IconPerson(active) {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  )
}
function IconCheckIn() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}
function IconXSmall() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
  )
}
function IconCheck() {
  return (
    <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  )
}

// ─── Bottom nav config ────────────────────────────────────────────────────────

const NAV_TABS = [
  { id: 'dashboard', label: 'Ana Panel', icon: IconGrid },
  { id: 'history',   label: 'Geçmiş',   icon: IconClock  },
  { id: 'profile',   label: 'Profil',   icon: IconPerson },
]

// ─── Circular calorie ring ────────────────────────────────────────────────────

function CalorieRing({ consumed, target }) {
  const size = 112
  const sw   = 9
  const r    = (size - sw * 2) / 2
  const C    = 2 * Math.PI * r
  const pct  = target > 0 ? Math.min(1, consumed / target) : 0
  const offset = C * (1 - pct)
  const isOver = consumed > target && target > 0

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--ring-track)" strokeWidth={sw} />
        <circle
          cx={size/2} cy={size/2} r={r}
          fill="none"
          stroke={isOver ? '#ef4444' : '#10B981'}
          strokeWidth={sw}
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={offset}
          style={{ transformOrigin: `${size/2}px ${size/2}px`, transform: 'rotate(-90deg)', transition: 'stroke-dashoffset 0.6s ease-out, stroke 0.3s' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-extrabold leading-none text-slate-900 dark:text-slate-100">
          {consumed.toLocaleString('tr-TR')}
        </span>
        <span className="mt-0.5 text-[10px] font-medium text-slate-400">kcal</span>
        <span className="text-[9px] text-slate-300 dark:text-night-muted">/ {(target || 0).toLocaleString('tr-TR')}</span>
      </div>
    </div>
  )
}

// ─── Macro bar ────────────────────────────────────────────────────────────────

function MacroBar({ label, icon, consumed, target, barColor, labelColor }) {
  const pct  = target > 0 ? Math.min(100, Math.round((consumed / target) * 100)) : 0
  const isOver = consumed > target && target > 0
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className={`flex items-center gap-1.5 text-xs font-semibold ${labelColor}`}>
          {icon}
          {label}
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          <span className={`font-bold ${isOver ? 'text-red-500' : 'text-slate-800 dark:text-slate-200'}`}>{consumed}g</span>
          {' / '}{target}g
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-night-muted">
        <div
          className={`h-full rounded-full transition-all duration-500 ${isOver ? 'bg-red-400' : barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ─── Macro icons (SVG, no emoji) ──────────────────────────────────────────────

const ProteinIcon = (
  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
  </svg>
)
const CarbIcon = (
  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" />
  </svg>
)
const FatIcon = (
  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
  </svg>
)

// ─── Water tracker ────────────────────────────────────────────────────────────

function WaterTracker({ water, onToggle, goal }) {
  return (
    <div className="flex items-center gap-2">
      <svg className="h-4 w-4 flex-shrink-0 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
        <path fillRule="evenodd" d="M11.484 2.17a.75.75 0 011.032 0 11.209 11.209 0 017.877 10.58c0 5.799-4.338 10.5-9.893 10.5-5.554 0-9.893-4.701-9.893-10.5 0-4.368 2.667-8.112 6.503-9.858L11.484 2.17z" clipRule="evenodd" />
      </svg>
      <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Su Takibi</span>
      <div className="ml-auto flex gap-1">
        {Array.from({ length: goal }, (_, i) => (
          <button
            key={i} type="button" aria-label={`${i + 1}. bardak`}
            onClick={() => onToggle(i < water ? i : i + 1)}
            className={`h-3 w-3 cursor-pointer rounded-full transition-all ${
              i < water ? 'bg-blue-500' : 'bg-slate-200 dark:bg-night-muted hover:bg-blue-200 dark:hover:bg-blue-900/40'
            }`}
          />
        ))}
      </div>
      <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{water}/{goal}</span>
    </div>
  )
}

// ─── Planned meal card ────────────────────────────────────────────────────────

const MEAL_SLOTS = [
  {
    id: 'Kahvaltı',
    displayName: 'Kahvaltı',
    pctKcal: 0.23,
    pctProt: 0.20,
    barColor: 'bg-amber-400',
    iconBg: 'bg-amber-50 dark:bg-amber-900/20',
    iconColor: 'text-amber-500',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
      </svg>
    ),
  },
  {
    id: 'Öğle',
    displayName: 'Öğle Yemeği',
    pctKcal: 0.32,
    pctProt: 0.31,
    barColor: 'bg-yellow-400',
    iconBg: 'bg-yellow-50 dark:bg-yellow-900/20',
    iconColor: 'text-yellow-500',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
      </svg>
    ),
  },
  {
    id: 'Akşam',
    displayName: 'Akşam Yemeği',
    pctKcal: 0.30,
    pctProt: 0.34,
    barColor: 'bg-indigo-400',
    iconBg: 'bg-indigo-50 dark:bg-indigo-900/20',
    iconColor: 'text-indigo-500',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
      </svg>
    ),
  },
  {
    id: 'Ara Öğün',
    displayName: 'Ara Öğün',
    pctKcal: 0.15,
    pctProt: 0.15,
    barColor: 'bg-emerald-400',
    iconBg: 'bg-emerald-50 dark:bg-emerald-900/20',
    iconColor: 'text-emerald-500',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
      </svg>
    ),
  },
]

function MealSlotCard({ slot, target, macroTgt, logs, onAdd }) {
  const plannedKcal = Math.round(target * slot.pctKcal)
  const plannedProt = Math.round((macroTgt.protein || 0) * slot.pctProt)
  const actualLogs  = logs.filter(l => l.mealType === slot.id)
  const actualKcal  = actualLogs.reduce((s, l) => s + (l.kcal || 0), 0)
  const pct         = plannedKcal > 0 ? Math.min(100, (actualKcal / plannedKcal) * 100) : 0
  const isDone      = actualKcal >= plannedKcal && plannedKcal > 0

  return (
    <div className={`rounded-2xl border bg-white dark:bg-night-card p-4 shadow-sm transition-all ${
      isDone
        ? 'border-emerald-200 dark:border-emerald-800/40'
        : 'border-slate-100 dark:border-night-border'
    }`}>
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${slot.iconBg}`}>
          <span className={slot.iconColor}>{slot.icon}</span>
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-extrabold text-slate-900 dark:text-slate-100">{slot.displayName}</p>
            {isDone && (
              <span className="flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                <IconCheck />
                Tamam
              </span>
            )}
          </div>
          {target > 0 && (
            <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
              Önerilen: {plannedKcal} kcal,{' '}
              <span className="text-indigo-500 font-semibold">{plannedProt}g Protein</span>
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-shrink-0 items-center gap-2">
          {/* Camera — mock OCR */}
          <button
            type="button"
            title="Fotoğrafla kaydet (yakında)"
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl bg-slate-100 dark:bg-night-muted text-slate-400 dark:text-slate-500 transition-colors hover:bg-slate-200 dark:hover:bg-night-border"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
            </svg>
          </button>
          {/* Alternatives — mock AI */}
          <button
            type="button"
            title="Alternatif öner (yakında)"
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl bg-slate-100 dark:bg-night-muted text-slate-400 dark:text-slate-500 transition-colors hover:bg-slate-200 dark:hover:bg-night-border"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          </button>
          {/* Add */}
          <button
            type="button"
            onClick={() => onAdd(slot.id)}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl bg-emerald-500 text-white shadow-sm shadow-emerald-500/30 transition-all hover:bg-emerald-600 active:scale-95"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>

      {/* Progress bar */}
      {target > 0 && (
        <div className="mt-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-night-muted">
            <div
              className={`h-full rounded-full transition-all duration-500 ${isDone ? 'bg-emerald-400' : slot.barColor}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-1 text-[10px] font-semibold text-slate-400 dark:text-slate-500 text-right">
            {actualKcal} / {plannedKcal} kcal
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Individual food log item ─────────────────────────────────────────────────

function LogItem({ log, onDelete }) {
  const MEAL_META = {
    Kahvaltı:   { bg: 'bg-amber-50 dark:bg-amber-900/20',    badge: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400'    },
    Öğle:       { bg: 'bg-yellow-50 dark:bg-yellow-900/20',   badge: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400'  },
    Akşam:      { bg: 'bg-indigo-50 dark:bg-indigo-900/20',   badge: 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400'  },
    'Ara Öğün': { bg: 'bg-emerald-50 dark:bg-emerald-900/20', badge: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400' },
  }
  const meta = MEAL_META[log.mealType] ?? MEAL_META['Ara Öğün']
  const hasExtras = log.protein > 0 || log.carbs > 0 || log.fat > 0

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-100 dark:border-night-border bg-white dark:bg-night-card px-4 py-3 shadow-sm transition-all hover:shadow-md">
      <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${meta.bg}`}>
        <span className={`rounded-md px-1 py-0.5 text-[9px] font-extrabold ${meta.badge}`}>
          {log.mealType.slice(0, 2).toUpperCase()}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">{log.name}</p>
        {hasExtras && (
          <p className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500">
            <span className="font-semibold text-indigo-500">P</span> {log.protein}g ·{' '}
            <span className="font-semibold text-amber-500">K</span> {log.carbs}g ·{' '}
            <span className="font-semibold text-rose-400">Y</span> {log.fat}g
          </p>
        )}
      </div>
      <div className="flex flex-shrink-0 flex-col items-end gap-1">
        <span className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
          <span className="text-emerald-600 dark:text-emerald-400">⚡</span> {log.kcal}
        </span>
        <button
          type="button" onClick={() => onDelete(log.id)}
          className="flex h-5 w-5 cursor-pointer items-center justify-center rounded-full text-slate-300 dark:text-night-muted transition-colors hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-400"
          aria-label="Sil"
        >
          <IconXSmall />
        </button>
      </div>
    </div>
  )
}

// ─── Dashboard view ───────────────────────────────────────────────────────────

function DashboardView({ onAddMeal }) {
  const { profile, consumed, logs, water, deleteLog, setWater } = useDiet()

  const baseTDEE  = profile?.tdee || 0
  const rawTarget = baseTDEE > 0 ? baseTDEE + (profile.goalOffset ?? 0) : 0
  const target    = rawTarget > 0 ? Math.max(1200, rawTarget) : (Number(profile?.dailyGoal) || 0)
  const macroTgt  = profile?.macros ?? { protein: 0, carbs: 0, fat: 0 }
  const waterGoal = profile?.waterGoal ?? 8
  const remaining = Math.max(0, target - consumed.kcal)

  let aiMessage
  if (!target) {
    aiMessage = 'Profilinizi tamamlayın, kalori hedefinizi belirleyelim.'
  } else if (consumed.kcal === 0) {
    const h = new Date().getHours()
    const greeting = h < 12 ? 'Günaydın' : h < 18 ? 'İyi öğleden sonra' : 'İyi akşamlar'
    aiMessage = `${greeting}! Bugün ${target.toLocaleString('tr-TR')} kcal hedefiniz var. İlk öğününüzü ekleyin.`
  } else if (consumed.kcal > target) {
    aiMessage = 'Günlük kalori hedefinizi aştınız. Akşam hafif ve protein ağırlıklı beslenmenizi öneririz.'
  } else if (remaining < target * 0.2) {
    aiMessage = `Hedefinize çok yakınsınız! Kalan ${remaining.toLocaleString('tr-TR')} kcal için hafif bir atıştırmalık idealdir.`
  } else {
    aiMessage = `${remaining.toLocaleString('tr-TR')} kcal kaldı. Öğünlerinizi dengelemek için protein ağırlıklı beslenin.`
  }

  const dateLabel = new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <section className="space-y-4">

      {/* Header */}
      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">{dateLabel}</p>
        <h1 className="mt-0.5 text-2xl font-extrabold text-slate-900 dark:text-slate-100">Ana Panel</h1>
      </header>

      {/* AI suggestion card */}
      <div className="rounded-2xl border border-emerald-100 dark:border-emerald-900/40 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 p-4 shadow-sm">
        <div className="mb-2 flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500 shadow-sm shadow-emerald-500/30">
            <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" d="M14.615 1.595a.75.75 0 01.359.852L12.982 9.75h7.268a.75.75 0 01.548 1.262l-10.5 11.25a.75.75 0 01-1.272-.71l1.992-7.302H3.818a.75.75 0 01-.548-1.262l10.5-11.25a.75.75 0 01.845-.143z" clipRule="evenodd" />
            </svg>
          </div>
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
            Yapay Zeka Tavsiyesi
          </span>
          <span className="ml-auto rounded-full bg-emerald-500 px-2 py-0.5 text-[9px] font-bold text-white">CANLI</span>
        </div>
        <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">{aiMessage}</p>
        {target > 0 && (
          <div className="mt-2.5 flex gap-4">
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              ⚡ {remaining.toLocaleString('tr-TR')} kcal kalan
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Öğün: {logs.length} kayıt
            </span>
          </div>
        )}
      </div>

      {/* Main progress card */}
      <div className="rounded-2xl border border-slate-100 dark:border-night-border bg-white dark:bg-night-card p-5 shadow-sm">
        <div className="flex items-center gap-4">
          <CalorieRing consumed={consumed.kcal} target={target} />
          <div className="min-w-0 flex-1">
            <p className="text-2xl font-extrabold leading-none text-slate-900 dark:text-slate-100">
              {remaining.toLocaleString('tr-TR')}
              <span className="ml-1 text-sm font-medium text-slate-400 dark:text-slate-500">kcal kalan</span>
            </p>
            <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1">
              <div>
                <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500">Yağılan</p>
                <p className="text-base font-extrabold text-slate-800 dark:text-slate-100">
                  {consumed.kcal.toLocaleString('tr-TR')}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500">Hedef</p>
                <p className="text-base font-extrabold text-slate-800 dark:text-slate-100">
                  {(target || 0).toLocaleString('tr-TR')}
                </p>
              </div>
            </div>
          </div>
        </div>

        {macroTgt.protein > 0 && (
          <div className="mt-4 space-y-3">
            <MacroBar label="Protein"      icon={ProteinIcon} consumed={consumed.protein} target={macroTgt.protein} barColor="bg-indigo-500" labelColor="text-indigo-600 dark:text-indigo-400" />
            <MacroBar label="Karbonhidrat" icon={CarbIcon}    consumed={consumed.carbs}   target={macroTgt.carbs}   barColor="bg-amber-500"  labelColor="text-amber-600 dark:text-amber-400"  />
            <MacroBar label="Yağ"          icon={FatIcon}     consumed={consumed.fat}     target={macroTgt.fat}     barColor="bg-rose-500"   labelColor="text-rose-500 dark:text-rose-400"    />
          </div>
        )}

        <div className="mt-4 border-t border-slate-100 dark:border-night-border pt-4">
          <WaterTracker water={water} onToggle={setWater} goal={waterGoal} />
        </div>
      </div>

      {/* ── PLANNED MEAL SLOTS (ÖĞÜNLER) ── */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">Öğünler</h2>
          <button
            type="button"
            onClick={() => onAddMeal(null)}
            className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-1.5 text-xs font-extrabold text-white shadow-sm shadow-emerald-500/30 transition-all hover:bg-emerald-600 hover:shadow-md active:scale-95"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Öğün Ekle
          </button>
        </div>

        <div className="space-y-3">
          {MEAL_SLOTS.map(slot => (
            <MealSlotCard
              key={slot.id}
              slot={slot}
              target={target}
              macroTgt={macroTgt}
              logs={logs}
              onAdd={(mealType) => onAddMeal(mealType)}
            />
          ))}
        </div>
      </div>

      {/* Today's individual logs (collapsed summary) */}
      {logs.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-extrabold text-slate-800 dark:text-slate-200">Bugünün Kayıtları</h2>
          <div className="space-y-2">
            {logs.map(log => (
              <LogItem key={log.id} log={log} onDelete={deleteLog} />
            ))}
            <div className="flex items-center justify-between rounded-2xl bg-slate-50 dark:bg-night-muted px-4 py-3">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Günlük Toplam</span>
              <span className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                <span className="text-emerald-500">⚡</span> {consumed.kcal.toLocaleString('tr-TR')} kcal
              </span>
            </div>
          </div>
        </div>
      )}

    </section>
  )
}

// ─── Check-in Bottom Sheet ────────────────────────────────────────────────────

function CheckInSheet({ onClose }) {
  const { profile, updateProfile } = useDiet()

  const [weight, setWeight] = useState('')
  const [fat,    setFat]    = useState('')
  const [phase,  setPhase]  = useState('input')

  const bodyComp  = profile?.bodyComp ?? {}
  const history   = profile?.bodyCompHistory ?? []
  const prev      = history.length > 0 ? history[history.length - 1] : null

  const startWeight   = Number(bodyComp.startingWeight || 0)
  const goalWeight    = Number(profile?.goalWeight || 0)
  const currentWeight = Number(weight) || Number(bodyComp.currentWeight || 0)

  // Goal progress
  const goalPct = useMemo(() => {
    if (!startWeight || !goalWeight || startWeight === goalWeight) return 0
    const done = Math.abs(startWeight - currentWeight)
    const total = Math.abs(startWeight - goalWeight)
    return Math.min(100, Math.round((done / total) * 100))
  }, [startWeight, goalWeight, currentWeight])

  function handleSave() {
    const snap = {
      date:   new Date().toISOString().slice(0, 10),
      weight: Number(weight) || 0,
      fat:    Number(fat)    || 0,
      muscle: Number(bodyComp.currentMuscle || 0),
    }
    const existingHistory = profile?.bodyCompHistory ?? []
    const todayIdx = existingHistory.findIndex(s => s.date === snap.date)
    const newHistory = todayIdx >= 0
      ? existingHistory.map((s, i) => i === todayIdx ? snap : s)
      : [...existingHistory, snap]

    updateProfile({
      ...profile,
      bodyComp: {
        startingWeight: bodyComp.startingWeight ?? snap.weight,
        currentWeight:  snap.weight,
        startingFat:    bodyComp.startingFat    ?? snap.fat,
        currentFat:     snap.fat,
        startingMuscle: bodyComp.startingMuscle ?? 0,
        currentMuscle:  bodyComp.currentMuscle  ?? 0,
        lastUpdated:    snap.date,
      },
      bodyCompHistory: newHistory.slice(-90),
    })
    setPhase('done')
  }

  const canSave = weight

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-app rounded-t-3xl bg-white dark:bg-night-card shadow-2xl animate-slide-up">

        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-slate-200 dark:bg-night-muted" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-3 pb-4">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
              {phase === 'done' ? 'Check-in Tamamlandı!' : 'Periyodik Check-in'}
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
              {phase === 'done'
                ? new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
                : 'Güncel ölçümlerinizi girin'}
            </p>
          </div>
          <button
            type="button" onClick={onClose}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-slate-100 dark:bg-night-muted text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-night-border transition-colors"
          >
            <IconXSmall />
          </button>
        </div>

        <div className="px-5 pb-10 space-y-4">

          {phase === 'input' && (
            <>
              {/* Previous hint */}
              {prev && (
                <div className="rounded-2xl bg-slate-50 dark:bg-night-muted px-4 py-3">
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    Önceki · {prev.date}
                  </p>
                  <div className="flex gap-4">
                    {prev.weight > 0 && <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">{prev.weight} kg</span>}
                    {prev.fat    > 0 && <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">%{prev.fat} Yağ</span>}
                  </div>
                </div>
              )}

              {/* Inputs */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { val: weight, set: setWeight, label: 'Yeni Kilo', unit: 'kg', placeholder: prev?.weight ? String(prev.weight) : '70.0' },
                  { val: fat,    set: setFat,    label: 'Yağ Oranı', unit: '%',  placeholder: prev?.fat    ? String(prev.fat)    : '20'   },
                ].map(({ val, set, label, unit, placeholder }) => (
                  <div
                    key={label}
                    className={`rounded-2xl border-2 px-4 py-3 transition-all ${
                      val ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20' : 'border-slate-200 dark:border-night-border bg-white dark:bg-night-card'
                    }`}
                  >
                    <label className="block text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500">{label}</label>
                    <div className="flex items-baseline gap-0.5">
                      <input
                        type="number" inputMode="decimal" min="0" step="0.1"
                        value={val}
                        onChange={e => set(e.target.value)}
                        placeholder={placeholder}
                        className="w-full bg-transparent text-2xl font-extrabold text-slate-900 dark:text-slate-100 outline-none placeholder:text-slate-200 dark:placeholder:text-night-muted"
                      />
                      <span className="text-sm font-semibold text-slate-400 dark:text-slate-500">{unit}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Hedef İlerlemesi */}
              {startWeight > 0 && goalWeight > 0 && (
                <div className="rounded-2xl border border-slate-100 dark:border-night-border bg-white dark:bg-night-card p-4 shadow-sm">
                  <p className="mb-3 text-[10px] font-extrabold uppercase tracking-wide text-slate-400 dark:text-slate-500">Hedef İlerlemesi</p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 dark:text-slate-400">Başlangıç</span>
                      <span className="font-bold text-slate-700 dark:text-slate-300">{startWeight} kg</span>
                    </div>
                    <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-night-muted">
                      <div
                        style={{ width: `${goalPct}%` }}
                        className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">%{goalPct} tamamlandı</span>
                      <span className="text-slate-500 dark:text-slate-400">Hedef: {goalWeight} kg</span>
                    </div>
                  </div>
                </div>
              )}

              <button
                type="button" onClick={handleSave}
                disabled={!canSave}
                className={`w-full rounded-2xl py-4 text-sm font-extrabold text-white shadow-xl transition-all active:scale-95 ${
                  canSave ? 'cursor-pointer bg-emerald-500 shadow-emerald-200/40 hover:bg-emerald-600' : 'cursor-not-allowed bg-slate-200 dark:bg-night-muted text-slate-400 shadow-none'
                }`}
              >
                Kaydet
              </button>
            </>
          )}

          {phase === 'done' && (
            <>
              <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-900/20 p-4">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500 shadow-md shadow-emerald-200/50">
                  <IconCheck />
                </div>
                <div>
                  <p className="text-sm font-bold text-emerald-800 dark:text-emerald-400">Check-in kaydedildi!</p>
                  <p className="mt-0.5 text-xs text-emerald-600 dark:text-emerald-500">
                    {weight && `${weight} kg`}{fat && ` · %${fat} yağ`}
                  </p>
                </div>
              </div>
              <button
                type="button" onClick={onClose}
                className="w-full cursor-pointer rounded-2xl bg-slate-900 dark:bg-slate-100 py-4 text-sm font-extrabold text-white dark:text-slate-900 transition-all hover:opacity-90 active:scale-95"
              >
                Kapat
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main app shell ───────────────────────────────────────────────────────────

function MainApp() {
  const [activeTab,     setActiveTab]     = useState('dashboard')
  const [showModal,     setShowModal]     = useState(false)
  const [defaultMeal,   setDefaultMeal]   = useState(null)
  const [showCheckIn,   setShowCheckIn]   = useState(false)

  function openAddMeal(mealType = null) {
    setDefaultMeal(mealType)
    setShowModal(true)
  }

  function renderView() {
    switch (activeTab) {
      case 'dashboard': return <DashboardView onAddMeal={openAddMeal} />
      case 'history':   return <History />
      case 'profile':   return <Profile />
      case 'settings':  return <Settings />
      default:          return <DashboardView onAddMeal={openAddMeal} />
    }
  }

  return (
    <div className="min-h-svh bg-slate-50 dark:bg-night-bg">

      {/* ── Desktop sidebar ── */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-20 lg:flex lg:w-64 lg:flex-col border-r border-slate-200 dark:border-night-border bg-white dark:bg-night-card">
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-100 dark:border-night-border px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 shadow-sm shadow-emerald-500/30">
            <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" d="M14.615 1.595a.75.75 0 01.359.852L12.982 9.75h7.268a.75.75 0 01.548 1.262l-10.5 11.25a.75.75 0 01-1.272-.71l1.992-7.302H3.818a.75.75 0 01-.548-1.262l10.5-11.25a.75.75 0 01.845-.143z" clipRule="evenodd" />
            </svg>
          </div>
          <span className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-slate-100">Kalorimetre</span>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-4 py-5">
          {[
            { id: 'dashboard', label: 'Ana Panel', icon: IconGrid },
            { id: 'history',   label: 'Geçmiş',   icon: IconClock  },
            { id: 'profile',   label: 'Profil',   icon: IconPerson },
            { id: 'settings',  label: 'Ayarlar',  icon: (a) => (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a ? 2.2 : 1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            ) },
          ].map(({ id, label, icon }) => {
            const active = activeTab === id
            return (
              <button key={id} type="button" onClick={() => setActiveTab(id)}
                className={`flex cursor-pointer items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition-all ${
                  active
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-night-muted hover:text-slate-900 dark:hover:text-slate-200'
                }`}>
                {icon(active)}
                {label}
                {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-500" />}
              </button>
            )
          })}

          {/* Desktop Check-in button */}
          <div className="mt-2 border-t border-slate-100 dark:border-night-border pt-2">
            <button
              type="button"
              onClick={() => setShowCheckIn(true)}
              className="flex w-full cursor-pointer items-center gap-3 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-bold text-white shadow-sm shadow-emerald-500/30 transition-all hover:bg-emerald-600 active:scale-95"
            >
              <IconCheckIn />
              Check-in
            </button>
          </div>
        </nav>

        <div className="border-t border-slate-100 dark:border-night-border px-6 py-4">
          <p className="text-[10px] text-slate-400 dark:text-slate-600 font-medium">Kalorimetre v1.0 · AI Destekli</p>
        </div>
      </aside>

      {/* ── Page content ── */}
      <div className="lg:pl-64">
        <main className="mx-auto max-w-app px-4 pb-28 pt-6 lg:max-w-2xl lg:px-8 lg:pb-10 lg:pt-8">
          {renderView()}
        </main>
      </div>

      {/* ── Mobile bottom nav (4 tabs) ── */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-10 border-t border-slate-200 dark:border-night-border bg-white/95 dark:bg-night-card/95 shadow-2xl backdrop-blur-sm lg:hidden"
        aria-label="Ana menü"
      >
        <ul className="grid grid-cols-4">
          {/* Regular tabs */}
          {NAV_TABS.map(({ id, label, icon }) => {
            const active = activeTab === id
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => setActiveTab(id)}
                  aria-current={active ? 'page' : undefined}
                  className={`flex w-full cursor-pointer flex-col items-center gap-1 py-2.5 text-[10px] font-semibold transition-colors ${
                    active
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                  }`}
                >
                  {icon(active)}
                  <span>{label}</span>
                  {active && <span className="h-0.5 w-4 rounded-full bg-emerald-500" aria-hidden="true" />}
                </button>
              </li>
            )
          })}

          {/* Check-in action tab */}
          <li>
            <button
              type="button"
              onClick={() => setShowCheckIn(true)}
              className="flex w-full cursor-pointer flex-col items-center gap-1 py-2.5 text-[10px] font-semibold text-slate-400 dark:text-slate-500 transition-colors hover:text-emerald-600 dark:hover:text-emerald-400"
            >
              <span className="relative">
                <IconCheckIn />
                <span className="absolute -right-1 -top-0.5 h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span>Check-in</span>
            </button>
          </li>
        </ul>
      </nav>

      {/* ── Modals ── */}
      <AddMealModal isOpen={showModal} onClose={() => setShowModal(false)} defaultMealType={defaultMeal} />
      {showCheckIn && <CheckInSheet onClose={() => setShowCheckIn(false)} />}
    </div>
  )
}

// ─── App content ──────────────────────────────────────────────────────────────

function AppContent() {
  const { profile, updateProfile } = useDiet()

  useEffect(() => {
    const theme = profile?.theme ?? 'light'
    const isDark = theme === 'dark' || theme === 'amoled'
    document.documentElement.classList.toggle('dark', isDark)
    if (theme === 'amoled') {
      document.body.style.backgroundColor = '#000000'
    } else if (theme === 'dark') {
      document.body.style.backgroundColor = '#0C0F1A'
    } else {
      document.body.style.backgroundColor = ''
    }
  }, [profile?.theme])

  if (profile === undefined) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-white dark:bg-night-bg">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 dark:border-night-border border-t-emerald-500" />
      </div>
    )
  }

  if (profile === null) return <OnboardingWizard onComplete={updateProfile} />

  return <MainApp />
}

export default function App() {
  return (
    <DietProvider>
      <AppContent />
    </DietProvider>
  )
}
