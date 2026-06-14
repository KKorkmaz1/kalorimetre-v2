import { useState, useMemo } from 'react'
import { useDiet } from '../context/DietContext'

// ─── Constants ────────────────────────────────────────────────────────────────

const ACTIVITY_LEVELS = [
  { id: 'sedentary',  label: 'Hareketsiz',  desc: 'Masa başı iş, az hareket',         mult: 1.2   },
  { id: 'light',      label: 'Hafif Aktif', desc: 'Haftada 1–3 gün egzersiz',         mult: 1.375 },
  { id: 'moderate',   label: 'Orta Aktif',  desc: 'Haftada 3–5 gün egzersiz',         mult: 1.55  },
  { id: 'active',     label: 'Çok Aktif',   desc: 'Haftada 6–7 gün ağır antrenman',   mult: 1.725 },
  { id: 'veryActive', label: 'Sporcu',      desc: 'Günde 2 kez antrenman',            mult: 1.9   },
]

const GOAL_OPTIONS = [
  { id: -500, label: 'Kilo Ver', desc: '–500 kcal', color: 'text-orange-600 dark:text-orange-400' },
  { id: 0,    label: 'Dengeli',  desc: 'TDEE',      color: 'text-emerald-600 dark:text-emerald-400' },
  { id: 500,  label: 'Kilo Al',  desc: '+500 kcal', color: 'text-blue-600 dark:text-blue-400'   },
]

function calcTDEE(age, weight, height, gender, activityId) {
  const a    = Number(age)    || 0
  const w    = Number(weight) || 0
  const h    = Number(height) || 0
  const mult = ACTIVITY_LEVELS.find(l => l.id === activityId)?.mult ?? 1.2
  if (!a || !w || !h) return 0
  const bmr = gender === 'kadin'
    ? 10 * w + 6.25 * h - 5 * a - 161
    : 10 * w + 6.25 * h - 5 * a + 5
  return Math.round(bmr * mult)
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ text }) {
  return (
    <p className="mb-3 text-[11px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500">
      {text}
    </p>
  )
}

function StatInput({ label, value, onChange, type = 'number', unit = '', min, step = '1', placeholder = '' }) {
  return (
    <div className="rounded-2xl border-2 border-slate-200 dark:border-night-border bg-white dark:bg-night-card px-4 py-3 transition-all focus-within:border-emerald-400 dark:focus-within:border-emerald-500">
      <label className="block text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500">{label}</label>
      <div className="flex items-baseline gap-1.5">
        <input
          type={type} inputMode={type === 'number' ? 'decimal' : undefined}
          min={min} step={step} value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent text-2xl font-extrabold text-slate-900 dark:text-slate-100 outline-none placeholder:text-slate-200 dark:placeholder:text-night-muted"
        />
        {unit && <span className="text-sm font-semibold text-slate-400 dark:text-slate-500">{unit}</span>}
      </div>
    </div>
  )
}

// ─── iOS-style toggle switch ──────────────────────────────────────────────────

function IOSToggle({ checked, onChange, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-night-card ${
        checked ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-night-muted'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-300 ${
          checked ? 'translate-x-[26px]' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Settings() {
  const { profile, updateProfile } = useDiet()

  const [draft, setDraft] = useState({
    age:        String(profile?.age       ?? ''),
    weight:     String(profile?.weight    ?? ''),
    height:     String(profile?.height    ?? ''),
    gender:     profile?.gender           ?? 'erkek',
    activity:   profile?.activity         ?? 'moderate',
    goalOffset: Number(profile?.goalOffset ?? 0),
    waterGoal:  Number(profile?.waterGoal  ?? 8),
    theme:      profile?.theme             ?? 'light',
  })

  const [saveStatus, setSaveStatus] = useState('idle')

  const p = (k, v) => setDraft(prev => ({ ...prev, [k]: v }))

  const isDark = draft.theme === 'dark' || draft.theme === 'amoled'

  // Immediately preview the theme toggle — no save needed
  function handleThemeToggle(nextDark) {
    const next = nextDark ? 'dark' : 'light'
    p('theme', next)
    document.documentElement.classList.toggle('dark', nextDark)
    document.body.style.backgroundColor = nextDark ? '#0C0F1A' : ''
  }

  // Live TDEE
  const tdee = useMemo(
    () => calcTDEE(draft.age, draft.weight, draft.height, draft.gender, draft.activity),
    [draft.age, draft.weight, draft.height, draft.gender, draft.activity],
  )
  const targetKcal = tdee > 0 ? Math.max(1200, tdee + draft.goalOffset) : 0

  const macros = useMemo(() => {
    if (!targetKcal) return null
    return {
      protein: Math.round(targetKcal * 0.30 / 4),
      carbs:   Math.round(targetKcal * 0.45 / 4),
      fat:     Math.round(targetKcal * 0.25 / 9),
    }
  }, [targetKcal])

  const hasChanges = (
    String(draft.age)    !== String(profile?.age      ?? '') ||
    String(draft.weight) !== String(profile?.weight   ?? '') ||
    String(draft.height) !== String(profile?.height   ?? '') ||
    draft.gender         !== (profile?.gender   ?? 'erkek')  ||
    draft.activity       !== (profile?.activity ?? 'moderate') ||
    draft.goalOffset     !== Number(profile?.goalOffset ?? 0) ||
    draft.waterGoal      !== Number(profile?.waterGoal  ?? 8) ||
    draft.theme          !== (profile?.theme ?? 'light')
  )

  function handleSave() {
    updateProfile({
      ...profile,
      age:        Number(draft.age),
      weight:     Number(draft.weight),
      height:     Number(draft.height),
      gender:     draft.gender,
      activity:   draft.activity,
      tdee,
      dailyGoal:  targetKcal,
      goalOffset: draft.goalOffset,
      waterGoal:  draft.waterGoal,
      theme:      draft.theme,
    })
    setSaveStatus('saved')
    setTimeout(() => setSaveStatus('idle'), 2000)
  }

  return (
    <div className="space-y-6 pb-10">

      {/* ── HEADER ── */}
      <div className="sticky top-0 z-10 -mx-4 border-b border-slate-100 dark:border-night-border bg-white/80 dark:bg-night-card/80 px-4 py-4 backdrop-blur-md">
        <h1 className="text-xl font-extrabold text-slate-900 dark:text-slate-100">Ayarlar</h1>
        <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">Kişisel verilerini ve uygulama tercihlerini yönet</p>
      </div>

      {/* ── PERSONAL DATA ── */}
      <div>
        <SectionLabel text="Kişisel Veriler" />

        <div className="mb-4 grid grid-cols-2 gap-2">
          {[
            { id: 'erkek', label: '♂ Erkek' },
            { id: 'kadin', label: '♀ Kadın' },
          ].map(({ id, label }) => (
            <button key={id} type="button" onClick={() => p('gender', id)}
              className={`cursor-pointer rounded-2xl py-3 text-sm font-bold transition-all active:scale-95 ${
                draft.gender === id
                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
                  : 'bg-slate-100 dark:bg-night-muted text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-night-border'
              }`}>
              {label}
            </button>
          ))}
        </div>

        <div className="mb-4 grid grid-cols-3 gap-3">
          <StatInput label="Yaş"  value={draft.age}    onChange={v => p('age', v)}    unit="yıl" min="10" />
          <StatInput label="Boy"  value={draft.height} onChange={v => p('height', v)} unit="cm"  min="100" />
          <StatInput label="Kilo" value={draft.weight} onChange={v => p('weight', v)} unit="kg"  min="30" step="0.1" />
        </div>
      </div>

      {/* ── ACTIVITY LEVEL ── */}
      <div>
        <SectionLabel text="Aktivite Seviyesi" />
        <div className="space-y-2">
          {ACTIVITY_LEVELS.map(lvl => (
            <button key={lvl.id} type="button" onClick={() => p('activity', lvl.id)}
              className={`flex w-full cursor-pointer items-center justify-between rounded-2xl px-4 py-3 transition-all active:scale-[0.99] ${
                draft.activity === lvl.id
                  ? 'border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                  : 'border-2 border-transparent bg-slate-100 dark:bg-night-muted hover:bg-slate-200 dark:hover:bg-night-border'
              }`}>
              <div className="text-left">
                <p className={`text-sm font-bold ${draft.activity === lvl.id ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'}`}>{lvl.label}</p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">{lvl.desc}</p>
              </div>
              <span className={`ml-2 text-sm font-extrabold ${draft.activity === lvl.id ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>
                ×{lvl.mult}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── CALORIE GOAL ── */}
      <div>
        <SectionLabel text="Kalori Hedefi" />
        <div className="grid grid-cols-3 gap-2">
          {GOAL_OPTIONS.map(g => (
            <button key={g.id} type="button" onClick={() => p('goalOffset', g.id)}
              className={`cursor-pointer rounded-2xl px-2 py-3 text-center transition-all active:scale-95 ${
                draft.goalOffset === g.id
                  ? 'border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                  : 'border-2 border-transparent bg-slate-100 dark:bg-night-muted hover:bg-slate-200 dark:hover:bg-night-border'
              }`}>
              <p className={`text-sm font-extrabold ${draft.goalOffset === g.id ? g.color : 'text-slate-700 dark:text-slate-300'}`}>{g.label}</p>
              <p className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500">{g.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* ── WATER GOAL ── */}
      <div>
        <SectionLabel text="Günlük Su Hedefi" />
        <div className="flex items-center justify-between rounded-2xl border-2 border-slate-200 dark:border-night-border bg-white dark:bg-night-card px-5 py-4">
          <button type="button" onClick={() => p('waterGoal', Math.max(1, draft.waterGoal - 1))}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-slate-100 dark:bg-night-muted text-xl font-bold text-slate-600 dark:text-slate-300 transition-colors hover:bg-slate-200 dark:hover:bg-night-border active:scale-90">
            −
          </button>
          <div className="text-center">
            <p className="text-3xl font-extrabold text-slate-900 dark:text-slate-100">{draft.waterGoal}</p>
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">bardak · {draft.waterGoal * 250} ml</p>
          </div>
          <button type="button" onClick={() => p('waterGoal', Math.min(16, draft.waterGoal + 1))}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-emerald-500 text-xl font-bold text-white transition-colors hover:bg-emerald-600 active:scale-90">
            +
          </button>
        </div>
      </div>

      {/* ── LIVE TDEE CARD ── */}
      {tdee > 0 && (
        <div className="rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 p-5 text-white shadow-xl shadow-emerald-500/25">
          <p className="text-xs font-extrabold uppercase tracking-widest text-emerald-100">Canlı Hesaplama</p>
          <div className="mt-3 flex items-end justify-between">
            <div>
              <p className="text-4xl font-extrabold">{targetKcal.toLocaleString('tr-TR')}</p>
              <p className="text-sm font-semibold text-emerald-200">kcal / gün (hedef)</p>
            </div>
            <div className="text-right text-sm">
              <p className="font-bold text-emerald-100">TDEE: {tdee.toLocaleString('tr-TR')}</p>
              <p className="text-xs text-emerald-200">
                {draft.goalOffset > 0 ? `+${draft.goalOffset}` : draft.goalOffset !== 0 ? draft.goalOffset : 'Dengeli'}
                {' '}kcal hedef
              </p>
            </div>
          </div>
          {macros && (
            <div className="mt-4 grid grid-cols-3 gap-2">
              {[
                { label: '💪 Protein', val: macros.protein },
                { label: '🌾 Karb',    val: macros.carbs   },
                { label: '💧 Yağ',     val: macros.fat     },
              ].map(({ label, val }) => (
                <div key={label} className="rounded-xl bg-white/20 px-2 py-2 text-center">
                  <p className="text-base font-extrabold text-white">{val}g</p>
                  <p className="text-[10px] font-semibold text-emerald-100">{label}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── THEME — iOS toggle (Light / Dark) ── */}
      <div>
        <SectionLabel text="Görünüm" />
        <div className="overflow-hidden rounded-2xl border-2 border-slate-200 dark:border-night-border bg-white dark:bg-night-card">
          <button
            type="button"
            onClick={() => handleThemeToggle(!isDark)}
            className="flex w-full cursor-pointer items-center justify-between px-5 py-4 transition-colors hover:bg-slate-50 dark:hover:bg-night-muted"
          >
            {/* Left: icon + label */}
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
                isDark ? 'bg-slate-800 dark:bg-night-muted' : 'bg-amber-50 dark:bg-amber-900/20'
              }`}>
                {isDark ? (
                  /* Moon icon */
                  <svg className="h-5 w-5 text-slate-300" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z" clipRule="evenodd" />
                  </svg>
                ) : (
                  /* Sun icon */
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

            {/* iOS toggle */}
            <IOSToggle checked={isDark} onChange={handleThemeToggle} />
          </button>
        </div>
      </div>

      {/* ── SAVE BUTTON ── */}
      <button
        type="button"
        onClick={handleSave}
        disabled={!hasChanges && saveStatus !== 'saved'}
        className={`w-full cursor-pointer rounded-3xl py-4 text-sm font-extrabold transition-all active:scale-95 ${
          saveStatus === 'saved'
            ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
            : hasChanges
              ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 hover:bg-emerald-600 hover:shadow-xl'
              : 'cursor-not-allowed bg-slate-200 dark:bg-night-muted text-slate-400 dark:text-slate-500'
        }`}>
        {saveStatus === 'saved' ? '✓ Kaydedildi!' : 'Değişiklikleri Kaydet'}
      </button>

    </div>
  )
}
