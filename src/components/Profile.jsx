import { useState, useMemo } from 'react'
import { useDiet } from '../context/DietContext'
import StatCard, { SectionLabel } from './Profile/StatCard'
import BodyComposition from './Profile/BodyComposition'
import WeeklyChart, { SparkLine, getLast7Days } from './Profile/WeeklyChart'

export default function Profile() {
  const { profile, updateProfile } = useDiet()

  const existingBodyComp = profile?.bodyComp ?? {}

  const [bodyComp, setBodyComp] = useState({
    currentWeight: String(existingBodyComp.currentWeight ?? ''),
    currentFat:    String(existingBodyComp.currentFat    ?? ''),
    currentMuscle: String(existingBodyComp.currentMuscle ?? ''),
  })

  const [bcSaveStatus, setBcSaveStatus] = useState('idle')

  function pComp(k, v) { setBodyComp(prev => ({ ...prev, [k]: v })) }

  const bmi = useMemo(() => {
    const w = Number(bodyComp.currentWeight) || Number(existingBodyComp.currentWeight) || Number(profile?.weight) || 0
    const h = Number(profile?.height) || 0
    if (!w || !h) return 0
    return Math.round((w / Math.pow(h / 100, 2)) * 10) / 10
  }, [bodyComp.currentWeight, existingBodyComp.currentWeight, profile])

  const history = profile?.bodyCompHistory ?? []

  const weeklyStats = useMemo(() => {
    const target = Number(profile?.dailyGoal) || 0
    const days   = getLast7Days()
    const logged   = days.filter(d => d.kcal > 0)
    const onTarget = logged.filter(d => target > 0 && d.kcal / target >= 0.85 && d.kcal / target <= 1.10)
    return { total: days.length, logged: logged.length, onTarget: onTarget.length, target }
  }, [profile?.dailyGoal])

  function handleSaveBodyComp() {
    if (!bodyComp.currentWeight && !bodyComp.currentFat && !bodyComp.currentMuscle) return

    const currentDate = new Date().toISOString().slice(0, 10)
    const newSnapshot = {
      date:   currentDate,
      weight: Number(bodyComp.currentWeight) || 0,
      fat:    Number(bodyComp.currentFat)    || 0,
      muscle: Number(bodyComp.currentMuscle) || 0,
    }

    const existingHistory = profile?.bodyCompHistory ?? []
    const todayIdx   = existingHistory.findIndex(s => s.date === currentDate)
    const newHistory = todayIdx >= 0
      ? existingHistory.map((s, i) => i === todayIdx ? newSnapshot : s)
      : [...existingHistory, newSnapshot]

    updateProfile({
      ...profile,
      bodyComp: {
        startingWeight:  existingBodyComp.startingWeight  ?? (Number(bodyComp.currentWeight) || 0),
        currentWeight:   Number(bodyComp.currentWeight)  || 0,
        startingFat:     existingBodyComp.startingFat    ?? (Number(bodyComp.currentFat)    || 0),
        currentFat:      Number(bodyComp.currentFat)     || 0,
        startingMuscle:  existingBodyComp.startingMuscle ?? (Number(bodyComp.currentMuscle) || 0),
        currentMuscle:   Number(bodyComp.currentMuscle)  || 0,
        lastUpdated:     currentDate,
      },
      bodyCompHistory: newHistory.slice(-90),
    })
    setBcSaveStatus('saved')
    setTimeout(() => setBcSaveStatus('idle'), 2200)
  }

  const dailyGoal = Number(profile?.dailyGoal) || 0
  const tdee      = Number(profile?.tdee)       || 0

  const goalLabel = profile?.goalOffset === -500 ? 'Kilo Ver'
    : profile?.goalOffset === 500  ? 'Kilo Al'
    : 'Dengeli'

  return (
    <div className="space-y-6 pb-10">

      {/* ── HEADER ── */}
      <div className="sticky top-0 z-10 -mx-4 border-b border-slate-100 dark:border-night-border bg-white/80 dark:bg-night-card/80 px-4 py-4 backdrop-blur-md">
        <h1 className="text-xl font-extrabold text-slate-900 dark:text-slate-100">Profil & Gelişim</h1>
        <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">İlerleme takibi ve vücut analitiği</p>
      </div>

      {/* ── ACTIVE TARGET CARD ── */}
      {dailyGoal > 0 && (
        <div className="rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 p-5 text-white shadow-xl shadow-emerald-500/25">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-100">Güncel Hedef</p>
          <div className="mt-2 flex items-end justify-between">
            <div>
              <p className="text-4xl font-extrabold">{dailyGoal.toLocaleString('tr-TR')}</p>
              <p className="text-sm font-semibold text-emerald-200">kcal / gün</p>
            </div>
            <div className="text-right">
              <span className="rounded-xl bg-white/20 px-3 py-1 text-xs font-extrabold text-white">{goalLabel}</span>
              {tdee > 0 && <p className="mt-1 text-xs text-emerald-200">TDEE: {tdee.toLocaleString('tr-TR')}</p>}
            </div>
          </div>
          {profile?.tdee > 0 && (() => {
            const p_ = Math.round(dailyGoal * 0.30 / 4)
            const k_ = Math.round(dailyGoal * 0.45 / 4)
            const y_ = Math.round(dailyGoal * 0.25 / 9)
            return (
              <div className="mt-4 grid grid-cols-3 gap-2">
                {[
                  { label: 'Protein', val: p_ },
                  { label: 'Karb',    val: k_ },
                  { label: 'Yağ',     val: y_ },
                ].map(({ label, val }) => (
                  <div key={label} className="rounded-xl bg-white/20 px-2 py-2 text-center">
                    <p className="text-base font-extrabold text-white">{val}g</p>
                    <p className="text-[10px] font-semibold text-emerald-100">{label}</p>
                  </div>
                ))}
              </div>
            )
          })()}
        </div>
      )}

      {/* ── 7-DAY CALORIE CHART ── */}
        <div className="rounded-3xl bg-white dark:bg-night-card p-5 shadow-sm ring-1 ring-slate-100 dark:ring-night-border">
        <SectionLabel text="Son 7 Gün Kalori" />
        <WeeklyChart target={dailyGoal} />
      </div>

      {/* ── WEEKLY ADHERENCE ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Kayıt Günü',   val: weeklyStats.logged,   color: 'text-slate-900 dark:text-slate-100'   },
          { label: 'Hedefe Uygun', val: weeklyStats.onTarget,  color: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Hafta İçinde', val: 7,                     color: 'text-blue-600 dark:text-blue-400'    },
        ].map(({ label, val, color }) => (
          <div key={label} className="rounded-2xl bg-slate-50 dark:bg-night-muted px-3 py-4 text-center">
            <p className={`text-2xl font-extrabold ${color}`}>{val}</p>
            <p className="mt-0.5 text-[10px] font-semibold text-slate-400 dark:text-slate-500">{label}</p>
          </div>
        ))}
      </div>

      {/* ── BODY COMPOSITION INPUT ── */}
      <div>
        <SectionLabel text="Vücut Ölçüm Güncellemesi" />
        <BodyComposition
          bodyComp={bodyComp}
          onChange={pComp}
          bmi={bmi}
          onSave={handleSaveBodyComp}
          saveStatus={bcSaveStatus}
        />
      </div>

      {/* ── PROGRESS CARDS ── */}
      {(existingBodyComp.startingWeight || existingBodyComp.startingFat || existingBodyComp.startingMuscle) && (
        <div>
          <SectionLabel text="Başlangıçtan İtibaren Değişim" />
          <div className="grid grid-cols-3 gap-3">
            <StatCard
              label="Kilo" unit="kg" positiveDir="down"
              starting={existingBodyComp.startingWeight}
              current={existingBodyComp.currentWeight}
            />
            <StatCard
              label="Yağ %" unit="%" positiveDir="down"
              starting={existingBodyComp.startingFat}
              current={existingBodyComp.currentFat}
            />
            <StatCard
              label="Kas" unit="kg" positiveDir="up"
              starting={existingBodyComp.startingMuscle}
              current={existingBodyComp.currentMuscle}
            />
          </div>
        </div>
      )}

      {/* ── TREND CHARTS ── */}
      {history.length >= 2 && (
        <div>
          <SectionLabel text="İlerleme Trendleri" />
          <div className="space-y-4 rounded-3xl bg-white dark:bg-night-card p-5 shadow-sm ring-1 ring-slate-100 dark:ring-night-border">
            {[
              { key: 'weight', label: 'Kilo',        unit: 'kg', color: '#10B981' },
              { key: 'fat',    label: 'Yağ Oranı',   unit: '%',  color: '#F59E0B' },
              { key: 'muscle', label: 'Kas Kütlesi', unit: 'kg', color: '#3B82F6' },
            ].map(({ key, label, unit, color }) => {
              const last = history.filter(d => (d[key] ?? 0) > 0)
              if (last.length === 0) return null
              const lastVal = last[last.length - 1][key]
              return (
                <div key={key}>
                  <div className="mb-1 flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400">{label}</p>
                    <p className="text-sm font-extrabold" style={{ color }}>
                      {lastVal}{unit}
                    </p>
                  </div>
                  <SparkLine history={history} valueKey={key} color={color} />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── GOAL HISTORY ── */}
      {profile?.goalHistory?.length > 0 && (
        <div>
          <SectionLabel text="Geçmiş Hedefler" />
          <div className="space-y-2">
            {profile.goalHistory.slice(-5).reverse().map((g, i) => (
              <div key={i} className="flex items-center justify-between rounded-2xl bg-slate-50 dark:bg-night-muted px-4 py-3">
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    {g.goalLabel ?? 'Dengeli'} · {Number(g.dailyGoal).toLocaleString('tr-TR')} kcal
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">{g.date}</p>
                </div>
                <span className="text-xs text-slate-400 dark:text-slate-500">TDEE: {Number(g.tdee ?? 0).toLocaleString('tr-TR')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty-state when no body comp data */}
      {!existingBodyComp.startingWeight && !profile?.dailyGoal && (
        <div className="rounded-3xl border border-dashed border-slate-200 dark:border-night-border py-10 text-center">
          <svg className="mx-auto h-10 w-10 text-slate-200 dark:text-night-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
          </svg>
          <p className="mt-3 text-sm font-semibold text-slate-500 dark:text-slate-400">Henüz veri yok</p>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Ayarlar'dan hedefini belirle ve ölçüm girerek başla</p>
        </div>
      )}

    </div>
  )
}
