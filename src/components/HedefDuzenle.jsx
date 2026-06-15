import { useState, useMemo } from 'react'
import { useDiet } from '../context/DietContext'

function ChevronLeft() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
    </svg>
  )
}

const PRESETS = [1500, 1800, 2000, 2150, 2500]

export default function HedefDuzenle({ onClose }) {
  const { profile, updateProfile } = useDiet()

  // Derive system-calculated TDEE goal
  const systemKcal = useMemo(() => {
    const tdee = Number(profile?.tdee) || 0
    if (tdee > 0) return Math.max(1200, tdee + (profile.goalOffset ?? 0))
    return Number(profile?.dailyGoal) || 2000
  }, [profile])

  // Derive current macro percents from saved macros
  function inferPcts() {
    const dg = Number(profile?.dailyGoal) || systemKcal
    const m  = profile?.macros
    if (m && dg > 0) {
      const p = Math.round((m.protein * 4 / dg) * 100)
      const c = Math.round((m.carbs   * 4 / dg) * 100)
      const f = Math.round((m.fat     * 9 / dg) * 100)
      if (p + c + f <= 105) return { p, c }
    }
    return { p: 25, c: 50 }
  }

  const { p: initP, c: initC } = inferPcts()

  const [calories,   setCalories]   = useState(Number(profile?.dailyGoal) || systemKcal)
  const [proteinPct, setProteinPct] = useState(initP)
  const [carbsPct,   setCarbsPct]   = useState(initC)

  const fatPct = Math.max(0, 100 - proteinPct - carbsPct)

  const macros = useMemo(() => ({
    protein: Math.round(calories * proteinPct / 100 / 4),
    carbs:   Math.round(calories * carbsPct   / 100 / 4),
    fat:     Math.round(calories * fatPct     / 100 / 9),
  }), [calories, proteinPct, carbsPct, fatPct])

  function adjustProtein(val) {
    const p = Math.min(50, Math.max(10, val))
    // Redistribute remainder equally between carbs and fat, keeping carbs ≤ 70
    const remaining = 100 - p
    const c = Math.min(70, Math.max(10, carbsPct))
    setProteinPct(p)
    setCarbsPct(Math.min(remaining - 10, c))
  }

  function adjustCarbs(val) {
    const c = Math.min(70, Math.max(10, val))
    setCarbsPct(c)
  }

  function handleSave() {
    updateProfile({
      ...profile,
      dailyGoal:    calories,
      goalOffset:   calories - (Number(profile?.tdee) || calories),
      macros,
      macroPercent: { protein: proteinPct, carbs: carbsPct, fat: fatPct },
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-50 dark:bg-night-bg">

      {/* Sticky header */}
      <div className="sticky top-0 z-10 border-b border-slate-100 dark:border-night-border bg-white/95 dark:bg-night-card/95 px-4 pt-4 pb-4 backdrop-blur-md">
        <button
          type="button"
          onClick={onClose}
          className="mb-2 flex cursor-pointer items-center gap-1 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
        >
          <ChevronLeft />
          Profil &amp; Analiz
        </button>
        <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">KALORIMETRE</p>
        <h1 className="mt-0.5 text-2xl font-extrabold text-slate-900 dark:text-slate-100">Hedefi Düzenle</h1>
      </div>

      <div className="mx-auto max-w-app space-y-5 px-4 py-6 pb-16">

        {/* ── GÜNLÜK KALORİ HEDEFİ ── */}
        <div className="rounded-2xl border border-slate-100 dark:border-night-border bg-white dark:bg-night-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500">
              GÜNLÜK KALORİ HEDEFİ
            </p>
            {systemKcal > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-slate-100 dark:bg-night-muted px-2.5 py-1 text-[11px] text-slate-500 dark:text-slate-400">
                <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
                </svg>
                Sistem: {systemKcal.toLocaleString('tr-TR')} kcal
              </span>
            )}
          </div>

          {/* +/- stepper */}
          <div className="mb-5 flex items-center justify-center gap-8">
            <button
              type="button"
              onClick={() => setCalories(c => Math.max(1200, c - 50))}
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-slate-100 dark:bg-night-muted text-xl font-bold text-slate-600 dark:text-slate-300 transition-colors hover:bg-slate-200 dark:hover:bg-night-border active:scale-90"
            >
              −
            </button>
            <div className="text-center">
              <p className="text-5xl font-extrabold leading-none text-slate-900 dark:text-slate-100">
                {calories.toLocaleString('tr-TR')}
              </p>
              <p className="mt-1.5 text-xs font-medium text-slate-400 dark:text-slate-500">kcal, günlük hedef</p>
            </div>
            <button
              type="button"
              onClick={() => setCalories(c => Math.min(4000, c + 50))}
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-emerald-500 text-xl font-bold text-white transition-colors hover:bg-emerald-600 active:scale-90"
            >
              +
            </button>
          </div>

          {/* Range slider */}
          <input
            type="range" min={1200} max={4000} step={50}
            value={calories}
            onChange={e => setCalories(Number(e.target.value))}
            className="w-full cursor-pointer accent-emerald-500"
          />
          <div className="mt-1 flex justify-between text-[10px] font-medium text-slate-400 dark:text-slate-500">
            <span>1200 kcal</span>
            <span>4000 kcal</span>
          </div>

          {/* Presets */}
          <div className="mt-4 flex flex-wrap gap-2">
            {PRESETS.map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setCalories(p)}
                className={`cursor-pointer rounded-xl px-3.5 py-2 text-sm font-bold transition-all active:scale-95 ${
                  calories === p
                    ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
                    : 'bg-slate-100 dark:bg-night-muted text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-night-border'
                }`}
              >
                {p.toLocaleString('tr-TR')}
              </button>
            ))}
          </div>
        </div>

        {/* ── MAKRO ORANLARI ── */}
        <div className="rounded-2xl border border-slate-100 dark:border-night-border bg-white dark:bg-night-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500">
              MAKRO ORANLARI
            </p>
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
              proteinPct + carbsPct + fatPct === 100
                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
                : 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400'
            }`}>
              Toplam: %{proteinPct + carbsPct + fatPct}
            </span>
          </div>

          {/* Combined color bar */}
          <div className="mb-5 flex h-2.5 overflow-hidden rounded-full">
            <div style={{ width: `${proteinPct}%` }} className="bg-indigo-500 transition-all duration-300" />
            <div style={{ width: `${carbsPct}%` }}   className="bg-amber-500  transition-all duration-300" />
            <div style={{ width: `${fatPct}%` }}     className="bg-rose-500   transition-all duration-300" />
          </div>

          {/* Protein */}
          <div className="mb-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-bold text-indigo-600 dark:text-indigo-400">
                <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
                Protein
                <span className="text-slate-500 dark:text-slate-400 font-medium text-xs">{macros.protein}g</span>
              </span>
              <span className="rounded-lg bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                %{proteinPct}
              </span>
            </div>
            <input
              type="range" min={10} max={50} step={1}
              value={proteinPct}
              onChange={e => adjustProtein(Number(e.target.value))}
              className="w-full cursor-pointer accent-indigo-500"
            />
          </div>

          {/* Karbonhidrat */}
          <div className="mb-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-bold text-amber-600 dark:text-amber-400">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                Karbonhidrat
                <span className="text-slate-500 dark:text-slate-400 font-medium text-xs">{macros.carbs}g</span>
              </span>
              <span className="rounded-lg bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                %{carbsPct}
              </span>
            </div>
            <input
              type="range" min={10} max={70} step={1}
              value={carbsPct}
              onChange={e => adjustCarbs(Number(e.target.value))}
              className="w-full cursor-pointer accent-amber-500"
            />
          </div>

          {/* Yağ (auto-computed) */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-bold text-rose-500 dark:text-rose-400">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                Yağ
                <span className="text-slate-500 dark:text-slate-400 font-medium text-xs">{macros.fat}g</span>
              </span>
              <span className="rounded-lg bg-rose-50 dark:bg-rose-900/20 px-2 py-0.5 text-xs font-bold text-rose-500 dark:text-rose-400">
                %{fatPct}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-night-muted">
              <div
                style={{ width: `${(fatPct / 40) * 100}%` }}
                className="h-full rounded-full bg-rose-500 transition-all duration-300"
              />
            </div>
            <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">Protein ve karbonhidrat oranına göre otomatik hesaplanır</p>
          </div>
        </div>

        {/* ── YENİ HEDEF ÖZETİ ── */}
        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50 dark:bg-emerald-900/20 p-4">
          <div className="mb-3 flex items-center gap-2">
            <svg className="h-4 w-4 text-emerald-600 dark:text-emerald-400" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" d="M14.615 1.595a.75.75 0 01.359.852L12.982 9.75h7.268a.75.75 0 01.548 1.262l-10.5 11.25a.75.75 0 01-1.272-.71l1.992-7.302H3.818a.75.75 0 01-.548-1.262l10.5-11.25a.75.75 0 01.845-.143z" clipRule="evenodd" />
            </svg>
            <p className="text-xs font-extrabold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Yeni Hedef Özeti</p>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              { label: 'Kalori',   value: calories.toLocaleString('tr-TR'), unit: 'kcal', color: 'text-emerald-700 dark:text-emerald-400' },
              { label: 'Protein',  value: macros.protein, unit: 'g', color: 'text-indigo-600 dark:text-indigo-400' },
              { label: 'Karb',     value: macros.carbs,   unit: 'g', color: 'text-amber-600 dark:text-amber-400'  },
              { label: 'Yağ',      value: macros.fat,     unit: 'g', color: 'text-rose-500 dark:text-rose-400'    },
            ].map(({ label, value, unit, color }) => (
              <div key={label} className="rounded-xl bg-white dark:bg-night-card py-3 shadow-sm">
                <p className={`text-lg font-extrabold leading-none ${color}`}>{value}</p>
                <p className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500">{unit}</p>
                <p className="mt-0.5 text-[9px] font-medium text-slate-500 dark:text-slate-400">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Save button */}
        <button
          type="button"
          onClick={handleSave}
          className="w-full cursor-pointer rounded-2xl bg-emerald-500 py-4 text-sm font-extrabold text-white shadow-xl shadow-emerald-500/25 transition-all hover:bg-emerald-600 active:scale-95"
        >
          Hedefi Güncelle
        </button>

      </div>
    </div>
  )
}
