/**
 * Macro Engine — Mifflin-St Jeor TDEE + AMDR goal splits.
 *
 * TDEE: Mifflin-St Jeor BMR × activity multiplier
 * Target calories: TDEE + goal calorie delta (lose / maintain / gain)
 * Macros: goal-specific AMDR % → grams (÷4 carbs/protein, ÷9 fat)
 */

import { DEFAULT_GOAL, VALID_GOAL_IDS } from '../constants/goalOptions'

const ACTIVITY_MULT = {
  sedentary:  1.2,
  light:      1.375,
  moderate:   1.55,
  active:     1.725,
  veryActive: 1.9,
  sedanter:   1.2,
  az_aktif:   1.375,
  orta_aktif: 1.55,
  cok_aktif:  1.725,
  ekstra:     1.9,
}

/** Fixed kcal adjustment from TDEE by primary goal (exact Turkish strings). */
export const GOAL_CALORIE_DELTAS = {
  'Sağlıklı Beslenmek':     0,
  'Dengeli Kilo Vermek':  -300,
  'Hızlı Kilo Vermek':    -500,
  'Dengeli Kilo Almak':    300,
  'Hızlı Kilo Almak':      500,
  'Dengeli Kas Kazanmak':  200,
  'Hızlı Kas Kazanmak':    400,
}

/** AMDR macro splits (% of target calories) per goal. */
export const GOAL_MACRO_SPLITS = {
  'Sağlıklı Beslenmek':    { carbs: 45, protein: 25, fat: 30 },
  'Dengeli Kilo Vermek':   { carbs: 40, protein: 30, fat: 30 },
  'Hızlı Kilo Vermek':     { carbs: 35, protein: 35, fat: 30 },
  'Dengeli Kilo Almak':    { carbs: 45, protein: 25, fat: 30 },
  'Hızlı Kilo Almak':      { carbs: 50, protein: 20, fat: 30 },
  'Dengeli Kas Kazanmak':  { carbs: 45, protein: 30, fat: 25 },
  'Hızlı Kas Kazanmak':    { carbs: 50, protein: 25, fat: 25 },
}

/** Keto override when diet philosophy is ketojenik. */
export const KETO_MACRO_SPLIT = { carbs: 5, protein: 25, fat: 70 }

/** Safe baseline when profile stats are incomplete. */
export const BASELINE_CALORIES = 2000

const MIN_CALORIES = { kadin: 1200, erkek: 1500 }
const DEFAULT_FIBER_G = 25
const ELEVATED_FIBER_G = 30
const SUGAR_MAX_PCT = 0.10
const SUGAR_MEDICAL_MAX_PCT = 0.05
const CARB_MEDICAL_CAP_PCT = 35
const FAT_MEDICAL_CAP_PCT = 25

/** Map legacy slug goal ids to the current 7-option model. */
const LEGACY_GOAL_MAP = {
  kilo_ver_hizli:   'Hızlı Kilo Vermek',
  kilo_ver_dengeli: 'Dengeli Kilo Vermek',
  kilo_ver:         'Hızlı Kilo Vermek',
  saglikli_dengeli: 'Sağlıklı Beslenmek',
  dengeli:          'Sağlıklı Beslenmek',
  kilo_koru:        'Sağlıklı Beslenmek',
  kilo_al_dengeli:  'Dengeli Kilo Almak',
  kilo_al_hizli:    'Hızlı Kilo Almak',
  kilo_al:          'Dengeli Kilo Almak',
  kas_yagsiz:       'Dengeli Kas Kazanmak',
  kas_dengeli:      'Dengeli Kas Kazanmak',
  kas_hizli:        'Hızlı Kas Kazanmak',
  kas_kazan:        'Dengeli Kas Kazanmak',
  kas_al:           'Dengeli Kilo Almak',
}

function pickStats(profile) {
  const stats = profile?.stats ?? profile ?? {}
  return {
    age:      Number(stats.age      ?? profile?.age)      || 0,
    weight:   Number(stats.weight   ?? profile?.weight)   || 0,
    height:   Number(stats.height   ?? profile?.height)   || 0,
    gender:   stats.gender   ?? profile?.gender   ?? 'erkek',
    activity: stats.activity ?? profile?.activity ?? 'sedentary',
  }
}

function pickGoal(profile) {
  return migrateLegacyGoal(
    profile?.primaryGoal ?? profile?.goal ?? goalOffsetToId(profile?.goalOffset),
  )
}

function minCaloriesForGender(gender) {
  return MIN_CALORIES[gender === 'kadin' ? 'kadin' : 'erkek']
}

function pctToGrams(targetCalories, split) {
  return {
    target_protein: Math.round((targetCalories * split.protein / 100) / 4),
    target_carbs:   Math.round((targetCalories * split.carbs   / 100) / 4),
    target_fat:     Math.round((targetCalories * split.fat     / 100) / 9),
  }
}

function normalizeMedicalFlags(profile) {
  const history = profile?.medicalHistory ?? []
  const conditions = profile?.healthConditions ?? profile?.medicalConditions ?? []

  const hasDiabetes = history.includes('diyabet_tip1')
    || history.includes('diyabet_tip2')
    || conditions.includes('diyabet')
  const hasInsulinResistance = history.includes('insulin_direnci')
    || conditions.includes('insulin_direnci')
  const hasPcos = history.includes('pcos')
    || conditions.includes('pcos')
  const hasTansiyon = history.includes('tansiyon')
    || conditions.includes('tansiyon')
  const hasKolesterol = history.includes('kolesterol')
    || conditions.includes('kolesterol')

  return {
    lowCarb:   hasDiabetes || hasInsulinResistance || hasPcos,
    lowFat:    hasTansiyon || hasKolesterol,
    highFiber: hasTansiyon || hasKolesterol,
    lowSugar:  hasDiabetes || hasInsulinResistance || hasPcos,
  }
}

function redistributeCap(split, cappedKey, capValue) {
  const next = { ...split }
  if (next[cappedKey] <= capValue) return next

  const excess = next[cappedKey] - capValue
  next[cappedKey] = capValue

  const others = ['protein', 'carbs', 'fat'].filter(k => k !== cappedKey)
  const otherTotal = others.reduce((s, k) => s + next[k], 0) || 1

  for (const key of others) {
    next[key] += excess * (next[key] / otherTotal)
  }

  return next
}

function applyMedicalMacroOverrides(split, flags) {
  let adjusted = { ...split }

  if (flags.lowCarb) {
    adjusted = redistributeCap(adjusted, 'carbs', CARB_MEDICAL_CAP_PCT)
  }
  if (flags.lowFat) {
    adjusted = redistributeCap(adjusted, 'fat', FAT_MEDICAL_CAP_PCT)
  }

  const total = adjusted.protein + adjusted.carbs + adjusted.fat
  if (total <= 0) return split

  return {
    protein: (adjusted.protein / total) * 100,
    carbs:   (adjusted.carbs   / total) * 100,
    fat:     (adjusted.fat     / total) * 100,
  }
}

function resolveMacroSplit(profile, goal) {
  if (profile?.dietPhilosophy === 'keto') return { ...KETO_MACRO_SPLIT }
  return { ...(GOAL_MACRO_SPLITS[goal] ?? GOAL_MACRO_SPLITS[DEFAULT_GOAL]) }
}

/**
 * Core calculation: TDEE + goal delta + AMDR grams.
 * @param {object} profile
 * @returns macro target object or null
 */
function computeMacroTargets(profile) {
  if (!profile) return null

  const { age, weight, height, gender, activity } = pickStats(profile)
  if (!age || !weight || !height) return null

  const bmr  = calcBMR(age, weight, height, gender)
  const tdee = Math.round(bmr * (ACTIVITY_MULT[activity] ?? 1.2))
  if (!tdee) return null

  const goal = pickGoal(profile)
  const delta = GOAL_CALORIE_DELTAS[goal] ?? 0
  const target_calories = Math.max(minCaloriesForGender(gender), tdee + delta)

  const medicalFlags = normalizeMedicalFlags(profile)
  const split = applyMedicalMacroOverrides(resolveMacroSplit(profile, goal), medicalFlags)
  const grams = pctToGrams(target_calories, split)

  const target_fiber = medicalFlags.highFiber ? ELEVATED_FIBER_G : DEFAULT_FIBER_G
  const sugarPct = medicalFlags.lowSugar ? SUGAR_MEDICAL_MAX_PCT : SUGAR_MAX_PCT
  const target_sugar = Math.round((target_calories * sugarPct) / 4)

  return {
    bmr:             Math.round(bmr),
    tdee,
    primaryGoal:     goal,
    goalOffset:      target_calories - tdee,
    dailyCalorie:    target_calories,
    target_calories,
    ...grams,
    target_fiber,
    target_sugar,
  }
}

/** Normalize legacy goal ids to the current 7-option model. */
export function migrateLegacyGoal(goalId) {
  if (!goalId) return DEFAULT_GOAL
  if (VALID_GOAL_IDS.has(goalId)) return goalId
  return LEGACY_GOAL_MAP[goalId] ?? DEFAULT_GOAL
}

/** True when gender, age, weight, height and activity are all set. */
export function hasCompleteProfileStats(profile) {
  if (!profile) return false
  const { age, weight, height, gender, activity } = pickStats(profile)
  return !!(age && weight && height && gender && activity)
}

/**
 * Mifflin-St Jeor TDEE + goal-based calories and AMDR macros.
 * @param {object} user — profile or `{ stats, primaryGoal }`
 */
export function calculateMacros(user) {
  return computeMacroTargets(user)
}

/** Full macro calculation (alias — includes medical & keto overrides). */
export function macroCalculator(profile) {
  return computeMacroTargets(profile)
}

/** Baseline targets when profile is incomplete (maintain split @ 2000 kcal). */
export function getBaselineMacroTargets() {
  const split = GOAL_MACRO_SPLITS[DEFAULT_GOAL]
  const grams = pctToGrams(BASELINE_CALORIES, split)
  return {
    tdee:            BASELINE_CALORIES,
    dailyCalorie:    BASELINE_CALORIES,
    target_calories: BASELINE_CALORIES,
    ...grams,
    target_fiber: DEFAULT_FIBER_G,
    target_sugar: Math.round((BASELINE_CALORIES * SUGAR_MAX_PCT) / 4),
  }
}

/** Dashboard target resolver — prefers live context macros from DietContext. */
export function resolveDashboardTargets(profile, contextMacros) {
  const computed = macroCalculator(profile)
  const dailyGoal = Number(profile?.dailyGoal) || Number(profile?.target_calories) || 0

  if (dailyGoal > 0 && contextMacros) {
    return {
      target:       dailyGoal,
      macroTgt:     contextMacros,
      isBaseline:   false,
      needsProfile: !hasCompleteProfileStats(profile) || !profile?.primaryGoal,
    }
  }

  if (computed) {
    return {
      target: computed.target_calories,
      macroTgt: {
        protein: computed.target_protein,
        carbs:   computed.target_carbs,
        fat:     computed.target_fat,
        fiber:   computed.target_fiber,
        sugar:   computed.target_sugar,
      },
      isBaseline:   false,
      needsProfile: !profile?.primaryGoal,
    }
  }

  const baseline = getBaselineMacroTargets()
  return {
    target:       baseline.target_calories,
    macroTgt: {
      protein: baseline.target_protein,
      carbs:   baseline.target_carbs,
      fat:     baseline.target_fat,
      fiber:   baseline.target_fiber,
      sugar:   baseline.target_sugar,
    },
    isBaseline:   true,
    needsProfile: true,
  }
}

export function calcBMR(age, weight, height, gender) {
  const a = Number(age)    || 0
  const w = Number(weight) || 0
  const h = Number(height) || 0
  if (!a || !w || !h) return 0
  return gender === 'kadin'
    ? 10 * w + 6.25 * h - 5 * a - 161
    : 10 * w + 6.25 * h - 5 * a + 5
}

export function calcTDEE(age, weight, height, gender, activityId) {
  const bmr = calcBMR(age, weight, height, gender)
  if (!bmr) return 0
  const mult = ACTIVITY_MULT[activityId] ?? 1.2
  return Math.round(bmr * mult)
}

/** Map legacy numeric goalOffset to a primaryGoal id. */
export function goalOffsetToId(goalOffset) {
  const offset = Number(goalOffset) || 0
  if (offset <= -450) return 'Hızlı Kilo Vermek'
  if (offset < 0)     return 'Dengeli Kilo Vermek'
  if (offset === 0)   return 'Sağlıklı Beslenmek'
  if (offset <= 250)  return 'Dengeli Kas Kazanmak'
  if (offset <= 350)  return 'Dengeli Kilo Almak'
  if (offset <= 450)  return 'Hızlı Kas Kazanmak'
  return 'Hızlı Kilo Almak'
}

// Legacy exports kept for any remaining imports
export const GOAL_MULTIPLIERS = Object.fromEntries(
  Object.keys(GOAL_CALORIE_DELTAS).map(id => [id, 1]),
)
export const AMDR_SPLITS = GOAL_MACRO_SPLITS
export const PHASE1_MACRO_SPLIT = GOAL_MACRO_SPLITS[DEFAULT_GOAL]
