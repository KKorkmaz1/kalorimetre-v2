/**
 * UI-only nutrition display formatters (tr-TR).
 * Never use for calculations, persistence or data transforms.
 */

function isNullish(value) {
  return value == null || !Number.isFinite(value)
}

function formatTr(value, maxDecimals) {
  return new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  }).format(value)
}

export function formatKcal(value) {
  if (isNullish(value)) return '—'
  if (value === 0) return '0'
  if (value > 0 && value < 0.05) return '<0,1'
  const rounded = Math.round(value * 10) / 10
  return formatTr(rounded, 1)
}

export function formatMacro(value) {
  if (value == null || !Number.isFinite(value)) return '—'
  if (value === 0) return '0'
  const abs = Math.abs(value)
  if (abs > 0 && abs < 0.01) return '<0,01'
  if (abs < 1) {
    const rounded = Math.round(value * 100) / 100
    return formatTr(rounded, 2)
  }
  const rounded = Math.round(value * 10) / 10
  return formatTr(rounded, 1)
}

export function formatWeight(value) {
  if (isNullish(value)) return '—'
  if (Number.isInteger(value) || Math.abs(value - Math.round(value)) < 1e-9) {
    return formatTr(Math.round(value), 0)
  }
  const rounded = Math.round(value * 10) / 10
  return formatTr(rounded, 1)
}

export function formatMilligrams(value) {
  if (value == null || !Number.isFinite(value)) return '—'
  if (value === 0) return '0'
  if (Math.abs(value) < 1) {
    const rounded = Math.round(value * 100) / 100
    return formatTr(rounded, 2)
  }
  const rounded = Math.round(value * 10) / 10
  return formatTr(rounded, 1)
}

export function formatQuantity(value) {
  if (value == null || !Number.isFinite(value)) return '—'
  if (Number.isInteger(value) || Math.abs(value - Math.round(value)) < 1e-9) {
    return formatTr(Math.round(value), 0)
  }
  const rounded = Math.round(value * 100) / 100
  return formatTr(rounded, 2)
}

/** Compact serving preview line for search cards. */
export function formatServingPreviewLine(serving) {
  if (!serving) return ''
  const gramsPart =
    serving.grams > 0 ? ` · ≈${formatWeight(serving.grams)}g` : ''
  return `${formatKcal(serving.kcal)} kcal · P:${formatMacro(serving.protein)}g K:${formatMacro(serving.carbs)}g Y:${formatMacro(serving.fat)}g${gramsPart}`
}
