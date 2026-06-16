/**
 * Macro Calculation Engine — deterministic, zero AI math.
 * All formulas follow medical nutrition standards.
 *
 * Exports:
 *   calcTDEE(age, weight, height, gender, activityId) → kcal (int)
 *   calcMacros(totalKcal, goalId) → { protein, carbs, fat, fiber, sugar }
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

// ─── Goal → macro percentage splits (medical standard) ────────────────────────

const GOAL_MACRO_PCTS = {
  kilo_ver:  { protein: 0.35, carbs: 0.40, fat: 0.25 },
  kilo_al:   { protein: 0.25, carbs: 0.50, fat: 0.25 },
  kas_kazan: { protein: 0.35, carbs: 0.45, fat: 0.20 },
  dengeli:   { protein: 0.25, carbs: 0.50, fat: 0.25 },
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

// ─── Goal-based macro calculation ─────────────────────────────────────────────

/**
 * Compute macronutrients from total daily kcal and a goal ID.
 *
 * Caloric conversion factors:
 *   protein 4 kcal/g  |  carbs 4 kcal/g  |  fat 9 kcal/g
 *
 * Additional metrics (medical guidelines):
 *   fiber  — 14g per 1 000 kcal  (IOM recommendation)
 *   sugar  — ≤10% of total kcal  → max grams = (kcal × 0.10) / 4
 *
 * @param {number} totalKcal
 * @param {string} goalId  — one of GOAL_MACRO_PCTS keys
 * @returns {{ protein, carbs, fat, fiber, sugar } | null}
 */
export function calcMacros(totalKcal, goalId) {
  if (!totalKcal || totalKcal <= 0) return null
  const pcts = GOAL_MACRO_PCTS[goalId] ?? GOAL_MACRO_PCTS.dengeli
  return {
    protein: Math.round(totalKcal * pcts.protein / 4),
    carbs:   Math.round(totalKcal * pcts.carbs   / 4),
    fat:     Math.round(totalKcal * pcts.fat     / 9),
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
