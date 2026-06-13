import { useState, useMemo } from 'react'
import { useDiet } from '../context/DietContext'

// ─── Constants ────────────────────────────────────────────────────────────────

const ACTIVITY_LEVELS = [
  { id: 'sedentary',   label: 'Hareketsiz',   desc: 'Masa başı iş, az hareket',    mult: 1.2  },
  { id: 'light',       label: 'Hafif Aktif',  desc: 'Haftada 1–3 gün egzersiz',    mult: 1.375 },
  { id: 'moderate',    label: 'Orta Aktif',   desc: 'Haftada 3–5 gün egzersiz',    mult: 1.55  },
  { id: 'active',      label: 'Çok Aktif',    desc: 'Haftada 6–7 gün ağır antrenman', mult: 1.725 },
  { id: 'veryActive',  label: 'Sporcu',       desc: 'Günde 2 kez antrenman',       mult: 1.9  },
]

const GOAL_OPTIONS = [
  { id: -500,  label: 'Kilo Ver',   desc: '–500 kcal',  color: 'text-orange-600' },
  { id: 0,     label: 'Dengeli',    desc: 'TDEE',       color: 'text-emerald-600' },
  { id: 500,   label: 'Kilo Al',    desc: '+500 kcal',  color: 'text-blue-600'   },
]

const THEMES = [
  { id: 'light',  label: 'Açık',        preview: 'bg-white border-2 border-slate-200'       },
  { id: 'dark',   label: 'Koyu',        preview: 'bg-slate-800'                              },
  { id: 'amoled', label: 'AMOLED Siyah', preview: 'bg-black border-2 border-slate-700'       },
]

function calcTDEE(age, weight, height, gender, activityId) {
  const a  = Number(age) || 0
  const w  = Number(weight) || 0
  const h  = Number(height) || 0
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
    <p className="mb-3 text-[11px] font-extrabold uppercase tracking-widest text-slate-400">{text}</p>
  )
}

function StatInput({ label, value, onChange, type = 'number', unit = '', min, step = '1', placeholder = '' }) {
  return (
    <div className="rounded-2xl border-2 border-slate-200 px-4 py-3 transition-all focus-within:border-emerald-400">
      <label className="block text-[10px] font-bold uppercase text-slate-400">{label}</label>
      <div className="flex items-baseline gap-1.5">
        <input
          type={type} inputMode={type === 'number' ? 'decimal' : undefined}
          min={min} step={step} value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent text-2xl font-extrabold text-slate-900 outline-none placeholder:text-slate-200"
        />
        {unit && <span className="text-sm font-semibold text-slate-400">{unit}</span>}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Settings() {
  const { profile, updateProfile } = useDiet()

  // Initialise draft from stored profile (or defaults)
  const [draft, setDraft] = useState({
    age:       String(profile?.age      ?? ''),
    weight:    String(profile?.weight   ?? ''),
    height:    String(profile?.height   ?? ''),
    gender:    profile?.gender          ?? 'erkek',
    activity:  profile?.activity        ?? 'moderate',
    goalOffset: Number(profile?.goalOffset ?? 0),
    waterGoal:  Number(profile?.waterGoal  ?? 8),
    theme:      profile?.theme            ?? 'light',
  })

  const [saveStatus, setSaveStatus] = useState('idle')  // 'idle' | 'saved'

  const p = (k, v) => setDraft(prev => ({ ...prev, [k]: v }))

  // Live TDEE calculation
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
    String(draft.age)      !== String(profile?.age      ?? '') ||
    String(draft.weight)   !== String(profile?.weight   ?? '') ||
    String(draft.height)   !== String(profile?.height   ?? '') ||
    draft.gender           !== (profile?.gender   ?? 'erkek')  ||
    draft.activity         !== (profile?.activity ?? 'moderate') ||
    draft.goalOffset       !== Number(profile?.goalOffset ?? 0) ||
    draft.waterGoal        !== Number(profile?.waterGoal  ?? 8) ||
    draft.theme            !== (profile?.theme ?? 'light')
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
      <div className="sticky top-0 z-10 -mx-4 border-b border-slate-100 bg-white/80 px-4 py-4 backdrop-blur-md">
        <h1 className="text-xl font-extrabold text-slate-900">Ayarlar</h1>
        <p className="mt-0.5 text-xs text-slate-400">Kişisel verilerini ve uygulama tercihlerini yönet</p>
      </div>

      {/* ── PERSONAL DATA ── */}
      <div>
        <SectionLabel text="Kişisel Veriler" />

        {/* Gender */}
        <div className="mb-4 grid grid-cols-2 gap-2">
          {[
            { id: 'erkek', label: 'Erkek' },
            { id: 'kadin', label: 'Kadın' },
          ].map(({ id, label }) => (
            <button key={id} type="button" onClick={() => p('gender', id)}
              className={`rounded-2xl py-3 text-sm font-bold transition-all ${
                draft.gender === id
                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}>
              {label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
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
              className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 transition-all ${
                draft.activity === lvl.id
                  ? 'border-2 border-emerald-500 bg-emerald-50'
                  : 'border-2 border-transparent bg-slate-100 hover:bg-slate-200'
              }`}>
              <div className="text-left">
                <p className={`text-sm font-bold ${draft.activity === lvl.id ? 'text-emerald-700' : 'text-slate-700'}`}>{lvl.label}</p>
                <p className="text-[11px] text-slate-400">{lvl.desc}</p>
              </div>
              <span className={`ml-2 text-sm font-extrabold ${draft.activity === lvl.id ? 'text-emerald-600' : 'text-slate-400'}`}>
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
              className={`rounded-2xl py-3 px-2 text-center transition-all ${
                draft.goalOffset === g.id
                  ? 'border-2 border-emerald-500 bg-emerald-50'
                  : 'border-2 border-transparent bg-slate-100 hover:bg-slate-200'
              }`}>
              <p className={`text-sm font-extrabold ${draft.goalOffset === g.id ? g.color : 'text-slate-700'}`}>{g.label}</p>
              <p className="mt-0.5 text-[10px] text-slate-400">{g.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* ── WATER GOAL ── */}
      <div>
        <SectionLabel text="Günlük Su Hedefi" />
        <div className="flex items-center justify-between rounded-2xl border-2 border-slate-200 px-5 py-4">
          <button type="button" onClick={() => p('waterGoal', Math.max(1, draft.waterGoal - 1))}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xl font-bold text-slate-600 hover:bg-slate-200 transition-colors">
            −
          </button>
          <div className="text-center">
            <p className="text-3xl font-extrabold text-slate-900">{draft.waterGoal}</p>
            <p className="text-xs font-semibold text-slate-400">bardak · {draft.waterGoal * 250} ml</p>
          </div>
          <button type="button" onClick={() => p('waterGoal', Math.min(16, draft.waterGoal + 1))}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-xl font-bold text-white hover:bg-emerald-600 transition-colors">
            +
          </button>
        </div>
      </div>

      {/* ── LIVE TDEE CARD ── */}
      {tdee > 0 && (
        <div className="rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 p-5 text-white shadow-xl shadow-emerald-200">
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
                { label: 'Protein', val: macros.protein, color: 'bg-white/20' },
                { label: 'Karb',    val: macros.carbs,   color: 'bg-white/20' },
                { label: 'Yağ',     val: macros.fat,     color: 'bg-white/20' },
              ].map(({ label, val, color }) => (
                <div key={label} className={`rounded-xl ${color} px-2 py-2 text-center`}>
                  <p className="text-base font-extrabold text-white">{val}g</p>
                  <p className="text-[10px] font-semibold text-emerald-100">{label}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── THEME SELECTOR ── */}
      <div>
        <SectionLabel text="Tema" />
        <div className="grid grid-cols-3 gap-3">
          {THEMES.map(th => (
            <button key={th.id} type="button" onClick={() => p('theme', th.id)}
              className={`flex flex-col items-center gap-2.5 rounded-2xl border-2 p-3 transition-all ${
                draft.theme === th.id
                  ? 'border-emerald-500 bg-emerald-50'
                  : 'border-transparent bg-slate-100 hover:bg-slate-200'
              }`}>
              <div className={`h-10 w-10 rounded-xl shadow-sm ${th.preview}`} />
              <p className={`text-xs font-bold ${draft.theme === th.id ? 'text-emerald-700' : 'text-slate-600'}`}>{th.label}</p>
            </button>
          ))}
        </div>
      </div>

      {/* ── SAVE BUTTON ── */}
      <button type="button" onClick={handleSave}
        disabled={!hasChanges && saveStatus !== 'saved'}
        className={`w-full rounded-3xl py-4 text-sm font-extrabold transition-all active:scale-95 ${
          saveStatus === 'saved'
            ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200'
            : hasChanges
              ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200 hover:bg-emerald-600'
              : 'cursor-not-allowed bg-slate-200 text-slate-400'
        }`}>
        {saveStatus === 'saved' ? 'Kaydedildi!' : 'Değişiklikleri Kaydet'}
      </button>

    </div>
  )
}
