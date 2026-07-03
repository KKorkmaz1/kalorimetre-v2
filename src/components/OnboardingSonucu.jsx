import { useMemo } from 'react'
import { useDiet } from '../context/DietContext'
import { macroCalculator } from '../utils/macroCalculator'
import { GOAL_LABELS } from '../constants/goalOptions'

function ChevronLeft() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
    </svg>
  )
}

const ACTIVITY_MAP = {
  sedanter:    { label: 'Hareketsiz',  mult: 1.2   },
  az_aktif:    { label: 'Hafif Aktif', mult: 1.375 },
  orta_aktif:  { label: 'Orta Düzey', mult: 1.55  },
  cok_aktif:   { label: 'Çok Aktif',  mult: 1.725 },
  ekstra:      { label: 'Sporcu',     mult: 1.9   },
  // Settings.jsx activity IDs
  sedentary:   { label: 'Hareketsiz',  mult: 1.2   },
  light:       { label: 'Hafif Aktif', mult: 1.375 },
  moderate:    { label: 'Orta Düzey', mult: 1.55  },
  active:      { label: 'Çok Aktif',  mult: 1.725 },
  veryActive:  { label: 'Sporcu',     mult: 1.9   },
}

/** Large circular ring showing calorie target */
function CalorieRingLarge({ kcal }) {
  const size = 180
  const sw   = 12
  const r    = (size - sw * 2) / 2
  const C    = 2 * Math.PI * r

  return (
    <div className="relative mx-auto flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={sw} />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke="#10B981"
          strokeWidth={sw}
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * 0.1}
          style={{ transformOrigin: `${size / 2}px ${size / 2}px`, transform: 'rotate(-90deg)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <svg className="mb-1 h-6 w-6 text-emerald-500" viewBox="0 0 24 24" fill="currentColor">
          <path fillRule="evenodd" d="M14.615 1.595a.75.75 0 01.359.852L12.982 9.75h7.268a.75.75 0 01.548 1.262l-10.5 11.25a.75.75 0 01-1.272-.71l1.992-7.302H3.818a.75.75 0 01-.548-1.262l10.5-11.25a.75.75 0 01.845-.143z" clipRule="evenodd" />
        </svg>
        <span className="text-3xl font-extrabold leading-none text-slate-900 dark:text-slate-100">
          {(kcal || 0).toLocaleString('tr-TR')}
        </span>
        <span className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">kcal / gün</span>
        <span className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500">Günlük Hedef</span>
      </div>
    </div>
  )
}

export default function OnboardingSonucu({ onClose }) {
  const { profile } = useDiet()

  const activityKey = profile?.stats?.activity || profile?.activity || 'moderate'
  const activityInfo = ACTIVITY_MAP[activityKey] ?? { label: 'Orta Düzey', mult: 1.55 }

  // Stats — prefer stats obj (onboarding) then flat (Settings)
  const gender = profile?.stats?.gender || profile?.gender || 'erkek'
  const age    = Number(profile?.stats?.age    || profile?.age    || 0)
  const weight = Number(profile?.stats?.weight || profile?.weight || 0)
  const height = Number(profile?.stats?.height || profile?.height || 0)

  const { bmr, tdee, dailyGoal, macros, goalOffset, goalLabel } = useMemo(() => {
    const computed = macroCalculator(profile)
    if (computed) {
      const goalId = profile?.primaryGoal
      return {
        bmr:        computed.bmr,
        tdee:       computed.tdee,
        dailyGoal:  computed.target_calories,
        goalOffset: computed.goalOffset ?? (computed.target_calories - computed.tdee),
        macros: {
          protein: computed.target_protein,
          carbs:   computed.target_carbs,
          fat:     computed.target_fat,
        },
        goalLabel: GOAL_LABELS[goalId] ?? 'Kilo Korumak',
      }
    }

    const bmr = age && weight && height
      ? Math.round(gender === 'kadin'
          ? 10 * weight + 6.25 * height - 5 * age - 161
          : 10 * weight + 6.25 * height - 5 * age + 5)
      : Number(profile?.tdee) || 0

    const tdee = Math.round(bmr * activityInfo.mult)
    const savedGoalOffset = Number(profile?.goalOffset ?? 0)
    const dailyGoal = Number(profile?.dailyGoal) || Math.max(1200, tdee + savedGoalOffset)
    const goalOffset = dailyGoal - tdee

    return {
      bmr, tdee, dailyGoal, goalOffset,
      macros: profile?.macros ?? {
        protein: Math.round(dailyGoal * 0.25 / 4),
        carbs:   Math.round(dailyGoal * 0.45 / 4),
        fat:     Math.round(dailyGoal * 0.30 / 9),
      },
      goalLabel: goalOffset < 0 ? 'Kilo Vermek' : goalOffset > 0 ? 'Kas Yapmak / Kilo Almak' : 'Kilo Korumak',
    }
  }, [profile, age, weight, height, gender, activityInfo])
  const kcalDiff  = Math.abs(goalOffset)

  // Estimate duration: 500 kcal deficit ≈ 0.5 kg/week ≈ 2 kg/month
  const startW = Number(profile?.bodyComp?.startingWeight || profile?.stats?.weight || weight)
  const goalW  = Number(profile?.goalWeight || 0)
  let duration = '~4 Ay'
  if (goalW > 0 && startW > goalW && kcalDiff > 0) {
    const months = Math.ceil((startW - goalW) / (kcalDiff / 3500 * 30 * 0.45))
    duration = `~${months} Ay`
  }

  // Macro percentages (for display)
  const pPct = dailyGoal > 0 ? Math.round(macros.protein * 4 / dailyGoal * 100) : 25
  const cPct = dailyGoal > 0 ? Math.round(macros.carbs   * 4 / dailyGoal * 100) : 50
  const fPct = dailyGoal > 0 ? Math.round(macros.fat     * 9 / dailyGoal * 100) : 25

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
      </div>

      <div className="mx-auto max-w-app px-4 py-6 pb-16 space-y-5">

        {/* ── Hero badge + title ── */}
        <div className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 dark:bg-emerald-900/20 px-4 py-1.5 text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
            <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Kişisel Formülün Hazır
          </span>
          <h1 className="mt-3 text-2xl font-extrabold leading-tight text-slate-900 dark:text-slate-100">
            İşte Senin<br />Özel Formülün!
          </h1>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
            Mifflin-St Jeor denklemine göre hesaplandı.
          </p>
        </div>

        {/* ── Calorie ring ── */}
        <div className="rounded-3xl border border-slate-100 dark:border-night-border bg-white dark:bg-night-card p-6 shadow-sm text-center">
          <CalorieRingLarge kcal={dailyGoal} />

          {/* Info pills */}
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-night-border bg-slate-50 dark:bg-night-muted px-3 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <svg className="h-3 w-3 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Hedef: {goalLabel}
            </span>
            <span className="flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-night-border bg-slate-50 dark:bg-night-muted px-3 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <svg className="h-3 w-3 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Aktivite: {activityInfo.label}
            </span>
            {goalW > 0 && (
              <span className="flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-night-border bg-slate-50 dark:bg-night-muted px-3 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <svg className="h-3 w-3 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Süre: {duration}
              </span>
            )}
          </div>
        </div>

        {/* ── MAKRO DAĞILIMI ── */}
        <div>
          <p className="mb-3 text-[10px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500">MAKRO DAĞILIMI</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Protein', val: macros.protein, pct: pPct, unit: 'g', barColor: 'bg-indigo-500', pctColor: 'text-indigo-600 dark:text-indigo-400', bgColor: 'bg-indigo-50 dark:bg-indigo-900/20' },
              { label: 'Karbonhidrat', val: macros.carbs, pct: cPct, unit: 'g', barColor: 'bg-amber-500', pctColor: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-50 dark:bg-amber-900/20' },
              { label: 'Yağ', val: macros.fat, pct: fPct, unit: 'g', barColor: 'bg-rose-500', pctColor: 'text-rose-500 dark:text-rose-400', bgColor: 'bg-rose-50 dark:bg-rose-900/20' },
            ].map(({ label, val, pct, unit, barColor, pctColor, bgColor }) => (
              <div key={label} className={`rounded-2xl ${bgColor} p-3.5 text-center`}>
                <p className={`text-2xl font-extrabold leading-none ${pctColor}`}>{val}</p>
                <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">{unit}</p>
                <p className="mt-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">{label}</p>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/50 dark:bg-black/20">
                  <div style={{ width: `${pct * 2}%` }} className={`h-full rounded-full ${barColor}`} />
                </div>
                <p className={`mt-1 text-[10px] font-bold ${pctColor}`}>%{pct}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── HESAPLAMA ÖZETİ ── */}
        <div className="rounded-2xl border border-slate-100 dark:border-night-border bg-white dark:bg-night-card overflow-hidden shadow-sm">
          <div className="border-b border-slate-100 dark:border-night-border px-5 py-3">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500">HESAPLAMA ÖZETİ</p>
          </div>
          <div className="divide-y divide-slate-50 dark:divide-night-border px-5">
            {[
              { label: 'Bazal Metabolizma (BMR)', value: `${(bmr || 0).toLocaleString('tr-TR')} kcal`, bold: false },
              { label: 'Aktivite Çarpanı', value: `× ${activityInfo.mult.toFixed(2)}`, bold: false },
              { label: 'Toplam Enerji Harcaması', value: `${(tdee || 0).toLocaleString('tr-TR')} kcal`, bold: false },
              ...(goalOffset !== 0 ? [{
                label: `Kalori ${goalOffset < 0 ? 'Açığı' : 'Fazlası'} (${goalLabel})`,
                value: `${goalOffset < 0 ? '–' : '+'} ${kcalDiff.toLocaleString('tr-TR')} kcal`,
                bold: false,
              }] : []),
            ].map(({ label, value, bold }) => (
              <div key={label} className="flex items-center justify-between py-3">
                <span className={`text-sm ${bold ? 'font-bold text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400'}`}>
                  {label}
                </span>
                <span className={`text-sm ${bold ? 'font-extrabold text-slate-900 dark:text-slate-100' : 'font-semibold text-slate-700 dark:text-slate-300'}`}>
                  {value}
                </span>
              </div>
            ))}
            {/* Final row — highlighted */}
            <div className="flex items-center justify-between py-3.5">
              <span className="text-sm font-bold text-slate-900 dark:text-slate-100">Günlük Hedef</span>
              <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                {(dailyGoal || 0).toLocaleString('tr-TR')} kcal
              </span>
            </div>
          </div>
        </div>

        {/* Close/Continue button */}
        <button
          type="button"
          onClick={onClose}
          className="w-full cursor-pointer rounded-2xl bg-emerald-500 py-4 text-sm font-extrabold text-white shadow-xl shadow-emerald-500/25 transition-all hover:bg-emerald-600 active:scale-95 flex items-center justify-center gap-2"
        >
          Harika, Başlayalım!
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
          </svg>
        </button>

      </div>
    </div>
  )
}
