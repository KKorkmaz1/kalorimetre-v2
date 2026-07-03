// ─── Keys & version ──────────────────────────────────────────────────────────
const LOGS_KEY = 'kalorimetre_user_logs'
const MEALS_BY_DATE_KEY = 'kalorimetre_meals_by_date'
const PROFILE_KEY = 'kalorimetre_user_profile'
const STORAGE_VERSION = 2

const EMPTY_DAY = { logs: [], water: 0 }

// ─── Helpers ─────────────────────────────────────────────────────────────────
function isStorageAvailable() {
  try {
    const k = '__kalorimetre_test__'
    window.localStorage.setItem(k, '1')
    window.localStorage.removeItem(k)
    return true
  } catch {
    return false
  }
}

function createEmptyStore() {
  return { version: STORAGE_VERSION, logs: [], updatedAt: new Date().toISOString() }
}

function parseStoredData(raw) {
  if (!raw) return createEmptyStore()
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || !Array.isArray(parsed.logs)) return createEmptyStore()
    return {
      version: parsed.version ?? STORAGE_VERSION,
      logs: parsed.logs,
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
    }
  } catch {
    return createEmptyStore()
  }
}

// ─── User Logs ────────────────────────────────────────────────────────────────
export function getUserLogs() {
  if (!isStorageAvailable()) return createEmptyStore()
  try {
    return parseStoredData(window.localStorage.getItem(LOGS_KEY))
  } catch {
    return createEmptyStore()
  }
}

export function saveUserLogs(logs) {
  if (!isStorageAvailable()) return { success: false, error: 'storage_unavailable' }
  if (!Array.isArray(logs)) return { success: false, error: 'invalid_logs' }
  try {
    const payload = { version: STORAGE_VERSION, logs, updatedAt: new Date().toISOString() }
    window.localStorage.setItem(LOGS_KEY, JSON.stringify(payload))
    return { success: true, data: payload }
  } catch {
    return { success: false, error: 'write_failed' }
  }
}

export function addUserLog(entry) {
  const store = getUserLogs()
  const nextLog = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...entry }
  const result = saveUserLogs([nextLog, ...store.logs])
  return result.success ? { success: true, data: nextLog } : result
}

export function clearUserLogs() {
  if (!isStorageAvailable()) return { success: false, error: 'storage_unavailable' }
  try {
    window.localStorage.removeItem(LOGS_KEY)
    window.localStorage.removeItem(MEALS_BY_DATE_KEY)
    return { success: true }
  } catch {
    return { success: false, error: 'clear_failed' }
  }
}

// ─── Meals by date ────────────────────────────────────────────────────────────

function createEmptyMealsByDateStore() {
  return { version: STORAGE_VERSION, mealsByDate: {}, updatedAt: new Date().toISOString() }
}

function parseMealsByDate(raw) {
  if (!raw) return createEmptyMealsByDateStore()
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed.mealsByDate !== 'object') return createEmptyMealsByDateStore()
    return {
      version: parsed.version ?? STORAGE_VERSION,
      mealsByDate: parsed.mealsByDate,
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
    }
  } catch {
    return createEmptyMealsByDateStore()
  }
}

export function getMealsByDate() {
  if (!isStorageAvailable()) return createEmptyMealsByDateStore()
  try {
    return parseMealsByDate(window.localStorage.getItem(MEALS_BY_DATE_KEY))
  } catch {
    return createEmptyMealsByDateStore()
  }
}

export function saveMealsByDate(mealsByDate) {
  if (!isStorageAvailable()) return { success: false, error: 'storage_unavailable' }
  if (!mealsByDate || typeof mealsByDate !== 'object') {
    return { success: false, error: 'invalid_meals_by_date' }
  }
  try {
    const payload = {
      version: STORAGE_VERSION,
      mealsByDate,
      updatedAt: new Date().toISOString(),
    }
    window.localStorage.setItem(MEALS_BY_DATE_KEY, JSON.stringify(payload))
    return { success: true, data: payload }
  } catch {
    return { success: false, error: 'write_failed' }
  }
}

export function saveDayMeals(dateStr, dayData) {
  if (!dateStr) return { success: false, error: 'invalid_date' }
  const store = getMealsByDate()
  return saveMealsByDate({
    ...store.mealsByDate,
    [dateStr]: dayData ?? EMPTY_DAY,
  })
}

export function getDayMeals(dateStr) {
  const store = getMealsByDate()
  return store.mealsByDate[dateStr] ?? EMPTY_DAY
}

// ─── User Profile ─────────────────────────────────────────────────────────────
export function getUserProfile() {
  if (!isStorageAvailable()) return null
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function saveUserProfile(profile) {
  if (!isStorageAvailable()) return { success: false, error: 'storage_unavailable' }
  try {
    const payload = { ...profile, savedAt: new Date().toISOString() }
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(payload))
    return { success: true, data: payload }
  } catch {
    return { success: false, error: 'write_failed' }
  }
}

export function clearUserProfile() {
  if (!isStorageAvailable()) return { success: false, error: 'storage_unavailable' }
  try {
    window.localStorage.removeItem(PROFILE_KEY)
    return { success: true }
  } catch {
    return { success: false, error: 'clear_failed' }
  }
}
