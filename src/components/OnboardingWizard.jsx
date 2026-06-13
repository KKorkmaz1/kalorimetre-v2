import { useState, useRef } from 'react'
import { saveUserProfile } from '../utils/storage'

// ─── Constants ────────────────────────────────────────────────────────────────

const ACTIVITY_LEVELS = [
  { id: 'sedanter',    label: 'Sedanter',      desc: 'Masa başı iş, egzersiz yok' },
  { id: 'az_aktif',   label: 'Az Aktif',       desc: 'Haftada 1–3 gün hafif egzersiz' },
  { id: 'orta_aktif', label: 'Orta Aktif',     desc: 'Haftada 3–5 gün orta egzersiz' },
  { id: 'cok_aktif',  label: 'Çok Aktif',      desc: 'Haftada 6–7 gün yoğun egzersiz' },
  { id: 'ekstra',     label: 'Ekstra Aktif',   desc: 'Profesyonel spor veya ağır fiziksel iş' },
]

const ACTIVITY_MULTIPLIERS = {
  sedanter: 1.2, az_aktif: 1.375, orta_aktif: 1.55, cok_aktif: 1.725, ekstra: 1.9,
}

const HEALTH_CONDITIONS = [
  { id: 'diyabet',    label: 'Diyabet' },
  { id: 'tansiyon',   label: 'Tansiyon' },
  { id: 'colyak',     label: 'Çölyak' },
  { id: 'laktoz',     label: 'Laktoz İntoleransı' },
  { id: 'kuruyemis',  label: 'Kuruyemiş Alerjisi' },
  { id: 'hicbiri',    label: 'Hiçbiri' },
]

const MOCK_MEALS = [
  { time: 'Kahvaltı',  meal: 'Yulaf ezmesi, elma, badem sütü',              kcal: 350 },
  { time: 'Öğle',      meal: 'Izgara tavuk, kinoa, ıspanak salatası',        kcal: 520 },
  { time: 'Ara Öğün',  meal: 'Badem, taze meyve karışımı',                   kcal: 200 },
  { time: 'Akşam',     meal: 'Somon fileto, buharda brokoli, tatlı patates', kcal: 480 },
]

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function calcTDEE({ gender, age, height, weight, activity }) {
  const w = parseFloat(weight)
  const h = parseFloat(height)
  const a = parseInt(age, 10)
  if (!w || !h || !a || !gender || !activity) return null
  const bmr = gender === 'erkek'
    ? 10 * w + 6.25 * h - 5 * a + 5
    : 10 * w + 6.25 * h - 5 * a - 161
  return Math.round(bmr * (ACTIVITY_MULTIPLIERS[activity] ?? 1.2))
}

// ─── Shared primitives ────────────────────────────────────────────────────────

function CheckIcon({ className = 'h-3 w-3' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  )
}

function RadioDot({ selected }) {
  return (
    <span className={`mt-0.5 h-4 w-4 flex-shrink-0 rounded-full border-2 transition-all ${
      selected ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300'
    }`} />
  )
}

function ProgressBar({ current, total }) {
  const pct = Math.round((current / total) * 100)
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-slate-400">Adım {current} / {total}</span>
        <span className="text-xs font-bold text-emerald-600">{pct}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ─── Step 1 — Basic Stats ─────────────────────────────────────────────────────

function Step1BasicStats({ stats, onChange }) {
  return (
    <div className="space-y-7">

      {/* Gender */}
      <div>
        <p className="mb-3 text-sm font-semibold text-slate-700">Cinsiyet</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            {
              id: 'erkek', label: 'Erkek',
              icon: (
                <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="11" cy="11" r="6.5" /><path strokeLinecap="round" d="M16 6l4-4m0 0h-4m4 0v4" />
                </svg>
              ),
            },
            {
              id: 'kadin', label: 'Kadın',
              icon: (
                <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="12" cy="9" r="6.5" /><path strokeLinecap="round" d="M12 15.5v5m-2.5-2.5h5" />
                </svg>
              ),
            },
          ].map(({ id, label, icon }) => {
            const active = stats.gender === id
            return (
              <button
                key={id} type="button"
                onClick={() => onChange({ ...stats, gender: id })}
                className={`flex flex-col items-center gap-2.5 rounded-2xl border-2 py-5 transition-all ${
                  active ? 'border-emerald-500 bg-emerald-50 text-emerald-600 shadow-sm shadow-emerald-100' : 'border-slate-200 bg-white text-slate-400 hover:border-slate-300'
                }`}
              >
                {icon}
                <span className={`text-sm font-semibold ${active ? 'text-emerald-700' : 'text-slate-600'}`}>{label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Age / Height / Weight */}
      <div>
        <p className="mb-3 text-sm font-semibold text-slate-700">Vücut Ölçüleri</p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { key: 'age',    label: 'Yaş',  unit: 'yıl', ph: '25',  min: 10,  max: 120 },
            { key: 'height', label: 'Boy',  unit: 'cm',  ph: '170', min: 100, max: 250 },
            { key: 'weight', label: 'Kilo', unit: 'kg',  ph: '70',  min: 30,  max: 350 },
          ].map(({ key, label, unit, ph, min, max }) => (
            <div
              key={key}
              className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white px-2 py-3 shadow-sm"
            >
              <p className="mb-1 text-xs font-medium text-slate-500">{label}</p>
              <input
                type="number" inputMode="numeric"
                min={min} max={max}
                value={stats[key]}
                onChange={e => onChange({ ...stats, [key]: e.target.value })}
                placeholder={ph}
                className="w-full border-0 bg-transparent text-center text-xl font-bold text-slate-900 outline-none placeholder:text-slate-300"
              />
              <p className="mt-0.5 text-xs font-medium text-slate-400">{unit}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Activity */}
      <div>
        <p className="mb-3 text-sm font-semibold text-slate-700">Hareketlilik Düzeyi</p>
        <div className="space-y-2">
          {ACTIVITY_LEVELS.map(({ id, label, desc }) => {
            const active = stats.activity === id
            return (
              <button
                key={id} type="button"
                onClick={() => onChange({ ...stats, activity: id })}
                className={`flex w-full items-center gap-4 rounded-xl border-2 px-4 py-3 text-left transition-all ${
                  active ? 'border-emerald-500 bg-emerald-50' : 'border-slate-100 bg-white hover:border-slate-200'
                }`}
              >
                <RadioDot selected={active} />
                <div>
                  <p className={`text-sm font-semibold ${active ? 'text-emerald-800' : 'text-slate-800'}`}>{label}</p>
                  <p className="text-xs text-slate-500">{desc}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Step 2 — Health Profile ──────────────────────────────────────────────────

function Step2HealthProfile({ conditions, onToggle }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
        <p className="text-xs leading-relaxed text-amber-800">
          Bu bilgiler yapay zekanın size özel, güvenli öneriler sunması için kullanılır. Yalnızca cihazınızda saklanır ve hiçbir sunucuya gönderilmez.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {HEALTH_CONDITIONS.map(({ id, label }) => {
          const selected = conditions.includes(id)
          const isNone = id === 'hicbiri'
          return (
            <button
              key={id} type="button"
              onClick={() => onToggle(id)}
              className={[
                'flex items-center gap-3 rounded-2xl border-2 px-4 py-4 text-left transition-all',
                isNone ? 'col-span-2 justify-center' : '',
                selected
                  ? isNone
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-rose-400 bg-rose-50'
                  : 'border-slate-200 bg-white hover:border-slate-300',
              ].filter(Boolean).join(' ')}
            >
              <span className={`text-sm font-semibold ${
                selected ? (isNone ? 'text-emerald-700' : 'text-rose-700') : 'text-slate-700'
              }`}>
                {label}
              </span>
              <span className={`ml-auto flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full transition-all ${
                selected
                  ? isNone ? 'bg-emerald-500' : 'bg-rose-400'
                  : 'border-2 border-slate-200'
              }`}>
                {selected && <CheckIcon />}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Step 3 — Path Selection ──────────────────────────────────────────────────

function Step3PathSelection({ mode, onSelect }) {
  const PATHS = [
    {
      id: 'ocr',
      title: 'Diyetisyen Listemi Okut',
      badge: 'Yapay Zeka OCR',
      desc: 'Diyetisyeninizin hazırladığı beslenme listesini fotoğraflayın veya yükleyin; yapay zeka saniyeler içinde dijitalleştirsin.',
      icon: (
        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
        </svg>
      ),
    },
    {
      id: 'manual',
      title: 'Standart Hedef Belirle',
      badge: 'Mifflin-St Jeor',
      desc: 'Girdiğiniz istatistiklere göre günlük kalori ve makro hedeflerinizi bilimsel formülle otomatik hesaplayalım.',
      icon: (
        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
      ),
    },
  ]

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">
        Başlamak için bir yöntem seçin. Bunu istediğiniz zaman profilinizden değiştirebilirsiniz.
      </p>
      {PATHS.map(({ id, title, badge, desc, icon }) => {
        const active = mode === id
        return (
          <button
            key={id} type="button"
            onClick={() => onSelect(id)}
            className={`group flex w-full items-start gap-4 rounded-2xl border-2 p-5 text-left transition-all duration-200 ${
              active
                ? 'border-emerald-500 bg-emerald-50 shadow-lg shadow-emerald-100'
                : 'border-slate-200 bg-white hover:border-emerald-200 hover:shadow-sm'
            }`}
          >
            <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl transition-all ${
              active
                ? 'bg-emerald-500 text-white shadow-md shadow-emerald-300'
                : 'bg-slate-100 text-slate-500 group-hover:bg-emerald-50 group-hover:text-emerald-600'
            }`}>
              {icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className={`text-base font-bold ${active ? 'text-emerald-900' : 'text-slate-900'}`}>{title}</p>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  active ? 'bg-emerald-200 text-emerald-700' : 'bg-slate-100 text-slate-500'
                }`}>{badge}</span>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{desc}</p>
            </div>
            <div className={`mt-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition-all ${
              active ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300'
            }`}>
              {active && <CheckIcon />}
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ─── Step 4 — OCR Upload ──────────────────────────────────────────────────────

function Step4OCRUpload({ ocrState, onSimulate }) {
  const fileInputRef = useRef(null)

  if (ocrState === 'scanning') {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        {/* Spinner with brain icon */}
        <div className="relative mb-8">
          <div className="h-24 w-24 animate-spin rounded-full border-4 border-slate-100 border-t-emerald-500" />
          <div className="absolute inset-0 flex items-center justify-center">
            <svg className="h-10 w-10 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
            </svg>
          </div>
        </div>
        <h3 className="text-xl font-extrabold text-slate-900">Analiz ediliyor...</h3>
        <p className="mt-2 max-w-xs text-sm text-slate-500">
          Yapay zeka listenizi tarayıp öğünleri ve kalori değerlerini tanımlıyor
        </p>
        <div className="mt-6 flex gap-2">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="h-2.5 w-2.5 animate-bounce rounded-full bg-emerald-400"
              style={{ animationDelay: `${i * 0.18}s` }}
            />
          ))}
        </div>
      </div>
    )
  }

  if (ocrState === 'success') {
    const total = MOCK_MEALS.reduce((s, m) => s + m.kcal, 0)
    return (
      <div className="space-y-4">
        {/* Success banner */}
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500 shadow-md shadow-emerald-200">
            <CheckIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-emerald-800">Listeniz başarıyla dijitalleştirildi!</p>
            <p className="mt-0.5 text-xs text-emerald-600">{MOCK_MEALS.length} öğün tespit edildi · Toplam {total} kcal/gün</p>
          </div>
        </div>

        {/* Detected meals */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100 shadow-sm">
          {MOCK_MEALS.map(({ time, meal, kcal }, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3.5">
              <div className="min-w-0 flex-1 pr-3">
                <p className="text-xs font-bold text-emerald-600">{time}</p>
                <p className="mt-0.5 text-sm text-slate-700">{meal}</p>
              </div>
              <span className="flex-shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                {kcal} kcal
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between bg-emerald-50 px-4 py-3.5">
            <p className="text-sm font-bold text-slate-700">Günlük Toplam</p>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
              {total} kcal
            </span>
          </div>
        </div>
      </div>
    )
  }

  // idle
  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-slate-500">
        Diyetisyeninizin verdiği beslenme listesini yükleyin veya fotoğraflayın. Yapay zeka, öğünleri ve kalori değerlerini otomatik tanıyacak.
      </p>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        onChange={onSimulate}
      />

      {/* Upload drop zone */}
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="group flex w-full flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-10 transition-all hover:border-emerald-400 hover:bg-emerald-50"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm transition-colors group-hover:bg-emerald-100">
          <svg className="h-8 w-8 text-slate-400 transition-colors group-hover:text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-700 transition-colors group-hover:text-emerald-700">
            Dosya Seç veya Sürükle
          </p>
          <p className="mt-1 text-xs text-slate-500">PNG, JPG veya PDF · Maks. 10 MB</p>
        </div>
      </button>

      <div className="flex items-center gap-3">
        <div className="flex-1 border-t border-slate-200" />
        <span className="text-xs text-slate-400">ya da</span>
        <div className="flex-1 border-t border-slate-200" />
      </div>

      {/* Camera button */}
      <button
        type="button"
        onClick={onSimulate}
        className="flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-slate-200 bg-white py-4 text-sm font-bold text-slate-700 transition-all hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
        </svg>
        Fotoğraf Çek
      </button>
    </div>
  )
}

// ─── Wizard orchestrator ──────────────────────────────────────────────────────

const STEP_META = [
  { title: 'Temel Bilgiler',  subtitle: 'Kişisel istatistiklerinizi girin' },
  { title: 'Sağlık Profili',  subtitle: 'Sağlık durumunuzu belirtin' },
  { title: 'Mod Seçimi',      subtitle: 'Nasıl başlamak istersiniz?' },
  { title: 'Liste Yükle',     subtitle: 'Diyetisyen listenizi yükleyin' },
]

export default function OnboardingWizard({ onComplete }) {
  const [step, setStep] = useState(1)
  const [stats, setStats] = useState({ gender: '', age: '', height: '', weight: '', activity: '' })
  const [healthConditions, setHealthConditions] = useState([])
  const [mode, setMode] = useState('')
  const [ocrState, setOcrState] = useState('idle') // 'idle' | 'scanning' | 'success'

  const totalSteps = mode === 'manual' ? 3 : 4
  const tdee = calcTDEE(stats)
  const meta = STEP_META[step - 1]

  // ── Health toggle logic ───────────────────────────────────────────────────
  function handleHealthToggle(id) {
    if (id === 'hicbiri') {
      setHealthConditions(prev => (prev.includes('hicbiri') ? [] : ['hicbiri']))
    } else {
      setHealthConditions(prev => {
        const without = prev.filter(c => c !== 'hicbiri')
        return without.includes(id)
          ? without.filter(c => c !== id)
          : [...without, id]
      })
    }
  }

  // ── Validation ────────────────────────────────────────────────────────────
  function canProceed() {
    if (step === 1) return !!(stats.gender && stats.age && stats.height && stats.weight && stats.activity)
    if (step === 2) return healthConditions.length > 0
    if (step === 3) return !!mode
    if (step === 4) return ocrState === 'success'
    return true
  }

  // ── Navigation ────────────────────────────────────────────────────────────
  function handleNext() {
    if (step === 3 && mode === 'manual') { finish(); return }
    if (step === totalSteps)            { finish(); return }
    setStep(s => s + 1)
  }

  function handleBack() {
    if (ocrState !== 'idle') setOcrState('idle')
    setStep(s => s - 1)
  }

  function startScan() {
    setOcrState('scanning')
    setTimeout(() => setOcrState('success'), 3000)
  }

  // ── Complete & save ───────────────────────────────────────────────────────
  function finish() {
    const profile = {
      stats,
      healthConditions,
      mode,
      tdee: tdee ?? null,
      macros: tdee
        ? {
            protein: Math.round((tdee * 0.30) / 4),
            carbs:   Math.round((tdee * 0.40) / 4),
            fat:     Math.round((tdee * 0.30) / 9),
          }
        : null,
      dietPlan: ocrState === 'success' ? MOCK_MEALS : null,
    }
    saveUserProfile(profile)
    onComplete(profile)
  }

  const isLastStep = (step === 3 && mode === 'manual') || step === totalSteps
  const isScanning = ocrState === 'scanning'

  return (
    <div className="mx-auto flex min-h-svh max-w-app flex-col bg-white">

      {/* Gradient accent bar */}
      <div className="h-1.5 w-full bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-400" />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="px-6 pb-5 pt-8">
        {/* Logo */}
        <div className="mb-7 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 shadow-md shadow-emerald-200">
            <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
            </svg>
          </div>
          <span className="text-sm font-bold tracking-tight text-slate-800">Kalorimetre</span>
        </div>

        <ProgressBar current={step} total={totalSteps} />

        <div className="mt-5">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{meta.title}</h1>
          <p className="mt-1 text-sm text-slate-500">{meta.subtitle}</p>
        </div>
      </div>

      {/* ── Scrollable content ──────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-6 pb-4">
        {step === 1 && <Step1BasicStats stats={stats} onChange={setStats} />}
        {step === 2 && <Step2HealthProfile conditions={healthConditions} onToggle={handleHealthToggle} />}
        {step === 3 && <Step3PathSelection mode={mode} onSelect={setMode} />}
        {step === 4 && <Step4OCRUpload ocrState={ocrState} onSimulate={startScan} />}
      </div>

      {/* ── Live TDEE card (step 1, once all fields are filled) ─────────────── */}
      {step === 1 && tdee && (
        <div className="mx-6 mb-4">
          <div className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-4 shadow-xl shadow-emerald-200">
            <div>
              <p className="text-xs font-semibold text-emerald-100">Günlük Kalori Hedefiniz</p>
              <p className="mt-0.5 text-3xl font-extrabold text-white">
                {tdee.toLocaleString('tr-TR')}
                <span className="ml-1 text-base font-medium text-emerald-200">kcal</span>
              </p>
              <p className="mt-1 text-xs text-emerald-300">Mifflin-St Jeor · canlı hesaplama</p>
            </div>
            <svg className="h-10 w-10 text-white/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" />
            </svg>
          </div>
        </div>
      )}

      {/* ── Bottom navigation ────────────────────────────────────────────────── */}
      <div className="px-6 pb-10 pt-2">
        <div className="flex gap-3">
          {step > 1 && !isScanning && (
            <button
              type="button"
              onClick={handleBack}
              className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl border-2 border-slate-200 bg-white text-slate-500 transition-all hover:border-slate-300 active:scale-95"
            >
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
              </svg>
            </button>
          )}

          <button
            type="button"
            onClick={handleNext}
            disabled={!canProceed() || isScanning}
            className={`flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl text-sm font-bold transition-all ${
              canProceed() && !isScanning
                ? 'bg-emerald-500 text-white shadow-xl shadow-emerald-200 hover:bg-emerald-600 active:scale-95'
                : 'cursor-not-allowed bg-slate-100 text-slate-400'
            }`}
          >
            {isScanning ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Analiz ediliyor...
              </>
            ) : isLastStep ? (
              <>
                Başlayalım
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </>
            ) : (
              <>
                İleri
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                </svg>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
