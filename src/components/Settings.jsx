import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Activity,
  Armchair,
  Calendar,
  CheckCircle,
  CheckCircle2,
  CircleDot,
  Droplets,
  Dumbbell,
  Fish,
  Flame,
  Footprints,
  Heart,
  HeartPulse,
  Leaf,
  Milk,
  Nut,
  Pill,
  Rocket,
  Ruler,
  Scale,
  ShieldCheck,
  Sprout,
  Syringe,
  TrendingDown,
  TrendingUp,
  Trophy,
  User,
  UserRound,
  UtensilsCrossed,
  Weight,
  Wheat,
  Zap,
} from 'lucide-react'
import { useDiet } from '../context/DietContext'
import { ProteinIcon, CarbsIcon, FatIcon } from './Meal/MealIcons'
import { GOAL_OPTIONS, GOAL_LABELS, DEFAULT_GOAL } from '../constants/goalOptions'
import { goalOffsetToId, macroCalculator, migrateLegacyGoal, calculateMacros } from '../utils/macroCalculator'
import HedefDuzenle from './HedefDuzenle'
import { supabase } from '../utils/supabaseClient'

// ─── Constants (used by sub-views only) ───────────────────────────────────────

const ACTIVITY_LEVELS = [
  { id: 'sedentary',  label: 'Hareketsiz',  desc: 'Masa başı iş, az hareket',       mult: 1.2,   icon: Armchair   },
  { id: 'light',      label: 'Hafif Aktif', desc: 'Haftada 1–3 gün egzersiz',       mult: 1.375, icon: Footprints },
  { id: 'moderate',   label: 'Orta Aktif',  desc: 'Haftada 3–5 gün egzersiz',       mult: 1.55,  icon: Activity   },
  { id: 'active',     label: 'Çok Aktif',   desc: 'Haftada 6–7 gün ağır antrenman', mult: 1.725, icon: Zap        },
  { id: 'veryActive', label: 'Ekstra Aktif', desc: 'Günde 2 kez antrenman / sporcu', mult: 1.9,   icon: Trophy     },
]

const DIET_ICONS = {
  standart:   UtensilsCrossed,
  vegan:      Leaf,
  vejetaryen: Sprout,
  keto:       Zap,
  akdeniz:    Fish,
}

const ALLERGEN_ICONS = {
  gluten:         Wheat,
  laktoz:         Milk,
  kuruyemis:      Nut,
  deniz_urunleri: Fish,
  yok:            CheckCircle,
}

const MEDICAL_ICONS = {
  yok:             ShieldCheck,
  insulin_direnci: Droplets,
  diyabet_tip1:    Syringe,
  diyabet_tip2:    Syringe,
  tansiyon:        HeartPulse,
  kolesterol:      Activity,
  tiroid:          Pill,
  pcos:            CircleDot,
}

const GOAL_ICONS = {
  'Sağlıklı Beslenmek':    Heart,
  'Dengeli Kilo Vermek':   TrendingDown,
  'Hızlı Kilo Vermek':     Rocket,
  'Dengeli Kilo Almak':    TrendingUp,
  'Hızlı Kilo Almak':      Scale,
  'Dengeli Kas Kazanmak':  Dumbbell,
  'Hızlı Kas Kazanmak':    Flame,
}

const PROFILE_STAGGER_CONTAINER = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
}

const PROFILE_SECTION_VARIANT = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] },
  },
}

// GOAL_OPTIONS and GOAL_LABELS imported from ../constants/goalOptions.js

const DIET_OPTIONS = [
  { id: 'standart',   label: 'Standart',   desc: 'Dengeli, karma beslenme' },
  { id: 'vegan',      label: 'Vegan',      desc: 'Hayvansal ürün yok' },
  { id: 'vejetaryen', label: 'Vejetaryen', desc: 'Et yok; süt, yumurta serbest' },
  { id: 'keto',       label: 'Ketojenik',  desc: 'Düşük karbonhidrat, yüksek yağ' },
  { id: 'akdeniz',    label: 'Akdeniz',    desc: 'Balık, zeytinyağı, baklagil' },
]

const ALLERGENS = [
  { id: 'gluten',         label: 'Gluten',           desc: 'Buğday, arpa, çavdar' },
  { id: 'laktoz',         label: 'Laktoz',            desc: 'Süt ve süt ürünleri' },
  { id: 'kuruyemis',      label: 'Kuruyemiş',         desc: 'Fındık, badem, ceviz' },
  { id: 'deniz_urunleri', label: 'Deniz Ürünleri',    desc: 'Balık, karides, midye' },
  { id: 'yok',            label: 'Alerji / Kısıtım Yok', desc: 'Herhangi bir alerjim yok' },
]

const MEDICAL_CONDITIONS = [
  { id: 'yok',             label: 'Yok',             desc: 'Bilinen kronik hastalık yok' },
  { id: 'insulin_direnci', label: 'İnsülin Direnci', desc: 'Karbonhidrat kontrolü gerektirir' },
  { id: 'diyabet_tip1',    label: 'Diyabet (Tip 1)', desc: 'İnsüline bağımlı diyabet' },
  { id: 'diyabet_tip2',    label: 'Diyabet (Tip 2)', desc: 'İnsülin direncine bağlı' },
  { id: 'tansiyon',        label: 'Tansiyon',        desc: 'Yüksek / düşük kan basıncı' },
  { id: 'kolesterol',      label: 'Kolesterol',      desc: 'Yüksek kolesterol seviyesi' },
  { id: 'tiroid',          label: 'Tiroid',          desc: 'Tiroid bezi hastalığı' },
  { id: 'pcos',            label: 'PCOS',            desc: 'Polikistik over sendromu' },
]

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

function getProfileStats(profile) {
  const stats = profile?.stats ?? {}
  return {
    age:      stats.age      ?? profile?.age      ?? '',
    weight:   stats.weight   ?? profile?.weight   ?? '',
    height:   stats.height   ?? profile?.height   ?? '',
    gender:   stats.gender   ?? profile?.gender   ?? 'erkek',
    activity: stats.activity ?? profile?.activity ?? 'moderate',
  }
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

function SectionLabel({ text, className = '' }) {
  return (
    <p className={`mb-4 text-[11px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500 ${className}`}>
      {text}
    </p>
  )
}

function StatInput({ label, value, onChange, unit = '', min, step = '1', icon: Icon }) {
  return (
    <div className="rounded-2xl border border-transparent bg-gray-50 px-4 py-3.5 shadow-sm transition-all duration-200 focus-within:border-green-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-green-500/20 dark:bg-gray-800 dark:focus-within:bg-night-card">
      <div className="mb-1.5 flex items-center gap-2">
        {Icon && (
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/80 text-green-600 dark:bg-night-muted dark:text-green-400">
            <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
          </div>
        )}
        <label className="text-[10px] font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500">{label}</label>
      </div>
      <div className="flex items-baseline gap-1.5">
        <input
          type="number" inputMode="decimal" min={min} step={step}
          value={value} onChange={e => onChange(e.target.value)}
          className="w-full bg-transparent text-2xl font-extrabold text-gray-900 outline-none placeholder:text-gray-300 dark:text-slate-100 dark:placeholder:text-night-muted"
        />
        {unit && <span className="text-sm font-semibold text-gray-400 dark:text-slate-500">{unit}</span>}
      </div>
    </div>
  )
}

const PROFILE_RADIO_GRID = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'

function ProfileRadioCard({ selected, onClick, title, description, trailing, icon: Icon, className = '' }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`relative flex h-full flex-col justify-between rounded-2xl border p-4 text-left cursor-pointer shadow-sm transition-colors duration-200 hover:border-green-400 hover:shadow-md ${
        selected
          ? 'border-2 border-green-500 bg-green-50 dark:bg-green-900/20'
          : 'border-gray-200 bg-white dark:border-night-border dark:bg-night-card'
      } ${className}`}
    >
      {selected && (
        <CheckCircle2
          className="absolute right-3 top-3 h-5 w-5 text-green-500 dark:text-green-400"
          strokeWidth={2.25}
          aria-hidden
        />
      )}
      {Icon && (
        <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
          selected
            ? 'bg-green-500 text-white shadow-sm shadow-green-500/30'
            : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
        }`}>
          <Icon className="h-5 w-5" strokeWidth={2} />
        </div>
      )}
      <div className="min-w-0 flex-1 pr-6">
        <p className={`font-semibold ${selected ? 'text-green-800 dark:text-green-400' : 'text-gray-800 dark:text-white'}`}>
          {title}
        </p>
        {description && (
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>
        )}
      </div>
      {trailing && (
        <p className={`mt-3 text-sm font-semibold ${selected ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}`}>
          {trailing}
        </p>
      )}
    </motion.button>
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

  const initial = getProfileStats(profile)
  const savedGoalId = migrateLegacyGoal(
    profile?.primaryGoal ?? goalOffsetToId(profile?.goalOffset) ?? DEFAULT_GOAL,
  )

  const [draft, setDraft] = useState({
    age:            String(initial.age),
    weight:         String(initial.weight),
    height:         String(initial.height),
    gender:         initial.gender,
    activity:       initial.activity,
    primaryGoal:    savedGoalId,
    dietPhilosophy: profile?.dietPhilosophy ?? 'standart',
    allergies:      profile?.allergies      ?? [],
    medicalHistory: profile?.medicalHistory ?? [],
  })
  const [saveStatus, setSaveStatus] = useState('idle')
  const [preview, setPreview] = useState(null)

  const set = (k, v) => setDraft(prev => ({ ...prev, [k]: v }))

  useEffect(() => {
    const healthConditions = deriveHealthConditions(draft.allergies, draft.medicalHistory)
    const result = macroCalculator({
      stats: {
        age:      Number(draft.age),
        weight:   Number(draft.weight),
        height:   Number(draft.height),
        gender:   draft.gender,
        activity: draft.activity,
      },
      primaryGoal:      draft.primaryGoal,
      dietPhilosophy:   draft.dietPhilosophy,
      medicalHistory:   draft.medicalHistory,
      healthConditions,
    }) ?? calculateMacros({
      stats: {
        age:      Number(draft.age),
        weight:   Number(draft.weight),
        height:   Number(draft.height),
        gender:   draft.gender,
        activity: draft.activity,
      },
    })
    setPreview(result)
  }, [
    draft.age,
    draft.weight,
    draft.height,
    draft.gender,
    draft.activity,
    draft.primaryGoal,
    draft.dietPhilosophy,
    draft.medicalHistory,
    draft.allergies,
  ])

  const tdee       = preview?.tdee ?? 0
  const targetKcal = preview?.target_calories ?? 0
  const liveMacros = preview
    ? {
        protein: preview.target_protein,
        carbs:   preview.target_carbs,
        fat:     preview.target_fat,
        fiber:   preview.target_fiber,
        sugar:   preview.target_sugar,
      }
    : null

  const initialGoal = migrateLegacyGoal(
    profile?.primaryGoal ?? goalOffsetToId(profile?.goalOffset) ?? DEFAULT_GOAL,
  )

  const hasChanges = (
    String(draft.age)            !== String(initial.age)            ||
    String(draft.weight)         !== String(initial.weight)         ||
    String(draft.height)         !== String(initial.height)         ||
    draft.gender                 !== initial.gender                 ||
    draft.activity               !== initial.activity               ||
    draft.primaryGoal            !== initialGoal                    ||
    draft.dietPhilosophy         !== (profile?.dietPhilosophy ?? 'standart') ||
    JSON.stringify(draft.allergies)      !== JSON.stringify(profile?.allergies      ?? []) ||
    JSON.stringify(draft.medicalHistory) !== JSON.stringify(profile?.medicalHistory ?? [])
  )

  function toggleAllergen(id) {
    setDraft(prev => {
      if (id === 'yok') return { ...prev, allergies: ['yok'] }
      const next = prev.allergies.filter(a => a !== 'yok')
      return {
        ...prev,
        allergies: next.includes(id) ? next.filter(a => a !== id) : [...next, id],
      }
    })
  }

  function toggleMedical(id) {
    setDraft(prev => {
      if (id === 'yok') return { ...prev, medicalHistory: ['yok'] }
      const next = prev.medicalHistory.filter(m => m !== 'yok')
      return {
        ...prev,
        medicalHistory: next.includes(id) ? next.filter(m => m !== id) : [...next, id],
      }
    })
  }

  function buildComputedFromDraft(overrides = {}) {
    const merged = { ...draft, ...overrides }
    const nextStats = {
      ...(profile?.stats ?? {}),
      age:      Number(merged.age),
      weight:   Number(merged.weight),
      height:   Number(merged.height),
      gender:   merged.gender,
      activity: merged.activity,
    }
    const healthConditions = deriveHealthConditions(merged.allergies, merged.medicalHistory)
    return macroCalculator({
      stats: nextStats,
      primaryGoal:      merged.primaryGoal,
      dietPhilosophy:   merged.dietPhilosophy,
      medicalHistory:   merged.medicalHistory,
      healthConditions,
    })
  }

  async function selectGoal(goalId) {
    set('primaryGoal', goalId)
    const computed = buildComputedFromDraft({ primaryGoal: goalId })
    const nextStats = {
      ...(profile?.stats ?? {}),
      age:      Number(draft.age),
      weight:   Number(draft.weight),
      height:   Number(draft.height),
      gender:   draft.gender,
      activity: draft.activity,
    }
    const goalOffset = computed?.tdee
      ? computed.target_calories - computed.tdee
      : 0
    const { macroPercent: _omit, ...profileBase } = profile ?? {}
    await updateProfile({
      ...profileBase,
      stats:          nextStats,
      age:            nextStats.age,
      weight:         nextStats.weight,
      height:         nextStats.height,
      gender:         draft.gender,
      activity:       draft.activity,
      primaryGoal:    goalId,
      goalOffset,
      dietPhilosophy: draft.dietPhilosophy,
      allergies:      draft.allergies,
      medicalHistory: draft.medicalHistory,
      healthConditions: deriveHealthConditions(draft.allergies, draft.medicalHistory),
      tdee:             computed?.tdee ?? null,
      dailyGoal:        computed?.target_calories ?? null,
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
    })
  }

  async function handleSave() {
    const nextStats = {
      ...(profile?.stats ?? {}),
      age:      Number(draft.age),
      weight:   Number(draft.weight),
      height:   Number(draft.height),
      gender:   draft.gender,
      activity: draft.activity,
    }
    const healthConditions = deriveHealthConditions(draft.allergies, draft.medicalHistory)
    const computed = macroCalculator({
      stats: nextStats,
      primaryGoal:      draft.primaryGoal,
      dietPhilosophy:   draft.dietPhilosophy,
      medicalHistory:   draft.medicalHistory,
      healthConditions,
    })
    const goalOffset = computed?.tdee
      ? computed.target_calories - computed.tdee
      : 0
    const { macroPercent: _omit, ...profileBase } = profile ?? {}
    await updateProfile({
      ...profileBase,
      stats:          nextStats,
      age:            nextStats.age,
      weight:         nextStats.weight,
      height:         nextStats.height,
      gender:         draft.gender,
      activity:       draft.activity,
      primaryGoal:    draft.primaryGoal,
      goalOffset,
      dietPhilosophy: draft.dietPhilosophy,
      allergies:      draft.allergies,
      medicalHistory: draft.medicalHistory,
      healthConditions: deriveHealthConditions(draft.allergies, draft.medicalHistory),
      tdee:             computed?.tdee ?? null,
      dailyGoal:        computed?.target_calories ?? null,
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
    })
    setSaveStatus('saved')
    setTimeout(() => { setSaveStatus('idle'); onBack() }, 1500)
  }

  return (
    <SubViewContainer>
      <SubViewHeader title="Sağlık Profili" onBack={onBack} />
      <div className="flex-1 overflow-y-auto">
        <motion.div
          className="mx-auto w-full max-w-5xl space-y-10 px-4 py-6 pb-16 md:px-6"
          variants={PROFILE_STAGGER_CONTAINER}
          initial="hidden"
          animate="visible"
        >

          {/* Temel bilgiler — cinsiyet + ölçüler */}
          <motion.section variants={PROFILE_SECTION_VARIANT} className="space-y-4">
            <div className="grid max-w-md grid-cols-2 gap-4">
              {[
                { id: 'erkek', label: 'Erkek', icon: User },
                { id: 'kadin', label: 'Kadın', icon: UserRound },
              ].map(({ id, label, icon: GenderIcon }) => (
                <motion.button
                  key={id}
                  type="button"
                  onClick={() => set('gender', id)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`relative flex flex-col items-center gap-2 rounded-2xl border p-4 shadow-sm transition-colors duration-200 hover:border-green-400 hover:shadow-md ${
                    draft.gender === id
                      ? 'border-2 border-green-500 bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                      : 'border-gray-200 bg-white text-gray-800 dark:border-night-border dark:bg-night-card dark:text-white'
                  }`}
                >
                  {draft.gender === id && (
                    <CheckCircle2 className="absolute right-2.5 top-2.5 h-4 w-4 text-green-500 dark:text-green-400" strokeWidth={2.25} />
                  )}
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                    draft.gender === id
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
                  }`}>
                    <GenderIcon className="h-5 w-5" strokeWidth={2} />
                  </div>
                  <span className="text-sm font-semibold">{label}</span>
                </motion.button>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <StatInput label="Yaş"  value={draft.age}    onChange={v => set('age', v)}    unit="yıl" min="10" icon={Calendar} />
              <StatInput label="Boy"  value={draft.height} onChange={v => set('height', v)} unit="cm"  min="100" icon={Ruler} />
              <StatInput label="Kilo" value={draft.weight} onChange={v => set('weight', v)} unit="kg"  min="30" step="0.1" icon={Weight} />
            </div>
          </motion.section>

          {/* Activity Level */}
          <motion.section variants={PROFILE_SECTION_VARIANT}>
            <SectionLabel text="Aktivite Seviyesi" />
            <div className={PROFILE_RADIO_GRID}>
              {ACTIVITY_LEVELS.map(lvl => (
                <ProfileRadioCard
                  key={lvl.id}
                  selected={draft.activity === lvl.id}
                  onClick={() => set('activity', lvl.id)}
                  title={lvl.label}
                  description={lvl.desc}
                  trailing={`×${lvl.mult}`}
                  icon={lvl.icon}
                />
              ))}
            </div>
          </motion.section>

          {/* Primary Goal — Hedefiniz */}
          <motion.section variants={PROFILE_SECTION_VARIANT}>
            <SectionLabel text="Hedefiniz" />
            <div className={PROFILE_RADIO_GRID}>
              {GOAL_OPTIONS.map(({ id, label, desc, badge }) => (
                <ProfileRadioCard
                  key={id}
                  selected={draft.primaryGoal === id}
                  onClick={() => selectGoal(id)}
                  title={label}
                  description={desc}
                  trailing={badge}
                  icon={GOAL_ICONS[id]}
                />
              ))}
            </div>
          </motion.section>

          {/* Diet Philosophy */}
          <motion.section variants={PROFILE_SECTION_VARIANT}>
            <SectionLabel text="Diyet Tercihi" />
            <div className={PROFILE_RADIO_GRID}>
              {DIET_OPTIONS.map(({ id, label, desc }) => (
                <ProfileRadioCard
                  key={id}
                  selected={draft.dietPhilosophy === id}
                  onClick={() => set('dietPhilosophy', id)}
                  title={label}
                  description={desc}
                  icon={DIET_ICONS[id]}
                />
              ))}
            </div>
          </motion.section>

          {/* Allergies */}
          <motion.section variants={PROFILE_SECTION_VARIANT}>
            <SectionLabel text="Alerji ve Dışlamalar" />
            <div className={PROFILE_RADIO_GRID}>
              {ALLERGENS.map(({ id, label, desc }) => (
                <ProfileRadioCard
                  key={id}
                  selected={draft.allergies.includes(id)}
                  onClick={() => toggleAllergen(id)}
                  title={label}
                  description={desc}
                  icon={ALLERGEN_ICONS[id]}
                  className={id === 'yok' ? 'sm:col-span-2 lg:col-span-3' : ''}
                />
              ))}
            </div>
          </motion.section>

          {/* Medical history */}
          <motion.section variants={PROFILE_SECTION_VARIANT}>
            <SectionLabel text="Tıbbi Geçmiş" />
            <div className={PROFILE_RADIO_GRID}>
              {MEDICAL_CONDITIONS.map(({ id, label, desc }) => (
                <ProfileRadioCard
                  key={id}
                  selected={draft.medicalHistory.includes(id)}
                  onClick={() => toggleMedical(id)}
                  title={label}
                  description={desc}
                  icon={MEDICAL_ICONS[id]}
                />
              ))}
            </div>
          </motion.section>

          {/* Live TDEE preview */}
          {tdee > 0 && (
            <motion.div variants={PROFILE_SECTION_VARIANT} className="rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 p-5 text-white shadow-xl shadow-emerald-500/25">
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
            </motion.div>
          )}

          {/* Save */}
          {saveStatus === 'saved' && (
            <motion.div variants={PROFILE_SECTION_VARIANT} className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3 text-center">
              <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">✓ Profil güncellendi — TDEE ve hedef kalori kaydedildi.</p>
            </motion.div>
          )}
          <motion.button
            variants={PROFILE_SECTION_VARIANT}
            type="button" onClick={handleSave}
            disabled={(!hasChanges && saveStatus !== 'saved') || saveStatus === 'saved'}
            className={`w-full cursor-pointer rounded-3xl py-4 text-sm font-extrabold transition-all active:scale-95 ${
              saveStatus === 'saved'
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                : hasChanges
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 hover:bg-emerald-600 hover:shadow-xl'
                  : 'cursor-not-allowed bg-slate-200 dark:bg-night-muted text-slate-400 dark:text-slate-500'
            }`}
          >
            {saveStatus === 'saved' ? '✓ Kaydedildi!' : 'Kaydet'}
          </motion.button>

        </motion.div>
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

// ─── Sign-out button ──────────────────────────────────────────────────────────

function SignOutButton() {
  const [loading, setLoading] = useState(false)

  async function handleSignOut() {
    setLoading(true)
    await supabase.auth.signOut()
    // onAuthStateChange in App.jsx will set session to null → Auth screen shown
    setLoading(false)
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={loading}
      className="flex w-full cursor-pointer items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-red-50 dark:hover:bg-red-900/10 active:bg-red-100 dark:active:bg-red-900/20 disabled:opacity-60 disabled:cursor-not-allowed"
    >
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-red-50 dark:bg-red-900/20">
        {loading ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-red-300 border-t-red-500" />
        ) : (
          <svg className="h-5 w-5 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
          </svg>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-red-500 dark:text-red-400">
          {loading ? 'Çıkış yapılıyor…' : 'Çıkış Yap'}
        </p>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Hesabınızdan güvenli çıkış yapın</p>
      </div>
    </button>
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
  const stats     = getProfileStats(profile)
  const goalLabel = GOAL_LABELS[
    migrateLegacyGoal(profile?.primaryGoal ?? goalOffsetToId(profile?.goalOffset))
  ] ?? 'Sağlıklı Beslenmek'
  const dietLabel = DIET_OPTIONS.find(d => d.id === (profile?.dietPhilosophy ?? 'standart'))?.label ?? 'Standart'

  const SECTIONS = [
    {
      label: 'Hesap & Hedef',
      rows: [
        {
          id: 'profil',
          title: 'Sağlık Profili',
          subtitle: stats.age
            ? `${stats.weight} kg · ${stats.height} cm · ${goalLabel} · TDEE: ${profile?.tdee ? Number(profile.tdee).toLocaleString('tr-TR') : '—'} kcal`
            : 'Kilo, boy, hedef, alerji ve sağlık durumu',
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

      {/* ── HESAP / ÇIKIŞ ── */}
      <div>
        <SectionLabel text="Hesap" />
        <div className="overflow-hidden rounded-2xl border border-red-100 dark:border-red-900/30 bg-white dark:bg-night-card shadow-sm">
          <SignOutButton />
        </div>
      </div>

    </div>
  )
}
