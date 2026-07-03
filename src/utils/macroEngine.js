/**
 * Macro Calculation Engine — deterministic, zero AI math.
 * All formulas follow medical nutrition standards.
 *
 * Exports:
 *   calcTDEE(age, weight, height, gender, activityId) → kcal (int)
 *   calcMacros(totalKcal, goalId, weightKg) → { protein, carbs, fat, fiber, sugar }
 *   getDailyCalorieTarget(profile) → adjusted daily kcal target
 *   goalOffsetToId(goalOffset) → goalId string
 *   GOAL_DELTAS  — calorie delta per goal
 */

// ─── Activity multipliers ──────────────────────────────────────────────────────
// Supports both Settings IDs and OnboardingWizard IDs

const ACTIVITY_MULT = {
  sedentary:  1.2,
  light:      1.375,
  moderate:   1.55,
  active:     1.725,
  veryActive: 1.9,
  // OnboardingWizard IDs
  sedanter:   1.2,
  az_aktif:   1.375,
  orta_aktif: 1.55,
  cok_aktif:  1.725,
  ekstra:     1.9,
}

// ─── Goal → calorie delta ──────────────────────────────────────────────────────

export const GOAL_DELTAS = {
  kilo_ver:  -500,
  kilo_al:   +500,
  kas_kazan: +250,
  dengeli:   0,
}

// ─── Goal → protein multiplier (g per kg body weight) ─────────────────────────

const GOAL_PROTEIN_MULT = {
  kilo_ver:  1.8,
  kas_kazan: 1.8,
  kilo_al:   1.6,
  dengeli:   1.5,
}

// ─── Goal → fat share of total kcal (25–30% range) ────────────────────────────

const GOAL_FAT_PCT = {
  kilo_ver:  0.27,
  kas_kazan: 0.25,
  kilo_al:   0.25,
  dengeli:   0.30,
}

// ─── Mifflin-St Jeor TDEE ─────────────────────────────────────────────────────

/**
 * Mifflin-St Jeor formula.
 * @param {number|string} age
 * @param {number|string} weight  kg
 * @param {number|string} height  cm
 * @param {'erkek'|'kadin'} gender
 * @param {string} activityId  — any key in ACTIVITY_MULT
 * @returns {number} TDEE in kcal, or 0 if inputs are incomplete
 */
export function calcTDEE(age, weight, height, gender, activityId) {
  const a    = Number(age)    || 0
  const w    = Number(weight) || 0
  const h    = Number(height) || 0
  const mult = ACTIVITY_MULT[activityId] ?? 1.2
  if (!a || !w || !h) return 0
  const bmr = gender === 'kadin'
    ? 10 * w + 6.25 * h - 5 * a - 161
    : 10 * w + 6.25 * h - 5 * a + 5
  return Math.round(bmr * mult)
}

// ─── Daily calorie target (single source of truth) ────────────────────────────

/**
 * Returns the user's adjusted daily calorie target.
 * Prefers `dailyGoal`; falls back to base TDEE + goalOffset with legacy handling.
 */
export function getDailyCalorieTarget(profile) {
  if (!profile) return 0

  const dailyGoal = Number(profile.dailyGoal)
  if (dailyGoal > 0) return dailyGoal

  const baseTdee = Number(profile.tdee) || 0
  if (baseTdee <= 0) return 0

  const offset = Number(profile.goalOffset) || 0
  const withOffset = Math.max(1200, baseTdee + offset)

  // Legacy: onboarding previously stored adjusted kcal in `tdee` — avoid double subtraction
  if (offset < 0 && withOffset < baseTdee - 400) {
    return Math.max(1200, baseTdee)
  }

  return withOffset
}

/** Extract body weight (kg) from profile object. */
export function getProfileWeight(profile) {
  return Number(profile?.stats?.weight) || Number(profile?.weight) || 0
}

// ─── Goal-based macro calculation ─────────────────────────────────────────────

/**
 * Compute macronutrients from total daily kcal, goal, and body weight.
 *
 * Protein: 1.5–1.8 g/kg (goal-dependent)
 * Fat:     25–30% of total kcal
 * Carbs:   remainder
 *
 * @param {number} totalKcal
 * @param {string} goalId  — one of GOAL_DELTAS keys
 * @param {number} [weightKg]
 * @returns {{ protein, carbs, fat, fiber, sugar } | null}
 */
export function calcMacros(totalKcal, goalId, weightKg = 0) {
  if (!totalKcal || totalKcal <= 0) return null

  const w = Number(weightKg) || 70
  const proteinMult = GOAL_PROTEIN_MULT[goalId] ?? GOAL_PROTEIN_MULT.dengeli
  const fatPct      = GOAL_FAT_PCT[goalId]      ?? GOAL_FAT_PCT.dengeli

  let proteinG = Math.round(w * proteinMult)
  let fatG     = Math.round((totalKcal * fatPct) / 9)

  let proteinKcal = proteinG * 4
  let fatKcal     = fatG * 9

  // Ensure carbs get at least ~15% of kcal — reduce fat first, then protein
  if (proteinKcal + fatKcal > totalKcal * 0.85) {
    fatG     = Math.round((totalKcal * fatPct) / 9)
    fatKcal  = fatG * 9
    proteinKcal = Math.max(0, totalKcal - fatKcal - Math.round(totalKcal * 0.40))
    proteinG = Math.round(proteinKcal / 4)
  }

  const carbsKcal = Math.max(0, totalKcal - proteinG * 4 - fatG * 9)
  const carbsG    = Math.round(carbsKcal / 4)

  return {
    protein: proteinG,
    carbs:   carbsG,
    fat:     fatG,
    fiber:   Math.round((totalKcal / 1000) * 14),
    sugar:   Math.round((totalKcal * 0.10) / 4),
  }
}

// ─── Legacy helper ────────────────────────────────────────────────────────────

/**
 * Map a numeric goalOffset (legacy Settings format) to a goal ID string.
 */
export function goalOffsetToId(goalOffset) {
  const offset = Number(goalOffset) || 0
  if (offset < 0)     return 'kilo_ver'
  if (offset === 250) return 'kas_kazan'
  if (offset > 0)     return 'kilo_al'
  return 'dengeli'
}
