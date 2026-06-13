import { useState } from 'react'
import { DietProvider, useDiet } from './context/DietContext'
import OnboardingWizard from './components/OnboardingWizard'
import History from './components/History'
import Profile from './components/Profile'
import Settings from './components/Settings'
import AddMealModal from './components/AddMealModal'

// ─── SVG primitives ───────────────────────────────────────────────────────────

function CheckSmall() {
  return (
    <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  )
}

function XSmall() {
  return (
    <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
  )
}

// ─── Bottom navigation config (5 tabs) ───────────────────────────────────────

const NAV_ITEMS = [
  {
    id: 'dashboard',
    label: 'Panel',
    icon: (active) => (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
  },
  {
    id: 'history',
    label: 'Geçmiş',
    icon: (active) => (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    // Special tab: opens the modal directly instead of navigating
    id: 'add-food',
    label: 'Ekle',
    isAction: true,
    icon: () => (
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500 shadow-lg shadow-emerald-200 transition-all active:scale-90">
        <svg className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
        </svg>
      </div>
    ),
  },
  {
    id: 'profile',
    label: 'Profil',
    icon: (active) => (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      </svg>
    ),
  },
  {
    id: 'settings',
    label: 'Ayarlar',
    icon: (active) => (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
]

// ─── Dashboard sub-components ─────────────────────────────────────────────────

/**
 * SVG circular progress ring.
 * Starts from 12 o'clock; green arc for normal, red when over target.
 */
function CalorieRing({ consumed, target }) {
  const size = 112
  const sw   = 9
  const r    = (size - sw * 2) / 2          // 47
  const C    = 2 * Math.PI * r              // ~295
  const pct  = target > 0 ? Math.min(1, consumed / target) : 0
  const offset = C * (1 - pct)
  const isOver = consumed > target && target > 0
  const arcColor = isOver ? '#ef4444' : '#10B981'

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        {/* Background track */}
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={sw} />
        {/* Progress arc — rotated so 0% starts at top */}
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke={arcColor}
          strokeWidth={sw}
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={offset}
          style={{
            transformOrigin: `${size / 2}px ${size / 2}px`,
            transform: 'rotate(-90deg)',
            transition: 'stroke-dashoffset 0.6s ease-out, stroke 0.3s',
          }}
        />
      </svg>
      {/* Center label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-extrabold leading-none text-slate-900">
          {consumed.toLocaleString('tr-TR')}
        </span>
        <span className="mt-0.5 text-[10px] font-medium text-slate-400">kcal</span>
        <span className="text-[9px] text-slate-300">/ {(target || 0).toLocaleString('tr-TR')}</span>
      </div>
    </div>
  )
}

/** Linear macro progress bar */
function MacroBar({ label, consumed, target, barColor, labelColor }) {
  const pct   = target > 0 ? Math.min(100, Math.round((consumed / target) * 100)) : 0
  const isOver = consumed > target && target > 0
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className={`text-xs font-semibold ${labelColor}`}>{label}</span>
        <span className="text-xs text-slate-500">
          <span className={`font-bold ${isOver ? 'text-red-500' : 'text-slate-800'}`}>{consumed}g</span>
          {' / '}{target}g
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all duration-500 ${isOver ? 'bg-red-400' : barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

/** Clickable water-glass dots */
function WaterTracker({ water, onToggle, goal }) {
  return (
    <div className="flex items-center gap-2">
      <svg className="h-4 w-4 flex-shrink-0 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
        <path fillRule="evenodd" d="M11.484 2.17a.75.75 0 011.032 0 11.209 11.209 0 017.877 10.58c0 5.799-4.338 10.5-9.893 10.5-5.554 0-9.893-4.701-9.893-10.5 0-4.368 2.667-8.112 6.503-9.858L11.484 2.17z" clipRule="evenodd" />
      </svg>
      <span className="text-xs font-semibold text-slate-600">Su Takibi</span>
      <div className="ml-auto flex gap-1">
        {Array.from({ length: goal }, (_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`${i + 1}. bardak`}
            onClick={() => onToggle(i < water ? i : i + 1)}
            className={`h-3 w-3 rounded-full transition-all ${
              i < water ? 'bg-blue-500' : 'bg-slate-200 hover:bg-blue-200'
            }`}
          />
        ))}
      </div>
      <span className="text-xs font-bold text-slate-500">{water}/{goal}</span>
    </div>
  )
}

/** Meal type colour map */
const MEAL_META = {
  Kahvaltı:  { bg: 'bg-amber-50',   badge: 'bg-amber-100 text-amber-700'   },
  Öğle:      { bg: 'bg-emerald-50', badge: 'bg-emerald-100 text-emerald-700' },
  Akşam:     { bg: 'bg-purple-50',  badge: 'bg-purple-100 text-purple-700'  },
  'Ara Öğün':{ bg: 'bg-blue-50',    badge: 'bg-blue-100 text-blue-700'      },
}

/** Single food-log card */
function LogItem({ log, onDelete }) {
  const meta = MEAL_META[log.mealType] ?? MEAL_META['Ara Öğün']
  const hasExtras = log.protein > 0 || log.carbs > 0 || log.fat > 0

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
      {/* Coloured type indicator */}
      <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${meta.bg}`}>
        <span className={`rounded-md px-1 py-0.5 text-[9px] font-extrabold ${meta.badge}`}>
          {log.mealType.slice(0, 2).toUpperCase()}
        </span>
      </div>

      {/* Name + macros */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-slate-800">{log.name}</p>
        {hasExtras && (
          <p className="mt-0.5 text-[10px] text-slate-400">
            P {log.protein}g · K {log.carbs}g · Y {log.fat}g
          </p>
        )}
      </div>

      {/* Kcal + delete */}
      <div className="flex flex-shrink-0 flex-col items-end gap-1">
        <span className="text-sm font-extrabold text-slate-800">{log.kcal} kcal</span>
        <button
          type="button"
          onClick={() => onDelete(log.id)}
          className="flex h-5 w-5 items-center justify-center rounded-full text-slate-300 transition-colors hover:bg-red-50 hover:text-red-400"
          aria-label="Sil"
        >
          <XSmall />
        </button>
      </div>
    </div>
  )
}

// ─── Dashboard view ───────────────────────────────────────────────────────────

function DashboardView({ onAddMeal }) {
  const { profile, consumed, logs, water, deleteLog, setWater } = useDiet()

  const target     = profile ? ((profile.tdee ?? 0) + (profile.goalOffset ?? 0)) : 0
  const macroTgt   = profile?.macros ?? { protein: 0, carbs: 0, fat: 0 }
  const waterGoal  = profile?.waterGoal ?? 8
  const remaining  = Math.max(0, target - consumed.kcal)

  // Reactive AI message
  let aiMessage
  if (!target) {
    aiMessage = 'Profilinizi tamamlayın, kalori hedefinizi belirleyelim.'
  } else if (consumed.kcal === 0) {
    const d = new Date()
    const greeting = d.getHours() < 12 ? 'Günaydın' : d.getHours() < 18 ? 'İyi öğleden sonra' : 'İyi akşamlar'
    aiMessage = `${greeting}! Bugün ${target.toLocaleString('tr-TR')} kcal hedefiniz var. İlk öğününüzü ekleyin.`
  } else if (consumed.kcal > target) {
    aiMessage = `Günlük kalori hedefinizi aştınız. Akşam hafif ve protein ağırlıklı beslenmenizi öneririz.`
  } else if (remaining < target * 0.2) {
    aiMessage = `Hedefinize çok yakınsınız! Kalan ${remaining.toLocaleString('tr-TR')} kcal için hafif bir atıştırmalık idealdir.`
  } else {
    aiMessage = `${remaining.toLocaleString('tr-TR')} kcal kaldı. Öğünlerinizi dengelemek için protein ağırlıklı beslenin.`
  }

  const dateLabel = new Date().toLocaleDateString('tr-TR', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  return (
    <section className="space-y-4">

      {/* Header */}
      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">{dateLabel}</p>
        <h1 className="mt-0.5 text-2xl font-extrabold text-slate-900">Ana Panel</h1>
      </header>

      {/* AI suggestion card */}
      <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-teal-50 p-4 shadow-sm">
        <div className="mb-2 flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500 shadow-sm shadow-emerald-200">
            <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" d="M14.615 1.595a.75.75 0 01.359.852L12.982 9.75h7.268a.75.75 0 01.548 1.262l-10.5 11.25a.75.75 0 01-1.272-.71l1.992-7.302H3.818a.75.75 0 01-.548-1.262l10.5-11.25a.75.75 0 01.845-.143z" clipRule="evenodd" />
            </svg>
          </div>
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-700">
            Yapay Zeka Tavsiyesi
          </span>
          <span className="ml-auto rounded-full bg-emerald-500 px-2 py-0.5 text-[9px] font-bold text-white">
            CANLI
          </span>
        </div>
        <p className="text-sm leading-relaxed text-slate-700">{aiMessage}</p>
        {target > 0 && (
          <div className="mt-2.5 flex gap-4">
            <span className="text-xs font-semibold text-emerald-600">
              ⚡ {remaining.toLocaleString('tr-TR')} kcal kalan
            </span>
            <span className="text-xs text-slate-500">
              Öğün: {logs.length} kayıt
            </span>
          </div>
        )}
      </div>

      {/* ── Main progress card ── */}
      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">

        {/* Ring + stats row */}
        <div className="flex items-center gap-4">
          <CalorieRing consumed={consumed.kcal} target={target} />

          <div className="flex-1 min-w-0">
            <p className="text-2xl font-extrabold text-slate-900 leading-none">
              {remaining.toLocaleString('tr-TR')}
              <span className="ml-1 text-sm font-medium text-slate-400">kcal kalan</span>
            </p>
            <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1">
              <div>
                <p className="text-[10px] font-medium text-slate-400">Yağılan</p>
                <p className="text-base font-extrabold text-slate-800">
                  {consumed.kcal.toLocaleString('tr-TR')}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-medium text-slate-400">Hedef</p>
                <p className="text-base font-extrabold text-slate-800">
                  {(target || 0).toLocaleString('tr-TR')}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Macro bars — only render when target macros are set */}
        {macroTgt.protein > 0 && (
          <div className="mt-4 space-y-3">
            <MacroBar
              label="Protein"      consumed={consumed.protein} target={macroTgt.protein}
              barColor="bg-blue-500"  labelColor="text-blue-600"
            />
            <MacroBar
              label="Karbonhidrat" consumed={consumed.carbs}   target={macroTgt.carbs}
              barColor="bg-amber-500" labelColor="text-amber-600"
            />
            <MacroBar
              label="Yağ"          consumed={consumed.fat}     target={macroTgt.fat}
              barColor="bg-red-400"   labelColor="text-red-500"
            />
          </div>
        )}

        {/* Water tracker */}
        <div className="mt-4 border-t border-slate-100 pt-4">
          <WaterTracker water={water} onToggle={setWater} goal={waterGoal} />
        </div>
      </div>

      {/* Today's meal list */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-slate-800">Bugünün Öğünleri</h2>
          <button
            type="button"
            onClick={onAddMeal}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-1.5 text-xs font-extrabold text-white shadow-sm shadow-emerald-200 transition-all hover:bg-emerald-600 active:scale-95"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Öğün Ekle
          </button>
        </div>

        {logs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
              <svg className="h-6 w-6 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-slate-700">Henüz öğün yok</p>
            <p className="mt-1 text-xs text-slate-400">Yukarıdaki "Öğün Ekle" butonunu kullanın</p>
          </div>
        ) : (
          <div className="space-y-2">
            {logs.map(log => (
              <LogItem key={log.id} log={log} onDelete={deleteLog} />
            ))}
            {/* Daily total footer */}
            <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
              <span className="text-xs font-bold text-slate-500">Günlük Toplam</span>
              <span className="text-sm font-extrabold text-slate-900">
                {consumed.kcal.toLocaleString('tr-TR')} kcal
              </span>
            </div>
          </div>
        )}
      </div>

    </section>
  )
}

// ─── Log Food view ────────────────────────────────────────────────────────────

function LogFoodView({ onAddMeal }) {
  const { logs, deleteLog, consumed } = useDiet()

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">Kayıt</p>
          <h1 className="mt-1 text-2xl font-extrabold text-slate-900">Yemek Ekle</h1>
        </div>
        {/* FAB-style add button */}
        <button
          type="button"
          onClick={onAddMeal}
          className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-200 transition-all hover:bg-emerald-600 active:scale-95"
          aria-label="Öğün ekle"
        >
          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
        </button>
      </header>

      {logs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50">
            <svg className="h-7 w-7 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-slate-700">Bugün henüz kayıt yok</p>
          <p className="mt-1 text-xs text-slate-400">Sağ üstteki "+" butonunu kullanın</p>
          <button
            type="button"
            onClick={onAddMeal}
            className="mt-4 rounded-2xl bg-emerald-500 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-200 transition-all hover:bg-emerald-600 active:scale-95"
          >
            İlk Öğünü Ekle
          </button>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {logs.map(log => (
              <LogItem key={log.id} log={log} onDelete={deleteLog} />
            ))}
          </div>
          {/* Day total summary */}
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-600">Günlük Toplam</p>
            <div className="mt-2 grid grid-cols-4 gap-2 text-center">
              {[
                { label: 'Kalori',  value: consumed.kcal,    unit: 'kcal', color: 'text-emerald-700' },
                { label: 'Protein', value: consumed.protein, unit: 'g',    color: 'text-blue-600'    },
                { label: 'Karb',    value: consumed.carbs,   unit: 'g',    color: 'text-amber-600'   },
                { label: 'Yağ',     value: consumed.fat,     unit: 'g',    color: 'text-red-500'     },
              ].map(({ label, value, unit, color }) => (
                <div key={label} className="rounded-xl bg-white py-2 shadow-sm">
                  <p className={`text-lg font-extrabold ${color}`}>{value}</p>
                  <p className="text-[10px] text-slate-400">{unit}</p>
                  <p className="text-[10px] font-medium text-slate-500">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  )
}

// ─── Main app shell ───────────────────────────────────────────────────────────

function MainApp() {
  const [activeTab,  setActiveTab]  = useState('dashboard')
  const [showModal,  setShowModal]  = useState(false)

  function renderView() {
    switch (activeTab) {
      case 'dashboard': return <DashboardView onAddMeal={() => setShowModal(true)} />
      case 'history':   return <History />
      case 'profile':   return <Profile />
      case 'settings':  return <Settings />
      default:          return <DashboardView onAddMeal={() => setShowModal(true)} />
    }
  }

  return (
    <div className="mx-auto flex min-h-svh max-w-app flex-col bg-slate-50">
      <main className="flex-1 px-4 pb-28 pt-6">
        {renderView()}
      </main>

      {/* 5-item bottom nav */}
      <nav
        className="fixed bottom-0 left-1/2 z-10 w-full max-w-app -translate-x-1/2 border-t border-slate-100 bg-white/95 shadow-2xl backdrop-blur-sm"
        aria-label="Ana menü"
      >
        <ul className="grid grid-cols-5">
          {NAV_ITEMS.map(({ id, label, icon, isAction }) => {
            const active = !isAction && activeTab === id
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => isAction ? setShowModal(true) : setActiveTab(id)}
                  aria-current={active ? 'page' : undefined}
                  className={`flex w-full flex-col items-center gap-1 py-2.5 text-[10px] font-semibold transition-colors ${
                    isAction
                      ? 'text-emerald-600'
                      : active
                        ? 'text-emerald-600'
                        : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {icon(active)}
                  <span className={isAction ? 'text-emerald-600 font-bold' : ''}>{label}</span>
                  {active && <span className="h-0.5 w-4 rounded-full bg-emerald-500" aria-hidden="true" />}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Global add-meal bottom sheet */}
      <AddMealModal isOpen={showModal} onClose={() => setShowModal(false)} />
    </div>
  )
}

// ─── App content — reads profile from context ─────────────────────────────────

function AppContent() {
  const { profile, updateProfile } = useDiet()

  // undefined = context is still hydrating from localStorage
  if (profile === undefined) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-500" />
      </div>
    )
  }

  // null = new user, no profile saved yet
  if (profile === null) {
    return <OnboardingWizard onComplete={updateProfile} />
  }

  return <MainApp />
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <DietProvider>
      <AppContent />
    </DietProvider>
  )
}
