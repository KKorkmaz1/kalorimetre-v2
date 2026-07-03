/**
 * DietContext — Supabase-backed global state.
 *
 * Data sources:
 *   profiles    → supabase table  (profile goals, raw_data blob)
 *   daily_logs  → supabase table  (meals + water per date, keyed by user+date)
 *
 * All mutations use optimistic updates: React state is updated instantly,
 * then the async Supabase upsert runs in the background.
 *
 * Provides:
 *   profile          — full user profile object (null = needs onboarding)
 *   profileLoading   — true while the Supabase profiles row is being fetched
 *   macros           — { protein, carbs, fat, fiber, sugar } derived from goal
 *   consumed         — { kcal, protein, carbs, fat, fiber, sugar } for selectedDate
 *   logs             — food log entries for selectedDate
 *   water            — glasses of water for selectedDate
 *   selectedDate     — active dashboard date (YYYY-MM-DD, defaults to today)
 *   setSelectedDate  — navigate to another day
 *   mealsByDate      — in-memory cache: { "YYYY-MM-DD": { logs, water } }
 *   userId           — current Supabase UID (for child components that need it)
 *   updateProfile    — upserts profile to Supabase (optimistic)
 *   completeOnboarding — saves profile to Supabase first, then updates state
 *   addLog / updateLog / deleteLog
 *   setWater
 */

import { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../utils/supabaseClient'
import { saveUserProfile, saveDayMeals } from '../utils/storage'
import { macroCalculator, calculateMacros } from '../utils/macroCalculator'

const DietContext = createContext(null)

const SESSION_MISSING_MSG =
  'Oturumunuz bulunamadı. Lütfen giriş sayfasına dönüp tekrar giriş yapın.'

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

const EMPTY_DAY = { logs: [], water: 0 }

function shiftDateStr(dateStr, deltaDays) {
  const d = new Date(`${dateStr}T12:00:00`)
  d.setDate(d.getDate() + deltaDays)
  return d.toISOString().slice(0, 10)
}

export function formatSelectedDateLabel(dateStr) {
  if (dateStr === todayStr()) return 'Bugün'
  const d = new Date(`${dateStr}T12:00:00`)
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })
}

/** True when the user has a completed profile row in Supabase. */
export function hasCompletedProfile(row) {
  if (!row) return false
  const raw = row.raw_data
  if (raw && typeof raw === 'object' && Object.keys(raw).length > 0) {
    if (raw.dailyGoal || raw.tdee || raw.stats) return true
  }
  return Number(row.target_calories) > 0
}

/** Build profile object from Supabase row + optional raw_data. */
function resolveProfileFromRow(row) {
  if (!row) return null

  const raw = row.raw_data
  if (raw && typeof raw === 'object' && Object.keys(raw).length > 0) {
    return raw
  }

  const targetCal = Number(row.target_calories) || 0
  if (targetCal > 0) {
    return {
      dailyGoal:        targetCal,
      target_calories:  targetCal,
      target_protein:   row.target_protein,
      target_carbs:     row.target_carbs,
      target_fat:       row.target_fat,
      target_fiber:     row.target_fiber,
      target_sugar:     row.target_sugar,
      onboardingComplete: true,
    }
  }

  return null
}

function extractMacroTargetsFromPercent(profile) {
  const dailyGoal = Number(profile.dailyGoal) || 0
  if (!dailyGoal || !profile?.macroPercent) return null
  const { protein: pp = 25, carbs: cp = 50, fat: fp = 25 } = profile.macroPercent
  return {
    tdee:             Number(profile.tdee) || dailyGoal,
    target_calories:  dailyGoal,
    target_protein:   Math.round(dailyGoal * pp / 100 / 4),
    target_carbs:     Math.round(dailyGoal * cp / 100 / 4),
    target_fat:       Math.round(dailyGoal * fp / 100 / 9),
    target_fiber:     25,
    target_sugar:     Math.round(dailyGoal * 0.10 / 4),
  }
}

function extractMacroTargets(profile) {
  const custom = extractMacroTargetsFromPercent(profile)
  if (custom) return custom

  const computed = macroCalculator(profile) || calculateMacros(profile)
  if (computed) return computed

  return {
    tdee: 0, target_calories: 0, target_protein: 0, target_carbs: 0,
    target_fat: 0, target_fiber: 0, target_sugar: 0,
  }
}

/** Merge AMDR-calculated targets into profile before persisting to state/Supabase. */
function enrichProfileWithMacroTargets(profile) {
  // Skip auto-recalc when user has manually overridden macros via HedefDuzenle
  if (profile?.macroPercent?.protein > 0 && profile?.macroPercent?.carbs > 0) {
    const custom = extractMacroTargetsFromPercent(profile)
    if (custom?.target_calories) {
      return {
        ...profile,
        tdee:            custom.tdee || profile.tdee,
        dailyGoal:       custom.target_calories,
        goalOffset:      custom.tdee > 0 ? custom.target_calories - custom.tdee : profile.goalOffset,
        target_calories: custom.target_calories,
        target_protein:  custom.target_protein,
        target_carbs:    custom.target_carbs,
        target_fat:      custom.target_fat,
        target_fiber:    custom.target_fiber,
        target_sugar:    custom.target_sugar,
        macros: {
          protein: custom.target_protein,
          carbs:   custom.target_carbs,
          fat:     custom.target_fat,
          fiber:   custom.target_fiber,
          sugar:   custom.target_sugar,
        },
      }
    }
  }

  const targets = extractMacroTargets(profile)
  if (!targets?.target_calories) return profile

  const goalOffset = targets.tdee > 0
    ? targets.target_calories - targets.tdee
    : profile.goalOffset

  return {
    ...profile,
    tdee:            targets.tdee || profile.tdee,
    dailyGoal:       targets.target_calories,
    goalOffset,
    target_calories: targets.target_calories,
    target_protein:  targets.target_protein,
    target_carbs:    targets.target_carbs,
    target_fat:      targets.target_fat,
    target_fiber:    targets.target_fiber,
    target_sugar:    targets.target_sugar,
    macros: {
      protein: targets.target_protein,
      carbs:   targets.target_carbs,
      fat:     targets.target_fat,
      fiber:   targets.target_fiber,
      sugar:   targets.target_sugar,
    },
  }
}

/** JSON-safe snapshot for the raw_data jsonb column (no nested table columns). */
function buildProfileRawData(profile) {
  return JSON.parse(JSON.stringify({
    stats:            profile.stats            ?? null,
    primaryGoal:      profile.primaryGoal      ?? null,
    goalOffset:       profile.goalOffset       ?? null,
    dailyGoal:        profile.dailyGoal        ?? null,
    dietPhilosophy:   profile.dietPhilosophy   ?? null,
    allergies:        profile.allergies        ?? [],
    medicalHistory:   profile.medicalHistory   ?? [],
    healthConditions: profile.healthConditions ?? [],
    mode:             profile.mode             ?? null,
    tdee:             profile.tdee             ?? null,
    macros:           profile.macros           ?? null,
    dietPlan:         profile.dietPlan         ?? null,
    onboardingComplete: profile.onboardingComplete ?? false,
    userId:           profile.userId           ?? null,
  }))
}

async function assertAuthenticatedSession() {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()

  console.log('CURRENT SESSION:', session)

  if (sessionError) {
    console.error('SUPABASE SAVE ERROR:', sessionError)
    throw sessionError
  }

  if (!session || !session.user?.id) {
    await supabase.auth.signOut()
    const err = new Error(SESSION_MISSING_MSG)
    console.error('SUPABASE SAVE ERROR:', err)
    throw err
  }

  return session
}

async function upsertProfileToSupabase(_userId, profileToSave) {
  const session = await assertAuthenticatedSession()
  const authUserId = session.user.id
  const targets = extractMacroTargets(profileToSave)

  const payload = {
    id:              authUserId,
    target_calories: targets.target_calories,
    target_protein:  targets.target_protein,
    target_carbs:    targets.target_carbs,
    target_fat:      targets.target_fat,
    target_fiber:    targets.target_fiber,
    target_sugar:    targets.target_sugar,
    raw_data:        buildProfileRawData({ ...profileToSave, userId: authUserId }),
    updated_at:      new Date().toISOString(),
  }

  console.log('[DietContext] profiles upsert payload id:', payload.id)

  const { error } = await supabase
    .from('profiles')
    .upsert(payload, { onConflict: 'id' })

  if (error) {
    console.error('SUPABASE SAVE ERROR:', error)
    throw error
  }

  return authUserId
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function DietProvider({ children, userId }) {
  const [profile,         setProfile]         = useState(null)
  const [profileLoading,  setProfileLoading]  = useState(true)
  const [selectedDate,    setSelectedDate]    = useState(todayStr)
  const [mealsByDate,     setMealsByDate]     = useState({})
  const [dayLoading,      setDayLoading]      = useState(false)
  const profileMutationRef                    = useRef(0)
  const mealsCacheRef                         = useRef({})

  const day = mealsByDate[selectedDate] ?? EMPTY_DAY

  // ── Initial data load from Supabase ────────────────────────────────────────
  useEffect(() => {
    if (!userId) {
      setProfile(null)
      setProfileLoading(false)
      return
    }

    let cancelled = false
    const loadGeneration = profileMutationRef.current

    async function load() {
      setProfileLoading(true)
      try {
        const [profileRes, logsRes] = await Promise.all([
          supabase
            .from('profiles')
            .select('raw_data, target_calories, target_protein, target_carbs, target_fat, target_fiber, target_sugar')
            .eq('id', userId)
            .maybeSingle(),
          supabase
            .from('daily_logs')
            .select('meals_data')
            .eq('user_id', userId)
            .eq('date', todayStr())
            .maybeSingle(),
        ])

        if (cancelled) return
        if (profileMutationRef.current > loadGeneration) return

        if (profileRes.error) {
          console.error('[DietContext] profile fetch error:', profileRes.error)
          setProfile(null)
        } else if (hasCompletedProfile(profileRes.data)) {
          setProfile(resolveProfileFromRow(profileRes.data))
        } else {
          setProfile(null)
        }

        if (logsRes.error) {
          console.error('[DietContext] logs fetch error:', logsRes.error)
        } else {
          const todayData = logsRes.data?.meals_data ?? EMPTY_DAY
          const today = todayStr()
          mealsCacheRef.current = { ...mealsCacheRef.current, [today]: todayData }
          setMealsByDate(prev => ({ ...prev, [today]: todayData }))
          setSelectedDate(today)
        }
      } catch (err) {
        if (!cancelled && profileMutationRef.current <= loadGeneration) {
          console.error('[DietContext] load error:', err)
          setProfile(null)
        }
      } finally {
        if (!cancelled && profileMutationRef.current <= loadGeneration) {
          setProfileLoading(false)
        }
      }
    }

    load()
    return () => { cancelled = true }
  }, [userId])

  // ── Load selected date from Supabase when not cached ───────────────────────
  useEffect(() => {
    if (!userId || !selectedDate) return
    if (mealsCacheRef.current[selectedDate]) return

    let cancelled = false
    setDayLoading(true)

    async function loadDay() {
      try {
        const { data, error } = await supabase
          .from('daily_logs')
          .select('meals_data')
          .eq('user_id', userId)
          .eq('date', selectedDate)
          .maybeSingle()

        if (cancelled) return
        if (error) {
          console.error('[DietContext] day fetch error:', error)
          return
        }

        const dayData = data?.meals_data ?? EMPTY_DAY
        mealsCacheRef.current = { ...mealsCacheRef.current, [selectedDate]: dayData }
        setMealsByDate(prev => ({ ...prev, [selectedDate]: dayData }))
      } catch (err) {
        if (!cancelled) console.error('[DietContext] loadDay error:', err)
      } finally {
        if (!cancelled) setDayLoading(false)
      }
    }

    loadDay()
    return () => { cancelled = true }
  }, [userId, selectedDate])

  function goToPreviousDay() {
    setSelectedDate(prev => shiftDateStr(prev, -1))
  }

  function goToNextDay() {
    setSelectedDate(prev => {
      const next = shiftDateStr(prev, 1)
      return next > todayStr() ? prev : next
    })
  }

  // ── Derived totals ─────────────────────────────────────────────────────────
  const consumed = useMemo(() => {
    const { logs } = day
    return {
      kcal:    logs.reduce((s, l) => s + (Number(l.kcal)    || 0), 0),
      protein: logs.reduce((s, l) => s + (Number(l.protein) || 0), 0),
      carbs:   logs.reduce((s, l) => s + (Number(l.carbs)   || 0), 0),
      fat:     logs.reduce((s, l) => s + (Number(l.fat)     || 0), 0),
      fiber:   Math.round(logs.reduce((s, l) => s + (Number(l.fiber) || 0), 0) * 10) / 10,
      sugar:   Math.round(logs.reduce((s, l) => s + (Number(l.sugar) || 0), 0) * 10) / 10,
    }
  }, [day.logs])

  const isSelectedToday = selectedDate === todayStr()

  // ── Goal-based macros ──────────────────────────────────────────────────────
  const macros = useMemo(() => {
    if (!profile) return null

    if (Number(profile.target_protein) > 0) {
      return {
        protein: Number(profile.target_protein),
        carbs:   Number(profile.target_carbs)   || 0,
        fat:     Number(profile.target_fat)     || 0,
        fiber:   Number(profile.target_fiber)   || 25,
        sugar:   Number(profile.target_sugar)   || 0,
      }
    }

    const targets = extractMacroTargets(profile)
    if (targets?.target_calories > 0) {
      return {
        protein: targets.target_protein,
        carbs:   targets.target_carbs,
        fat:     targets.target_fat,
        fiber:   targets.target_fiber,
        sugar:   targets.target_sugar,
      }
    }

    return null
  }, [profile])

  // ── Supabase persistence helpers ───────────────────────────────────────────

  async function persistDay(date, newDay) {
    if (!date) return
    saveDayMeals(date, newDay)
    if (!userId) return
    const totalKcal = newDay.logs.reduce((s, l) => s + (Number(l.kcal) || 0), 0)
    try {
      await supabase
        .from('daily_logs')
        .upsert(
          {
            user_id:    userId,
            date,
            total_kcal: totalKcal,
            meals_data: newDay,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,date' },
        )
    } catch (err) {
      console.error('[DietContext] persistDay error:', err)
    }
  }

  function updateDayForSelected(updater) {
    setMealsByDate(prev => {
      const current = prev[selectedDate] ?? EMPTY_DAY
      const next = updater(current)
      mealsCacheRef.current = { ...mealsCacheRef.current, [selectedDate]: next }
      persistDay(selectedDate, next)
      return { ...prev, [selectedDate]: next }
    })
  }

  // ── Profile ────────────────────────────────────────────────────────────────

  async function updateProfile(newProfile) {
    profileMutationRef.current += 1
    const base = userId ? { ...newProfile, userId } : newProfile
    const profileToSave = enrichProfileWithMacroTargets(base)
    setProfile(profileToSave)
    saveUserProfile(profileToSave)

    if (!userId) return

    try {
      await upsertProfileToSupabase(userId, profileToSave)
    } catch (error) {
      console.error('[DietContext] updateProfile error:', error)
    }
  }

  /** Save onboarding profile to Supabase before routing to the dashboard. */
  async function completeOnboarding(newProfile) {
    profileMutationRef.current += 1

    const enriched = enrichProfileWithMacroTargets({
      ...newProfile,
      onboardingComplete: true,
    })

    let authUserId = userId
    try {
      authUserId = await upsertProfileToSupabase(userId, enriched)
    } catch (error) {
      console.error('SUPABASE SAVE ERROR:', error)
      throw error
    }

    const profileToSave = {
      ...enriched,
      userId: authUserId,
      onboardingComplete: true,
    }

    saveUserProfile(profileToSave)
    setProfile(profileToSave)
    setProfileLoading(false)
  }

  // ── Daily logs ─────────────────────────────────────────────────────────────

  function addLog(entry) {
    const newEntry = {
      id:        crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      name:      String(entry.name     ?? '').trim() || 'Bilinmeyen',
      mealType:  String(entry.mealType ?? 'Ara Öğün'),
      kcal:      Number(entry.kcal)    || 0,
      protein:   Number(entry.protein) || 0,
      carbs:     Number(entry.carbs)   || 0,
      fat:       Number(entry.fat)     || 0,
      fiber:     Number(entry.fiber)   || 0,
      sugar:     Number(entry.sugar)   || 0,
    }
    if (Array.isArray(entry.items) && entry.items.length > 0) newEntry.items = entry.items
    if (entry.servingInfo) newEntry.servingInfo = entry.servingInfo

    updateDayForSelected(prev => ({ ...prev, logs: [...prev.logs, newEntry] }))
    return newEntry
  }

  function updateLog(id, updates) {
    updateDayForSelected(prev => ({
      ...prev,
      logs: prev.logs.map(l => l.id === id ? { ...l, ...updates } : l),
    }))
  }

  function deleteLog(id) {
    updateDayForSelected(prev => ({
      ...prev,
      logs: prev.logs.filter(l => l.id !== id),
    }))
  }

  function setWater(count) {
    const clamped = Math.max(0, Math.min(16, Number(count) || 0))
    updateDayForSelected(prev => ({ ...prev, water: clamped }))
  }

  // ── Context value ──────────────────────────────────────────────────────────

  const value = {
    profile,
    profileLoading,
    macros,
    consumed,
    logs:            day.logs,
    water:           day.water,
    selectedDate,
    setSelectedDate,
    isSelectedToday,
    goToPreviousDay,
    goToNextDay,
    mealsByDate,
    dayLoading,
    userId,
    updateProfile,
    completeOnboarding,
    addLog,
    updateLog,
    deleteLog,
    setWater,
    recipes:       [],
    saveRecipe:    () => {},
    deleteRecipe:  () => {},
  }

  return <DietContext.Provider value={value}>{children}</DietContext.Provider>
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDiet() {
  const ctx = useContext(DietContext)
  if (!ctx) throw new Error('useDiet must be used inside <DietProvider>')
  return ctx
}
