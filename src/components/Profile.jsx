import { useState, useMemo } from 'react'
import { useDiet } from '../context/DietContext'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import OnboardingSonucu from './OnboardingSonucu'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  const months = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara']
  return `${Number(d)} ${months[Number(m) - 1]} ${y}`
}

function shortDate(iso) {
  if (!iso) return ''
  const [, m, d] = iso.split('-')
  const months = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara']
  return `${Number(d)} ${months[Number(m) - 1]}`
}

/** Compute lifetime stats from all day stores in localStorage */
function useLifetimeStats(dailyGoal) {
  return useMemo(() => {
    let totalKcal = 0
    let achievementDays = 0
    let daysWithLogs = []
    const prefix = 'kalorimetre_day_'
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key?.startsWith(prefix)) {
          const dateStr = key.replace(prefix, '')
          const data = JSON.parse(localStorage.getItem(key) || '{}')
          const dayKcal = (data.logs || []).reduce((s, l) => s + (Number(l.kcal) || 0), 0)
          if (dayKcal > 0) {
            totalKcal += dayKcal
            daysWithLogs.push({ date: dateStr, kcal: dayKcal })
            if (dailyGoal > 0 && dayKcal >= dailyGoal * 0.85 && dayKcal <= dailyGoal * 1.15) {
              achievementDays++
            }
          }
        }
      }
    } catch {}

    // Compute streak
    daysWithLogs.sort((a, b) => a.date.localeCompare(b.date))
    let streak = 0
    if (daysWithLogs.length > 0) {
      const today = new Date().toISOString().slice(0, 10)
      let checkDate = new Date(today)
      for (let i = daysWithLogs.length - 1; i >= 0; i--) {
        const expected = checkDate.toISOString().slice(0, 10)
        if (daysWithLogs[i].date === expected) {
          streak++
          checkDate.setDate(checkDate.getDate() - 1)
        } else break
      }
    }

    const totalKcalFormatted = totalKcal > 999999
      ? `${(totalKcal / 1000000).toFixed(1)}M`
      : totalKcal > 999
        ? `${Math.round(totalKcal / 1000)}K`
        : String(totalKcal)

    // Simple badge count based on milestones
    const badges = [
      daysWithLogs.length >= 1,
      daysWithLogs.length >= 7,
      daysWithLogs.length >= 30,
      streak >= 3,
      streak >= 7,
      achievementDays >= 5,
      achievementDays >= 10,
      totalKcal >= 10000,
      totalKcal >= 50000,
      totalKcal >= 100000,
      totalKcal >= 500000,
      streak >= 14,
    ].filter(Boolean).length

    return { streak, totalKcal, totalKcalFormatted, achievementDays, badges, totalDays: daysWithLogs.length }
  }, [dailyGoal])
}

/** Custom tooltip for recharts */
function WeightTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-slate-100 dark:border-night-border bg-white dark:bg-night-card px-3 py-2 shadow-lg text-xs">
      <p className="font-bold text-slate-900 dark:text-slate-100">{label}</p>
      <p className="text-emerald-600 dark:text-emerald-400 font-semibold">{payload[0]?.value} kg</p>
    </div>
  )
}

// ─── Main Profile component ───────────────────────────────────────────────────

export default function Profile() {
  const { profile } = useDiet()

  const [showOnboardingSon, setShowOnboardingSon] = useState(false)

  // Derived values
  const dailyGoal = Number(profile?.dailyGoal) || 0
  const tdee      = Number(profile?.tdee)       || 0

  // Body comp data
  const bodyComp  = profile?.bodyComp ?? {}
  const history   = profile?.bodyCompHistory ?? []

  const startWeight   = Number(bodyComp.startingWeight || 0)
  const currentWeight = Number(bodyComp.currentWeight  || 0)
  const weightChange  = startWeight && currentWeight ? Math.round((currentWeight - startWeight) * 10) / 10 : null
  const goalWeight    = Number(profile?.goalWeight || 0)

  // Goal progress
  const goalPct = useMemo(() => {
    if (!startWeight || !goalWeight || startWeight === goalWeight) return 0
    const done = Math.abs(startWeight - currentWeight)
    const total = Math.abs(startWeight - goalWeight)
    return Math.min(100, Math.round((done / total) * 100))
  }, [startWeight, currentWeight, goalWeight])

  // Goal label
  const goalLabel = profile?.goalOffset < 0 ? 'Zayıflama' : profile?.goalOffset > 0 ? 'Kilo Alma' : 'Dengeli'

  // Start date
  const startDate = profile?.createdAt
    || history[0]?.date
    || new Date().toISOString().slice(0, 10)

  // Streak / achievements
  const stats = useLifetimeStats(dailyGoal)

  // Check-in steps count
  const checkInCount = history.length

  // Chart data — use history, or generate trend from start/current
  const chartData = useMemo(() => {
    if (history.length >= 2) {
      return history
        .filter(d => d.weight > 0)
        .map(d => ({ date: shortDate(d.date), weight: d.weight }))
        .slice(-10)
    }
    // Mock trend if no history
    if (startWeight && currentWeight) {
      const days = 22
      const data = []
      for (let i = 0; i <= days; i += 3) {
        const t = i / days
        const w = Math.round((startWeight + (currentWeight - startWeight) * t) * 10) / 10
        const d = new Date()
        d.setDate(d.getDate() - (days - i))
        data.push({ date: shortDate(d.toISOString().slice(0, 10)), weight: w })
      }
      return data
    }
    return []
  }, [history, startWeight, currentWeight])

  const yDomain = useMemo(() => {
    if (!chartData.length) return ['auto', 'auto']
    const weights = chartData.map(d => d.weight)
    const min = Math.floor(Math.min(...weights) - 0.5)
    const max = Math.ceil(Math.max(...weights)  + 0.5)
    return [min, max]
  }, [chartData])

  // Current month label
  const monthLabel = new Date().toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })
    .replace(/^./, s => s.toUpperCase())

  // Name / avatar
  const displayName = profile?.name || 'Kullanıcı'
  const initials = displayName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <>
      <div className="space-y-5 pb-10">

        {/* ── PAGE HEADER ── */}
        <header>
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">KALORIMETRE</p>
          <h1 className="mt-0.5 text-2xl font-extrabold text-slate-900 dark:text-slate-100">Profil &amp; Analiz</h1>
        </header>

        {/* ── AVATAR CARD ── */}
        <div className="flex flex-col items-center rounded-3xl border border-slate-100 dark:border-night-border bg-white dark:bg-night-card p-6 shadow-sm">
          <div className="relative">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/30">
              <svg className="h-12 w-12 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clipRule="evenodd" />
              </svg>
            </div>
            <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-white dark:ring-night-card">
              <svg className="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </span>
          </div>
          <h2 className="mt-3 text-lg font-extrabold text-slate-900 dark:text-slate-100">{displayName}</h2>
          <span className="mt-1.5 flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-night-border bg-slate-50 dark:bg-night-muted px-3 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
            <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75z" clipRule="evenodd" />
            </svg>
            Başlangıç: {formatDate(startDate)}
          </span>
        </div>

        {/* ── KİLO DÖNÜŞÜMÜ ── */}
        {(startWeight > 0 || currentWeight > 0) && (
          <div className="rounded-2xl border border-slate-100 dark:border-night-border bg-white dark:bg-night-card p-5 shadow-sm">
            <p className="mb-4 text-[10px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500">KİLO DÖNÜŞÜMÜ</p>
            <div className="grid grid-cols-3 gap-3">
              {/* Start */}
              <div className="text-center">
                <p className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500">BAŞLANGIÇ</p>
                <p className="mt-1 text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                  {startWeight > 0 ? `${startWeight} kg` : '—'}
                </p>
                <p className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500">{formatDate(startDate)}</p>
              </div>
              {/* Divider */}
              <div className="flex flex-col items-center justify-center">
                <svg className="h-5 w-5 text-slate-300 dark:text-night-muted" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
                </svg>
              </div>
              {/* Current */}
              <div className="text-center">
                <p className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500">MEVCUT</p>
                <p className="mt-1 text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                  {currentWeight > 0 ? `${currentWeight} kg` : '—'}
                </p>
                <p className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500">Bugün</p>
              </div>
            </div>
            {/* Change row */}
            {weightChange !== null && (
              <div className="mt-4 flex items-center justify-center gap-3 rounded-xl bg-slate-50 dark:bg-night-muted px-4 py-2.5">
                <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500">DEĞİŞİM</span>
                <span className={`flex items-center gap-1 text-base font-extrabold ${
                  weightChange < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'
                }`}>
                  {weightChange > 0 ? '+' : ''}{weightChange} kg
                  <svg className={`h-4 w-4 ${weightChange < 0 ? 'rotate-0' : 'rotate-180'}`} viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 3a.75.75 0 01.75.75v10.638l3.96-4.158a.75.75 0 111.08 1.04l-5.25 5.5a.75.75 0 01-1.08 0l-5.25-5.5a.75.75 0 111.08-1.04l3.96 4.158V3.75A.75.75 0 0110 3z" clipRule="evenodd" />
                  </svg>
                </span>
                {checkInCount > 0 && (
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">{checkInCount} ilerleme</span>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── AKTİF HEDEF ── */}
        {dailyGoal > 0 && (
          <div className="rounded-2xl border border-slate-100 dark:border-night-border bg-white dark:bg-night-card p-5 shadow-sm">
            <div className="mb-3 flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 dark:bg-rose-900/20">
                  <svg className="h-4 w-4 text-rose-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                    {goalLabel}{goalWeight > 0 ? ` / ${goalWeight} kg'a Ulaşmak` : ''}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Günlük limit: {dailyGoal.toLocaleString('tr-TR')} kcal
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-emerald-500 px-2.5 py-0.5 text-[11px] font-bold text-white">Aktif</span>
            </div>

            {goalWeight > 0 && startWeight > 0 && (
              <>
                <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-night-muted">
                  <div
                    style={{ width: `${goalPct}%` }}
                    className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                  />
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                  <span>{startWeight} kg</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">%{goalPct}</span>
                  <span>{goalWeight} kg</span>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── KİLO TRENDİ CHART ── */}
        {chartData.length >= 2 && (
          <div className="rounded-2xl border border-slate-100 dark:border-night-border bg-white dark:bg-night-card p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500">KİLO TRENDİ</p>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{monthLabel}</span>
            </div>
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#10B981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  domain={yDomain}
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                  tickCount={4}
                />
                <Tooltip content={<WeightTooltip />} />
                <Area
                  type="monotone"
                  dataKey="weight"
                  stroke="#10B981"
                  strokeWidth={2.5}
                  fill="url(#weightGrad)"
                  dot={{ fill: '#10B981', r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: '#10B981', strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ── ÖMÜR BOYU BAŞARILAR ── */}
        <div>
          <p className="mb-3 text-[10px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500">ÖMÜR BOYU BAŞARILAR</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              {
                value: stats.streak || 0,
                label: 'Günlük Seri',
                bg: 'bg-orange-50 dark:bg-orange-900/20',
                valueColor: 'text-orange-600 dark:text-orange-400',
                icon: (
                  <svg className="h-5 w-5 text-orange-500" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M12.963 2.286a.75.75 0 00-1.071-.136 9.742 9.742 0 00-3.539 6.177A7.547 7.547 0 016.648 6.61a.75.75 0 00-1.152-.082A9 9 0 1015.68 4.534a7.46 7.46 0 01-2.717-2.248zM15.75 14.25a3.75 3.75 0 11-7.313-1.172c.628.465 1.35.81 2.133 1a5.99 5.99 0 011.925-3.545 3.75 3.75 0 013.255 3.717z" clipRule="evenodd" />
                  </svg>
                ),
              },
              {
                value: stats.totalKcalFormatted || '0',
                label: 'Toplam kcal',
                bg: 'bg-emerald-50 dark:bg-emerald-900/20',
                valueColor: 'text-emerald-700 dark:text-emerald-400',
                icon: (
                  <svg className="h-5 w-5 text-emerald-500" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M14.615 1.595a.75.75 0 01.359.852L12.982 9.75h7.268a.75.75 0 01.548 1.262l-10.5 11.25a.75.75 0 01-1.272-.71l1.992-7.302H3.818a.75.75 0 01-.548-1.262l10.5-11.25a.75.75 0 01.845-.143z" clipRule="evenodd" />
                  </svg>
                ),
              },
              {
                value: stats.badges || 0,
                label: 'Rozetler',
                bg: 'bg-yellow-50 dark:bg-yellow-900/20',
                valueColor: 'text-yellow-700 dark:text-yellow-400',
                icon: (
                  <svg className="h-5 w-5 text-yellow-500" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M5.166 2.621v.858c-1.035.148-2.059.33-3.071.543a.75.75 0 00-.584.859 6.753 6.753 0 006.138 5.6 6.73 6.73 0 002.743 1.346A6.707 6.707 0 019.279 15H8.54c-1.036 0-1.875.84-1.875 1.875V19.5h-.75a2.25 2.25 0 000 4.5h9a2.25 2.25 0 000-4.5h-.75v-2.625c0-1.036-.84-1.875-1.875-1.875h-.739a6.706 6.706 0 01-1.112-3.173 6.73 6.73 0 002.743-1.347 6.753 6.753 0 006.139-5.6.75.75 0 00-.585-.858 47.077 47.077 0 00-3.07-.543V2.62a.75.75 0 00-.658-.744 49.798 49.798 0 00-6.093-.377.75.75 0 00-.657.744zm0 2.629c0 1.196.312 2.32.857 3.294A5.266 5.266 0 013.16 5.337a45.6 45.6 0 012.006-.343v.256zm13.5 0v-.256c.674.1 1.343.214 2.006.343a5.265 5.265 0 01-2.863 3.207 6.72 6.72 0 00.857-3.294z" clipRule="evenodd" />
                  </svg>
                ),
              },
              {
                value: stats.achievementDays || 0,
                label: 'Başarı Günü',
                bg: 'bg-purple-50 dark:bg-purple-900/20',
                valueColor: 'text-purple-700 dark:text-purple-400',
                icon: (
                  <svg className="h-5 w-5 text-purple-500" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
                  </svg>
                ),
              },
            ].map(({ value, label, bg, valueColor, icon }) => (
              <div key={label} className={`rounded-2xl ${bg} p-4`}>
                <div className="mb-2">{icon}</div>
                <p className={`text-2xl font-extrabold leading-none ${valueColor}`}>{value}</p>
                <p className="mt-1 text-xs font-semibold text-slate-600 dark:text-slate-400">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── HIZLI ERİŞİM ── */}
        <div>
          <p className="mb-3 text-[10px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500">HIZLI ERİŞİM</p>
          <div className="overflow-hidden rounded-2xl border border-slate-100 dark:border-night-border bg-white dark:bg-night-card shadow-sm">
            <button
              type="button"
              onClick={() => setShowOnboardingSon(true)}
              className="flex w-full cursor-pointer items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-slate-50 dark:hover:bg-night-muted active:bg-slate-100 dark:active:bg-night-border"
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-night-muted">
                <svg className="h-5 w-5 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Onboarding Sonucu</p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Hesaplama detaylarını görüntüle</p>
              </div>
              <svg className="h-4 w-4 flex-shrink-0 text-slate-300 dark:text-night-muted" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>

      </div>

      {/* ── MODALS ── */}
      {showOnboardingSon && <OnboardingSonucu onClose={() => setShowOnboardingSon(false)} />}
    </>
  )
}
