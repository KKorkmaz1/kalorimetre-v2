import { useState, useRef, useMemo } from 'react'
import { macroCalculator } from '../utils/macroCalculator'
import { GOAL_OPTIONS } from '../constants/goalOptions'
import { supabase } from '../utils/supabaseClient'

// ─── Constants ────────────────────────────────────────────────────────────────

const ACTIVITY_LEVELS = [
  { id: 'sedanter',    label: 'Hareketsiz',     desc: 'Masa başı iş, egzersiz yok',              mult: 1.2   },
  { id: 'az_aktif',   label: 'Hafif Aktif',     desc: 'Haftada 1–3 gün hafif egzersiz',           mult: 1.375 },
  { id: 'orta_aktif', label: 'Orta Aktif',      desc: 'Haftada 3–5 gün orta egzersiz',            mult: 1.55  },
  { id: 'cok_aktif',  label: 'Çok Aktif',       desc: 'Haftada 6–7 gün yoğun egzersiz',           mult: 1.725 },
  { id: 'ekstra',     label: 'Ekstra Aktif',    desc: 'Profesyonel spor veya ağır fiziksel iş',   mult: 1.9   },
]

const DIET_PHILOSOPHIES = [
  {
    id: 'standart', label: 'Standart', desc: 'Dengeli, karma beslenme — et, sebze, tahıl',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
      </svg>
    ),
  },
  {
    id: 'vegan', label: 'Vegan', desc: 'Tüm hayvansal ürünler hariç',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75M7.5 21h9M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
      </svg>
    ),
  },
  {
    id: 'vejetaryen', label: 'Vejetaryen', desc: 'Et yok; süt, yumurta serbes',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
      </svg>
    ),
  },
  {
    id: 'keto', label: 'Ketojenik', desc: 'Düşük karbonhidrat, yüksek yağ',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
  },
  {
    id: 'akdeniz', label: 'Akdeniz', desc: 'Balık, zeytinyağı, baklagil, sebze',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
      </svg>
    ),
  },
]

const ALLERGENS = [
  { id: 'gluten',         label: 'Gluten',          desc: 'Buğday, arpa, çavdar' },
  { id: 'laktoz',         label: 'Laktoz',           desc: 'Süt ve süt ürünleri' },
  { id: 'kuruyemis',      label: 'Kuruyemiş',        desc: 'Fındık, badem, ceviz…' },
  { id: 'deniz_urunleri', label: 'Deniz Ürünleri',   desc: 'Balık, karides, midye' },
  { id: 'yok',            label: 'Alerji / Kısıtım Yok', desc: 'Herhangi bir alerjim yok' },
]

const MEDICAL_CONDITIONS = [
  { id: 'yok',             label: 'Yok',              desc: 'Bilinen kronik hastalık yok' },
  { id: 'insulin_direnci', label: 'İnsülin Direnci',  desc: 'Karbonhidrat kontrolü gerektirir' },
  { id: 'diyabet_tip1',    label: 'Diyabet (Tip 1)',  desc: 'İnsüline bağımlı diyabet' },
  { id: 'diyabet_tip2',    label: 'Diyabet (Tip 2)',  desc: 'İnsülin direncine bağlı' },
  { id: 'tansiyon',        label: 'Tansiyon',         desc: 'Yüksek / düşük kan basıncı' },
  { id: 'kolesterol',      label: 'Kolesterol',       desc: 'Yüksek kolesterol seviyesi' },
  { id: 'tiroid',          label: 'Tiroid',           desc: 'Tiroid bezi hastalığı' },
  { id: 'pcos',            label: 'PCOS',             desc: 'Polikistik over sendromu' },
]

const MOCK_MEALS = [
  { time: 'Kahvaltı',  meal: 'Yulaf ezmesi, elma, badem sütü',              kcal: 350 },
  { time: 'Öğle',      meal: 'Izgara tavuk, kinoa, ıspanak salatası',        kcal: 520 },
  { time: 'Ara Öğün',  meal: 'Badem, taze meyve karışımı',                   kcal: 200 },
  { time: 'Akşam',     meal: 'Somon fileto, buharda brokoli, tatlı patates', kcal: 480 },
]

const STEP_META = [
  { title: 'Temel Bilgiler',      subtitle: 'Kişisel istatistiklerinizi girin' },
  { title: 'Hedefiniz',           subtitle: 'Beslenme hedefinizi seçin' },
  { title: 'Diyet Felsefesi',     subtitle: 'Beslenme tarzınızı seçin' },
  { title: 'Alerji & Dışlamalar', subtitle: 'Kaçınmanız gereken besinler' },
  { title: 'Tıbbi Geçmiş',        subtitle: 'Sağlık durumunuzu belirtin' },
  { title: 'Mod Seçimi',          subtitle: 'Nasıl başlamak istersiniz?' },
  { title: 'Liste Yükle',         subtitle: 'Diyetisyen listenizi yükleyin' },
]

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function deriveHealthConditions(allergies, medicalHistory) {
  const c = []
  if (allergies.includes('gluten'))    c.push('colyak')
  if (allergies.includes('laktoz'))    c.push('laktoz')
  if (allergies.includes('kuruyemis')) c.push('kuruyemis')
  if (medicalHistory.includes('diyabet_tip1') || medicalHistory.includes('diyabet_tip2')) c.push('diyabet')
  if (medicalHistory.includes('insulin_direnci')) c.push('insulin_direnci')
  if (medicalHistory.includes('pcos')) c.push('pcos')
  if (medicalHistory.includes('tansiyon')) c.push('tansiyon')
  if (medicalHistory.includes('kolesterol')) c.push('kolesterol')
  return c
}

function buildOnboardingProfileInput(stats, primaryGoal, dietPhilosophy, allergies, medicalHistory) {
  return {
    stats: {
      gender:   stats.gender,
      age:      Number(stats.age),
      height:   Number(stats.height),
      weight:   Number(stats.weight),
      activity: stats.activity,
    },
    primaryGoal,
    dietPhilosophy,
    medicalHistory,
    healthConditions: deriveHealthConditions(allergies, medicalHistory),
  }
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
      selected ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300 dark:border-slate-600'
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
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
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
        <p className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Cinsiyet</p>
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
                  active
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 shadow-sm shadow-emerald-100'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 text-slate-400 hover:border-slate-300'
                }`}
              >
                {icon}
                <span className={`text-sm font-semibold ${active ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-400'}`}>{label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Age / Height / Weight */}
      <div>
        <p className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Vücut Ölçüleri</p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { key: 'age',    label: 'Yaş',  unit: 'yıl', ph: '25',  min: 10,  max: 120 },
            { key: 'height', label: 'Boy',  unit: 'cm',  ph: '170', min: 100, max: 250 },
            { key: 'weight', label: 'Kilo', unit: 'kg',  ph: '70',  min: 30,  max: 350 },
          ].map(({ key, label, unit, ph, min, max }) => (
            <div
              key={key}
              className="flex flex-col items-center rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 px-2 py-3 shadow-sm"
            >
              <p className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
              <input
                type="number" inputMode="numeric"
                min={min} max={max}
                value={stats[key]}
                onChange={e => onChange({ ...stats, [key]: e.target.value })}
                placeholder={ph}
                className="w-full border-0 bg-transparent text-center text-xl font-bold text-slate-900 dark:text-white outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600"
              />
              <p className="mt-0.5 text-xs font-medium text-slate-400 dark:text-slate-500">{unit}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Activity */}
      <div>
        <p className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Hareketlilik Düzeyi</p>
        <div className="space-y-2">
          {ACTIVITY_LEVELS.map(({ id, label, desc, mult }) => {
            const active = stats.activity === id
            return (
              <button
                key={id} type="button"
                onClick={() => onChange({ ...stats, activity: id })}
                className={`flex w-full items-center gap-4 rounded-xl border-2 px-4 py-3 text-left transition-all ${
                  active
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30'
                    : 'border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800/60 hover:border-slate-200 dark:hover:border-slate-600'
                }`}
              >
                <RadioDot selected={active} />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold ${active ? 'text-emerald-800 dark:text-emerald-400' : 'text-slate-800 dark:text-slate-200'}`}>{label}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{desc}</p>
                </div>
                <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  active ? 'bg-emerald-200 dark:bg-emerald-800 text-emerald-700 dark:text-emerald-300' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'
                }`}>×{mult}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Step 2 — Primary Goal ────────────────────────────────────────────────────

function Step2PrimaryGoal({ selected, onSelect }) {
  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
        Hedefinize göre günlük kalori ve makro dağılımınız AMDR standartlarına göre otomatik hesaplanır.
      </p>

      {/* Dropdown — compact selection */}
      <div className="relative">
        <label htmlFor="onboarding-goal" className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Hedefiniz
        </label>
        <select
          id="onboarding-goal"
          value={selected}
          onChange={e => onSelect(e.target.value)}
          className="w-full cursor-pointer appearance-none rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 px-4 py-3.5 pr-10 text-sm font-bold text-slate-900 dark:text-slate-100 outline-none transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
        >
          <option value="" disabled>Hedef seçin…</option>
          {GOAL_OPTIONS.map(({ id, label }) => (
            <option key={id} value={id}>{label}</option>
          ))}
        </select>
        <svg className="pointer-events-none absolute right-4 top-[2.6rem] h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </div>

      {/* Card preview for selected goal */}
      {GOAL_OPTIONS.filter(g => g.id === selected).map(({ id, label, desc, badge }) => (
        <div key={id} className="rounded-2xl border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 px-4 py-4 shadow-sm">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-emerald-800 dark:text-emerald-400">{label}</p>
            <span className="rounded-full bg-emerald-200 dark:bg-emerald-800 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">{badge}</span>
          </div>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{desc}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Step 3 — Diet Philosophy ─────────────────────────────────────────────────

function Step2DietPhilosophy({ selected, onSelect }) {
  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
        Günlük beslenme tarzınızı seçin. Bu tercih, yapay zekanın size kişiselleştirilmiş öneriler sunmasını sağlar.
      </p>
      <div className="space-y-2.5">
        {DIET_PHILOSOPHIES.map(({ id, label, desc, icon }) => {
          const active = selected === id
          return (
            <button
              key={id} type="button"
              onClick={() => onSelect(id)}
              className={`flex w-full items-center gap-4 rounded-2xl border-2 px-4 py-3.5 text-left transition-all ${
                active
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 shadow-sm'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl transition-all ${
                active
                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-300/40'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
              }`}>
                {icon}
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-bold ${active ? 'text-emerald-800 dark:text-emerald-400' : 'text-slate-800 dark:text-slate-200'}`}>{label}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{desc}</p>
              </div>
              <div className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                active ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300 dark:border-slate-600'
              }`}>
                {active && <CheckIcon className="h-3 w-3 text-white" />}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Step 3 — Allergies & Exclusions ─────────────────────────────────────────

function Step3Allergies({ allergies, onToggle }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-900/20 px-4 py-3">
        <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-300">
          Alerji ve beslenme kısıtlamalarınız yalnızca cihazınızda saklanır. Yapay zeka bu bilgileri güvenli öneriler sunmak için kullanır.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {ALLERGENS.map(({ id, label, desc }) => {
          const active = allergies.includes(id)
          const isNone = id === 'yok'
          return (
            <button
              key={id} type="button"
              onClick={() => onToggle(id)}
              className={[
                'flex flex-col gap-1.5 rounded-2xl border-2 px-4 py-3.5 text-left transition-all',
                isNone ? 'col-span-2' : '',
                active
                  ? isNone
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30'
                    : 'border-rose-400 bg-rose-50 dark:bg-rose-900/30'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-600',
              ].join(' ')}
            >
              <div className="flex items-center justify-between">
                <p className={`text-sm font-bold ${
                  active
                    ? isNone ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'
                    : 'text-slate-800 dark:text-slate-200'
                }`}>{label}</p>
                <span className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full transition-all ${
                  active
                    ? isNone ? 'bg-emerald-500' : 'bg-rose-400'
                    : 'border-2 border-slate-200 dark:border-slate-600'
                }`}>
                  {active && <CheckIcon className="h-3 w-3 text-white" />}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">{desc}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Step 4 — Medical History ─────────────────────────────────────────────────

function Step4MedicalHistory({ conditions, onToggle }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-blue-200 bg-blue-50 dark:border-blue-800/40 dark:bg-blue-900/20 px-4 py-3">
        <p className="text-xs leading-relaxed text-blue-800 dark:text-blue-300">
          Tıbbi geçmişiniz, yapay zekanın sağlığınıza uygun besin önerileri sunması için kritik öneme sahiptir. Bu bilgiler cihazınızda şifreli olarak saklanır.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {MEDICAL_CONDITIONS.map(({ id, label, desc }) => {
          const active = conditions.includes(id)
          const isNone = id === 'yok'
          return (
            <button
              key={id} type="button"
              onClick={() => onToggle(id)}
              className={[
                'flex flex-col gap-1.5 rounded-2xl border-2 px-4 py-3.5 text-left transition-all',
                isNone ? 'col-span-2' : '',
                active
                  ? isNone
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30'
                    : 'border-violet-400 bg-violet-50 dark:bg-violet-900/30'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-600',
              ].join(' ')}
            >
              <div className="flex items-center justify-between">
                <p className={`text-sm font-bold ${
                  active
                    ? isNone ? 'text-emerald-700 dark:text-emerald-400' : 'text-violet-700 dark:text-violet-400'
                    : 'text-slate-800 dark:text-slate-200'
                }`}>{label}</p>
                <span className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full transition-all ${
                  active
                    ? isNone ? 'bg-emerald-500' : 'bg-violet-400'
                    : 'border-2 border-slate-200 dark:border-slate-600'
                }`}>
                  {active && <CheckIcon className="h-3 w-3 text-white" />}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">{desc}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Step 5 — Path Selection ──────────────────────────────────────────────────

function Step5PathSelection({ mode, onSelect }) {
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
      <p className="text-sm text-slate-500 dark:text-slate-400">
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
                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 shadow-lg shadow-emerald-100/50'
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 hover:border-emerald-200 hover:shadow-sm'
            }`}
          >
            <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl transition-all ${
              active
                ? 'bg-emerald-500 text-white shadow-md shadow-emerald-300/40'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 group-hover:bg-emerald-50 group-hover:text-emerald-600'
            }`}>
              {icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className={`text-base font-bold ${active ? 'text-emerald-900 dark:text-emerald-400' : 'text-slate-900 dark:text-slate-200'}`}>{title}</p>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  active ? 'bg-emerald-200 dark:bg-emerald-800 text-emerald-700 dark:text-emerald-300' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                }`}>{badge}</span>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{desc}</p>
            </div>
            <div className={`mt-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition-all ${
              active ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300 dark:border-slate-600'
            }`}>
              {active && <CheckIcon />}
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ─── Step 6 — OCR Upload ──────────────────────────────────────────────────────

function Step6OCRUpload({ ocrState, onSimulate }) {
  const fileInputRef = useRef(null)

  if (ocrState === 'scanning') {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="relative mb-8">
          <div className="h-24 w-24 animate-spin rounded-full border-4 border-slate-100 dark:border-slate-700 border-t-emerald-500" />
          <div className="absolute inset-0 flex items-center justify-center">
            <svg className="h-10 w-10 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
            </svg>
          </div>
        </div>
        <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">Analiz ediliyor...</h3>
        <p className="mt-2 max-w-xs text-sm text-slate-500 dark:text-slate-400">
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
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-900/20 p-4">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500 shadow-md shadow-emerald-200/50">
            <CheckIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-emerald-800 dark:text-emerald-400">Listeniz başarıyla dijitalleştirildi!</p>
            <p className="mt-0.5 text-xs text-emerald-600 dark:text-emerald-500">{MOCK_MEALS.length} öğün tespit edildi · Toplam {total} kcal/gün</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 divide-y divide-slate-100 dark:divide-slate-700 shadow-sm">
          {MOCK_MEALS.map(({ time, meal, kcal }, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3.5">
              <div className="min-w-0 flex-1 pr-3">
                <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{time}</p>
                <p className="mt-0.5 text-sm text-slate-700 dark:text-slate-300">{meal}</p>
              </div>
              <span className="flex-shrink-0 rounded-full bg-slate-100 dark:bg-slate-700 px-3 py-1 text-xs font-bold text-slate-600 dark:text-slate-300">
                {kcal} kcal
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3.5">
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Günlük Toplam</p>
            <span className="rounded-full bg-emerald-100 dark:bg-emerald-800/60 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-400">
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
      <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
        Diyetisyeninizin verdiği beslenme listesini yükleyin veya fotoğraflayın. Yapay zeka öğünleri otomatik tanıyacak.
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        onChange={onSimulate}
      />

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="group flex w-full flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50 px-6 py-10 transition-all hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white dark:bg-slate-700 shadow-sm transition-colors group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/40">
          <svg className="h-8 w-8 text-slate-400 dark:text-slate-500 transition-colors group-hover:text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 transition-colors group-hover:text-emerald-700 dark:group-hover:text-emerald-400">
            Dosya Seç veya Sürükle
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">PNG, JPG veya PDF · Maks. 10 MB</p>
        </div>
      </button>

      <div className="flex items-center gap-3">
        <div className="flex-1 border-t border-slate-200 dark:border-slate-700" />
        <span className="text-xs text-slate-400 dark:text-slate-500">ya da</span>
        <div className="flex-1 border-t border-slate-200 dark:border-slate-700" />
      </div>

      <button
        type="button"
        onClick={onSimulate}
        className="flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 py-4 text-sm font-bold text-slate-700 dark:text-slate-300 transition-all hover:border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-700 dark:hover:text-emerald-400"
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

// ─── TDEE Summary Card (shown only at final step) ─────────────────────────────

function TDEESummaryCard({ preview, stats, primaryGoal }) {
  if (!preview?.target_calories) return null
  const goalObj = GOAL_OPTIONS.find(g => g.id === primaryGoal)
  const adjusted = preview.target_calories
  const macros = {
    protein: preview.target_protein,
    carbs:   preview.target_carbs,
    fat:     preview.target_fat,
    fiber:   preview.target_fiber,
    sugar:   preview.target_sugar,
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-xl shadow-emerald-200/40 dark:shadow-emerald-900/40">
      <div className="px-5 pt-5 pb-4">
        <p className="text-xs font-semibold text-emerald-100">Hesaplanan Günlük Kalori Hedefiniz</p>
        <div className="mt-1 flex items-end gap-1">
          <span className="text-4xl font-extrabold text-white">{adjusted.toLocaleString('tr-TR')}</span>
          <span className="mb-1 text-sm font-medium text-emerald-200">kcal/gün</span>
        </div>
        {goalObj && preview.tdee !== adjusted && (
          <p className="text-xs text-emerald-200">Baz TDEE {preview.tdee.toLocaleString('tr-TR')} · hedef: {goalObj.label}</p>
        )}
        <p className="mt-0.5 text-xs text-emerald-300">Mifflin-St Jeor · {stats.gender === 'erkek' ? 'Erkek' : 'Kadın'} · {stats.age} yaş · {stats.weight} kg · {stats.height} cm</p>
      </div>
      <div className="grid grid-cols-3 divide-x divide-emerald-400/40 border-t border-emerald-400/40 bg-emerald-600/30">
        {[
          { label: 'Protein',      value: macros.protein },
          { label: 'Karbonhidrat', value: macros.carbs   },
          { label: 'Yağ',          value: macros.fat     },
        ].map(({ label, value }) => (
          <div key={label} className="flex flex-col items-center py-3">
            <span className="text-lg font-bold text-white">{value}<span className="text-xs font-normal text-emerald-200">g</span></span>
            <span className="text-xs text-emerald-300">{label}</span>
          </div>
        ))}
      </div>
      {macros.fiber > 0 && (
        <div className="grid grid-cols-2 divide-x divide-emerald-400/30 border-t border-emerald-400/30 bg-emerald-700/20">
          <div className="flex flex-col items-center py-2.5">
            <span className="text-sm font-bold text-white">{macros.fiber}<span className="text-[10px] font-normal text-emerald-200">g</span></span>
            <span className="text-[10px] text-emerald-300">Lif (min.)</span>
          </div>
          <div className="flex flex-col items-center py-2.5">
            <span className="text-sm font-bold text-white">{macros.sugar}<span className="text-[10px] font-normal text-emerald-200">g</span></span>
            <span className="text-[10px] text-emerald-300">Şeker (maks.)</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Wizard orchestrator ──────────────────────────────────────────────────────

export default function OnboardingWizard({ onComplete }) {
  const [step, setStep]               = useState(1)
  const [stats, setStats]             = useState({ gender: '', age: '', height: '', weight: '', activity: '' })
  const [primaryGoal, setPrimaryGoal] = useState('')
  const [dietPhilosophy, setDietPhilosophy] = useState('')
  const [allergies, setAllergies]     = useState([])
  const [medicalHistory, setMedical]  = useState([])
  const [mode, setMode]               = useState('')
  const [ocrState, setOcrState]       = useState('idle') // 'idle' | 'scanning' | 'success'
  const [saving, setSaving]           = useState(false)
  const [saveError, setSaveError]     = useState('')

  const totalSteps = mode === 'manual' ? 6 : 7
  const macroPreview = useMemo(
    () => macroCalculator(buildOnboardingProfileInput(
      stats, primaryGoal, dietPhilosophy, allergies, medicalHistory,
    )),
    [stats, primaryGoal, dietPhilosophy, allergies, medicalHistory],
  )
  const tdee = macroPreview?.tdee ?? null
  const meta = STEP_META[step - 1]

  // ── Multi-select toggle helpers ───────────────────────────────────────────
  function handleAllergyToggle(id) {
    if (id === 'yok') {
      setAllergies(prev => prev.includes('yok') ? [] : ['yok'])
    } else {
      setAllergies(prev => {
        const without = prev.filter(c => c !== 'yok')
        return without.includes(id) ? without.filter(c => c !== id) : [...without, id]
      })
    }
  }

  function handleMedicalToggle(id) {
    if (id === 'yok') {
      setMedical(prev => prev.includes('yok') ? [] : ['yok'])
    } else {
      setMedical(prev => {
        const without = prev.filter(c => c !== 'yok')
        return without.includes(id) ? without.filter(c => c !== id) : [...without, id]
      })
    }
  }

  // ── Validation ────────────────────────────────────────────────────────────
  function canProceed() {
    if (step === 1) return !!(stats.gender && stats.age && stats.height && stats.weight && stats.activity)
    if (step === 2) return !!primaryGoal
    if (step === 3) return !!dietPhilosophy
    if (step === 4) return allergies.length > 0
    if (step === 5) return medicalHistory.length > 0
    if (step === 6) return !!mode
    if (step === 7) return ocrState === 'success'
    return true
  }

  // ── Navigation ────────────────────────────────────────────────────────────
  function handleNext() {
    if (saving) return
    if (step === 6 && mode === 'manual') { finish(); return }
    if (step === totalSteps)             { finish(); return }
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
  async function finish() {
    const computed = macroCalculator(buildOnboardingProfileInput(
      stats, primaryGoal, dietPhilosophy, allergies, medicalHistory,
    ))
    const goalOffset = computed?.tdee
      ? computed.target_calories - computed.tdee
      : 0
    const profile = {
      stats,
      primaryGoal,
      goalOffset,
      dailyGoal:        computed?.target_calories ?? null,
      dietPhilosophy,
      allergies,
      medicalHistory,
      healthConditions: deriveHealthConditions(allergies, medicalHistory),
      mode,
      tdee:             computed?.tdee ?? null,
      target_calories:  computed?.target_calories ?? null,
      target_protein:   computed?.target_protein  ?? null,
      target_carbs:     computed?.target_carbs    ?? null,
      target_fat:       computed?.target_fat      ?? null,
      target_fiber:     computed?.target_fiber    ?? null,
      target_sugar:     computed?.target_sugar    ?? null,
      macros: computed
        ? {
            protein: computed.target_protein,
            carbs:   computed.target_carbs,
            fat:     computed.target_fat,
            fiber:   computed.target_fiber,
            sugar:   computed.target_sugar,
          }
        : null,
      dietPlan: ocrState === 'success' ? MOCK_MEALS : null,
    }

    setSaving(true)
    setSaveError('')
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      console.log('CURRENT SESSION:', session)

      if (sessionError) throw sessionError

      if (!session || !session.user?.id) {
        await supabase.auth.signOut()
        throw new Error('Oturumunuz bulunamadı. Lütfen giriş sayfasına dönüp tekrar giriş yapın.')
      }

      await onComplete({ ...profile, userId: session.user.id })
    } catch (err) {
      console.error('SUPABASE SAVE ERROR:', err)
      const detail = err?.message || err?.details || String(err)
      setSaveError(
        detail.startsWith('Oturumunuz')
          ? detail
          : `Profil kaydedilemedi: ${detail}`,
      )
      setSaving(false)
    }
  }

  const isLastStep   = (step === 6 && mode === 'manual') || step === totalSteps
  const isScanning   = ocrState === 'scanning'
  const showTDEECard = isLastStep && !!tdee

  return (
    <div className="flex min-h-svh flex-col bg-white dark:bg-[#0C0F1A] lg:items-center lg:justify-center lg:bg-slate-100 lg:dark:bg-[#080b14]">

      {/* ── Card wrapper ────────────────────────────────────────────────────── */}
      <div className="flex min-h-svh w-full flex-col bg-white dark:bg-[#0C0F1A]
                      lg:min-h-0 lg:h-[88vh] lg:max-w-4xl lg:flex-row
                      lg:rounded-3xl lg:shadow-2xl lg:shadow-black/10 lg:dark:shadow-black/50
                      lg:overflow-hidden lg:ring-1 lg:ring-slate-200 lg:dark:ring-white/5">

        {/* ── LEFT SIDEBAR — desktop only ──────────────────────────────────── */}
        <aside className="hidden lg:flex lg:w-72 lg:flex-shrink-0 lg:flex-col bg-gradient-to-b from-emerald-600 to-teal-700">

          {/* Branding */}
          <div className="p-8 pb-5">
            <div className="mb-8 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 shadow-inner">
                <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" d="M14.615 1.595a.75.75 0 01.359.852L12.982 9.75h7.268a.75.75 0 01.548 1.262l-10.5 11.25a.75.75 0 01-1.272-.71l1.992-7.302H3.818a.75.75 0 01-.548-1.262l10.5-11.25a.75.75 0 01.845-.143z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <p className="text-lg font-extrabold leading-none tracking-tight text-white">Kalorimetre</p>
                <p className="mt-0.5 text-xs text-emerald-200">AI Beslenme Asistanı</p>
              </div>
            </div>
            <h2 className="text-xl font-extrabold leading-snug text-white">Profilinizi oluşturalım</h2>
            <p className="mt-2 text-sm leading-relaxed text-emerald-100/70">
              Birkaç adımda size özel kalori ve makro hedefleri belirlenecek.
            </p>
          </div>

          {/* Step list */}
          <nav className="flex-1 space-y-0.5 px-5 pb-4">
            {STEP_META.slice(0, totalSteps).map((s, idx) => {
              const num = idx + 1
              const done   = num < step
              const active = num === step
              return (
                <div
                  key={idx}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
                    active ? 'bg-white/15' : ''
                  }`}
                >
                  <div className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold transition-all ${
                    done || active ? 'bg-white text-emerald-700' : 'bg-white/20 text-white/50'
                  }`}>
                    {done
                      ? <CheckIcon className="h-3 w-3" />
                      : num
                    }
                  </div>
                  <span className={`text-sm transition-all ${
                    active ? 'font-semibold text-white' : done ? 'font-medium text-white/80' : 'text-white/40'
                  }`}>
                    {s.title}
                  </span>
                </div>
              )
            })}
          </nav>

          {/* TDEE preview at final step */}
          {showTDEECard && macroPreview?.target_calories && (
            <div className="mx-5 mb-6 rounded-2xl bg-white/15 p-4 text-center ring-1 ring-white/20">
              <p className="text-xs font-medium text-emerald-100">Günlük Kalori Hedefi</p>
              <p className="mt-1 text-4xl font-extrabold text-white">{macroPreview.target_calories.toLocaleString('tr-TR')}</p>
              <p className="text-xs text-emerald-200">kcal / gün</p>
            </div>
          )}
        </aside>

        {/* ── RIGHT CONTENT PANEL ───────────────────────────────────────────── */}
        <div className="flex flex-1 flex-col lg:overflow-hidden">

          {/* Gradient accent bar — mobile only */}
          <div className="h-1.5 w-full flex-shrink-0 bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-400 lg:hidden" />

          {/* Header */}
          <div className="flex-shrink-0 px-6 pb-5 pt-8 lg:pt-10">
            {/* Mobile logo */}
            <div className="mb-7 flex items-center gap-2.5 lg:hidden">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 shadow-md shadow-emerald-200">
                <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                </svg>
              </div>
              <span className="text-sm font-bold tracking-tight text-slate-800 dark:text-white">Kalorimetre</span>
            </div>

            {/* Mobile progress bar */}
            <div className="lg:hidden">
              <ProgressBar current={step} total={totalSteps} />
            </div>

            {/* Desktop step label */}
            <p className="hidden lg:block mb-1 text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
              Adım {step} / {totalSteps}
            </p>

            <div className="mt-5 lg:mt-2">
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">{meta.title}</h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{meta.subtitle}</p>
            </div>
          </div>

          {/* Scrollable step content */}
          <div className="flex-1 overflow-y-auto px-6 pb-4">
            {step === 1 && <Step1BasicStats stats={stats} onChange={setStats} />}
            {step === 2 && <Step2PrimaryGoal selected={primaryGoal} onSelect={setPrimaryGoal} />}
            {step === 3 && <Step2DietPhilosophy selected={dietPhilosophy} onSelect={setDietPhilosophy} />}
            {step === 4 && <Step3Allergies allergies={allergies} onToggle={handleAllergyToggle} />}
            {step === 5 && <Step4MedicalHistory conditions={medicalHistory} onToggle={handleMedicalToggle} />}
            {step === 6 && <Step5PathSelection mode={mode} onSelect={setMode} />}
            {step === 7 && <Step6OCRUpload ocrState={ocrState} onSimulate={startScan} />}
          </div>

          {/* TDEE summary card — final step (right panel) */}
          {showTDEECard && (
            <div className="mx-6 mb-4 flex-shrink-0">
              <TDEESummaryCard preview={macroPreview} stats={stats} primaryGoal={primaryGoal} />
            </div>
          )}

          {/* Bottom navigation */}
          <div className="flex-shrink-0 px-6 pb-10 pt-2 lg:pb-8">
            {saveError && (
              <p className="mb-3 rounded-xl bg-red-50 dark:bg-red-900/20 px-3 py-2 text-center text-xs font-semibold text-red-600 dark:text-red-400">
                {saveError}
              </p>
            )}
            <div className="flex gap-3">
              {step > 1 && !isScanning && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="flex h-14 w-14 flex-shrink-0 cursor-pointer items-center justify-center rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 transition-all hover:border-emerald-300 hover:text-emerald-600 active:scale-95"
                >
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                  </svg>
                </button>
              )}

              <button
                type="button"
                onClick={handleNext}
                disabled={!canProceed() || isScanning || saving}
                className={`flex h-14 flex-1 cursor-pointer items-center justify-center gap-2 rounded-2xl text-sm font-bold transition-all ${
                  canProceed() && !isScanning && !saving
                    ? 'bg-emerald-500 text-white shadow-xl shadow-emerald-200/40 hover:bg-emerald-600 hover:shadow-emerald-300/40 active:scale-[0.98]'
                    : 'cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600'
                }`}
              >
                {saving ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    Kaydediliyor…
                  </>
                ) : isScanning ? (
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

        </div>{/* end right panel */}
      </div>{/* end card */}
    </div>
  )
}
