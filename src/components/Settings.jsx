import { useState, useMemo } from 'react'
import { useDiet } from '../context/DietContext'
import { ProteinIcon, CarbsIcon, FatIcon } from './Meal/MealIcons'
import { calcTDEE, calcMacros, GOAL_DELTAS, goalOffsetToId } from '../utils/macroEngine'
import HedefDuzenle from './HedefDuzenle'

// ─── Constants (used by sub-views only) ───────────────────────────────────────

const ACTIVITY_LEVELS = [
  { id: 'sedentary',  label: 'Hareketsiz',  desc: 'Masa başı iş, az hareket',       mult: 1.2   },
  { id: 'light',      label: 'Hafif Aktif', desc: 'Haftada 1–3 gün egzersiz',       mult: 1.375 },
  { id: 'moderate',   label: 'Orta Aktif',  desc: 'Haftada 3–5 gün egzersiz',       mult: 1.55  },
  { id: 'active',     label: 'Çok Aktif',   desc: 'Haftada 6–7 gün ağır antrenman', mult: 1.725 },
  { id: 'veryActive', label: 'Sporcu',      desc: 'Günde 2 kez antrenman',          mult: 1.9   },
]

const GOAL_LABELS = {
  kilo_ver:  'Kilo Vermek',
  kilo_al:   'Kilo Almak',
  kas_kazan: 'Kas Kazanmak',
  dengeli:   'Dengeli',
}

// ─── Shared primitives ────────────────────────────────────────────────────────

function ChevronLeft() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
    </svg>
  )
}

function ChevronRight() {
  return (
    <svg className="h-4 w-4 flex-shrink-0 text-slate-300 dark:text-slate-600" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
    </svg>
  )
}

function SectionLabel({ text }) {
  return (
    <p className="mb-2 text-[11px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500">
      {text}
    </p>
  )
}

function StatInput({ label, value, onChange, unit = '', min, step = '1' }) {
  return (
    <div className="rounded-2xl border-2 border-slate-200 dark:border-night-border bg-white dark:bg-night-card px-4 py-3 transition-all focus-within:border-emerald-400 dark:focus-within:border-emerald-500">
      <label className="block text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500">{label}</label>
      <div className="flex items-baseline gap-1.5">
        <input
          type="number" inputMode="decimal" min={min} step={step}
          value={value} onChange={e => onChange(e.target.value)}
          className="w-full bg-transparent text-2xl font-extrabold text-slate-900 dark:text-slate-100 outline-none placeholder:text-slate-200 dark:placeholder:text-night-muted"
        />
        {unit && <span className="text-sm font-semibold text-slate-400 dark:text-slate-500">{unit}</span>}
      </div>
    </div>
  )
}

function IOSToggle({ checked, onChange }) {
  return (
    <button
      type="button" role="switch" aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
        checked ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-night-muted'
      }`}
    >
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-300 ${
        checked ? 'translate-x-[26px]' : 'translate-x-1'
      }`} />
    </button>
  )
}

// Full-screen overlay container — solid background ensures no bleed-through
function SubViewContainer({ children }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-50 dark:bg-[#0C0F1A]">
      {children}
    </div>
  )
}

// Consistent top header for every sub-view
function SubViewHeader({ title, onBack, backLabel = 'Ayarlar' }) {
  return (
    <div className="flex-shrink-0 border-b border-slate-100 dark:border-night-border bg-white dark:bg-night-card px-4 pb-4 pt-4">
      <button
        type="button" onClick={onBack}
        className="mb-3 flex cursor-pointer items-center gap-1 text-sm font-medium text-emerald-600 dark:text-emerald-400 transition-colors hover:text-emerald-700 dark:hover:text-emerald-300"
      >
        <ChevronLeft />
        {backLabel}
      </button>
      <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
        KALORIMETRE
      </p>
      <h1 className="mt-0.5 text-2xl font-extrabold text-slate-900 dark:text-slate-100">{title}</h1>
    </div>
  )
}

// ─── Sub-view: Profil Bilgilerini Düzenle ─────────────────────────────────────

function ProfilDuzenleView({ onBack }) {
  const { profile, updateProfile } = useDiet()

  const savedGoalId = profile?.primaryGoal ?? goalOffsetToId(profile?.goalOffset)

  const [draft, setDraft] = useState({
    age:      String(profile?.age    ?? ''),
    weight:   String(profile?.weight ?? ''),
    height:   String(profile?.height ?? ''),
    gender:   profile?.gender   ?? 'erkek',
    activity: profile?.activity ?? 'moderate',
  })
  const [saveStatus, setSaveStatus] = useState('idle')

  const set = (k, v) => setDraft(prev => ({ ...prev, [k]: v }))

  const tdee = useMemo(
    () => calcTDEE(draft.age, draft.weight, draft.height, draft.gender, draft.activity),
    [draft.age, draft.weight, draft.height, draft.gender, draft.activity],
  )

  const targetKcal = tdee > 0 ? Math.max(1200, tdee + (GOAL_DELTAS[savedGoalId] ?? 0)) : 0
  const liveMacros = useMemo(() => calcMacros(targetKcal, savedGoalId), [targetKcal, savedGoalId])

  const hasChanges = (
    String(draft.age)    !== String(profile?.age    ?? '') ||
    String(draft.weight) !== String(profile?.weight ?? '') ||
    String(draft.height) !== String(profile?.height ?? '') ||
    draft.gender   !== (profile?.gender   ?? 'erkek')     ||
    draft.activity !== (profile?.activity ?? 'moderate')
  )

  function handleSave() {
    updateProfile({
      ...profile,
      age:      Number(draft.age),
      weight:   Number(draft.weight),
      height:   Number(draft.height),
      gender:   draft.gender,
      activity: draft.activity,
      tdee,
      dailyGoal: targetKcal,
    })
    setSaveStatus('saved')
    setTimeout(() => { setSaveStatus('idle'); onBack() }, 1200)
  }

  return (
    <SubViewContainer>
      <SubViewHeader title="Profil Bilgileri" onBack={onBack} />
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-5 px-4 py-6 pb-16">

          {/* Gender */}
          <div className="grid grid-cols-2 gap-2">
            {[{ id: 'erkek', label: '♂ Erkek' }, { id: 'kadin', label: '♀ Kadın' }].map(({ id, label }) => (
              <button key={id} type="button" onClick={() => set('gender', id)}
                className={`cursor-pointer rounded-2xl py-3 text-sm font-bold transition-all active:scale-95 ${
                  draft.gender === id
                    ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
                    : 'border-2 border-slate-200 dark:border-night-border bg-white dark:bg-night-card text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-night-muted'
                }`}
              >{label}</button>
            ))}
          </div>

          {/* Age / Height / Weight */}
          <div className="grid grid-cols-3 gap-3">
            <StatInput label="Yaş"  value={draft.age}    onChange={v => set('age', v)}    unit="yıl" min="10" />
            <StatInput label="Boy"  value={draft.height} onChange={v => set('height', v)} unit="cm"  min="100" />
            <StatInput label="Kilo" value={draft.weight} onChange={v => set('weight', v)} unit="kg"  min="30" step="0.1" />
          </div>

          {/* Activity Level */}
          <div>
            <p className="mb-2 text-[10px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500">
              Aktivite Seviyesi
            </p>
            <div className="space-y-2">
              {ACTIVITY_LEVELS.map(lvl => (
                <button key={lvl.id} type="button" onClick={() => set('activity', lvl.id)}
                  className={`flex w-full cursor-pointer items-center justify-between rounded-2xl px-4 py-3 transition-all active:scale-[0.99] ${
                    draft.activity === lvl.id
                      ? 'border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                      : 'border-2 border-transparent bg-white dark:bg-night-card hover:bg-slate-50 dark:hover:bg-night-muted'
                  }`}
                >
                  <div className="text-left">
                    <p className={`text-sm font-bold ${draft.activity === lvl.id ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'}`}>
                      {lvl.label}
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">{lvl.desc}</p>
                  </div>
                  <span className={`text-sm font-extrabold ${draft.activity === lvl.id ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>
                    ×{lvl.mult}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Live TDEE preview */}
          {tdee > 0 && (
            <div className="rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 p-5 text-white shadow-xl shadow-emerald-500/25">
              <p className="text-xs font-extrabold uppercase tracking-widest text-emerald-100">Canlı Hesaplama</p>
              <div className="mt-3 flex items-end justify-between">
                <div>
                  <p className="text-4xl font-extrabold">{targetKcal.toLocaleString('tr-TR')}</p>
                  <p className="text-sm font-semibold text-emerald-200">kcal / gün (hedef)</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-emerald-100">TDEE: {tdee.toLocaleString('tr-TR')}</p>
                  <p className="text-xs text-emerald-200">Mifflin-St Jeor</p>
                </div>
              </div>
              {liveMacros && (
                <>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {[
                      { icon: <ProteinIcon className="h-3 w-3 mx-auto text-emerald-200" />, label: 'Protein', val: liveMacros.protein },
                      { icon: <CarbsIcon   className="h-3 w-3 mx-auto text-emerald-200" />, label: 'Karb',    val: liveMacros.carbs   },
                      { icon: <FatIcon     className="h-3 w-3 mx-auto text-emerald-200" />, label: 'Yağ',     val: liveMacros.fat     },
                    ].map(({ icon, label, val }) => (
                      <div key={label} className="rounded-xl bg-white/20 px-2 py-2 text-center">
                        {icon}
                        <p className="mt-0.5 text-base font-extrabold text-white">{val}g</p>
                        <p className="text-[10px] font-semibold text-emerald-100">{label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-white/10 px-3 py-2 text-center">
                      <p className="text-base font-extrabold text-white">{liveMacros.fiber}g</p>
                      <p className="text-[10px] font-semibold text-emerald-100">Lif (min.)</p>
                    </div>
                    <div className="rounded-xl bg-white/10 px-3 py-2 text-center">
                      <p className="text-base font-extrabold text-white">{liveMacros.sugar}g</p>
                      <p className="text-[10px] font-semibold text-emerald-100">Şeker (maks.)</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Save */}
          <button
            type="button" onClick={handleSave}
            disabled={!hasChanges && saveStatus !== 'saved'}
            className={`w-full cursor-pointer rounded-3xl py-4 text-sm font-extrabold transition-all active:scale-95 ${
              saveStatus === 'saved'
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                : hasChanges
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 hover:bg-emerald-600 hover:shadow-xl'
                  : 'cursor-not-allowed bg-slate-200 dark:bg-night-muted text-slate-400 dark:text-slate-500'
            }`}
          >
            {saveStatus === 'saved' ? '✓ Kaydedildi!' : 'Kaydet'}
          </button>

        </div>
      </div>
    </SubViewContainer>
  )
}

// ─── Sub-view: Görünüm Ayarları ───────────────────────────────────────────────

function GorunumAyarlariView({ onBack }) {
  const { profile, updateProfile } = useDiet()
  const isDark = profile?.theme === 'dark' || profile?.theme === 'amoled'

  function handleToggle(nextDark) {
    const next = nextDark ? 'dark' : 'light'
    document.documentElement.classList.toggle('dark', nextDark)
    document.body.style.backgroundColor = nextDark ? '#0C0F1A' : ''
    updateProfile({ ...profile, theme: next })
  }

  return (
    <SubViewContainer>
      <SubViewHeader title="Görünüm" onBack={onBack} />
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-6">

          <div className="overflow-hidden rounded-2xl border border-slate-100 dark:border-night-border bg-white dark:bg-night-card shadow-sm">
            <button
              type="button" onClick={() => handleToggle(!isDark)}
              className="flex w-full cursor-pointer items-center justify-between px-5 py-4 transition-colors hover:bg-slate-50 dark:hover:bg-night-muted"
            >
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
                  isDark ? 'bg-slate-800 dark:bg-night-muted' : 'bg-amber-50'
                }`}>
                  {isDark ? (
                    <svg className="h-5 w-5 text-slate-300" viewBox="0 0 24 24" fill="currentColor">
                      <path fillRule="evenodd" d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5 text-amber-500" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" />
                    </svg>
                  )}
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    {isDark ? 'Koyu Mod' : 'Açık Mod'}
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    {isDark ? 'Gözleri korur, pil tasarruflu' : 'Parlak ve net görünüm'}
                  </p>
                </div>
              </div>
              <IOSToggle checked={isDark} onChange={handleToggle} />
            </button>
          </div>

        </div>
      </div>
    </SubViewContainer>
  )
}

// ─── Main Settings — pure navigation menu ────────────────────────────────────

export default function Settings() {
  const { profile } = useDiet()
  const [view,             setView]             = useState('menu')
  const [showHedefDuzenle, setShowHedefDuzenle] = useState(false)

  if (showHedefDuzenle) return <HedefDuzenle onClose={() => setShowHedefDuzenle(false)} backLabel="Ayarlar" />
  if (view === 'profil')  return <ProfilDuzenleView  onBack={() => setView('menu')} />
  if (view === 'gorunum') return <GorunumAyarlariView onBack={() => setView('menu')} />

  const isDark    = profile?.theme === 'dark' || profile?.theme === 'amoled'
  const goalLabel = GOAL_LABELS[profile?.primaryGoal ?? goalOffsetToId(profile?.goalOffset)] ?? 'Dengeli'

  const SECTIONS = [
    {
      label: 'Hesap & Hedef',
      rows: [
        {
          id: 'profil',
          title: 'Profil Bilgilerini Düzenle',
          subtitle: profile?.age
            ? `${profile.age} yaş · ${profile.weight} kg · ${profile.height} cm`
            : 'Yaş, kilo, boy ve aktivite seviyesi',
          iconBg:    'bg-emerald-50 dark:bg-emerald-900/20',
          iconColor: 'text-emerald-500',
          icon: (
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
          ),
          onClick: () => setView('profil'),
        },
        {
          id: 'hedef',
          title: 'Hedefleri Düzenle',
          subtitle: profile?.dailyGoal
            ? `${goalLabel} · ${Number(profile.dailyGoal).toLocaleString('tr-TR')} kcal/gün`
            : 'Kalori, makro oranları ve su hedefi',
          iconBg:    'bg-orange-50 dark:bg-orange-900/20',
          iconColor: 'text-orange-500',
          icon: (
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5M3 12h9.75m-9.75 0a1.5 1.5 0 003 0m-3 0a1.5 1.5 0 013 0m0 0H21m-9.75 6h5.25M3.75 18H7.5m10.5 0a1.5 1.5 0 10-3 0m3 0a1.5 1.5 0 11-3 0" />
            </svg>
          ),
          onClick: () => setShowHedefDuzenle(true),
        },
      ],
    },
    {
      label: 'Uygulama',
      rows: [
        {
          id: 'gorunum',
          title: 'Görünüm Ayarları',
          subtitle: isDark ? 'Koyu Mod etkin' : 'Açık Mod etkin',
          iconBg:    isDark ? 'bg-slate-800 dark:bg-night-muted' : 'bg-amber-50',
          iconColor: isDark ? 'text-slate-300' : 'text-amber-500',
          icon: isDark ? (
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" />
            </svg>
          ),
          onClick: () => setView('gorunum'),
        },
      ],
    },
  ]

  return (
    <div className="space-y-6 pb-10">

      {/* ── HEADER ── */}
      <div className="sticky top-0 z-10 -mx-4 border-b border-slate-100 dark:border-night-border bg-white/80 dark:bg-night-card/80 px-4 py-4 backdrop-blur-md">
        <h1 className="text-xl font-extrabold text-slate-900 dark:text-slate-100">Ayarlar</h1>
        <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
          Uygulama tercihlerin ve kişisel verilerini yönet
        </p>
      </div>

      {/* ── NAV SECTIONS ── */}
      {SECTIONS.map(section => (
        <div key={section.label}>
          <SectionLabel text={section.label} />
          <div className="overflow-hidden rounded-2xl border border-slate-100 dark:border-night-border bg-white dark:bg-night-card shadow-sm divide-y divide-slate-100 dark:divide-night-border">
            {section.rows.map(row => (
              <button
                key={row.id}
                type="button"
                onClick={row.onClick}
                className="flex w-full cursor-pointer items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-slate-50 dark:hover:bg-night-muted active:bg-slate-100 dark:active:bg-night-border"
              >
                <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${row.iconBg}`}>
                  <span className={row.iconColor}>{row.icon}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{row.title}</p>
                  <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{row.subtitle}</p>
                </div>
                <ChevronRight />
              </button>
            ))}
          </div>
        </div>
      ))}

    </div>
  )
}
