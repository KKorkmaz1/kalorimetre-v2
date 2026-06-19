/**
 * DietContext — Supabase-backed global state.
 *
 * Data sources:
 *   profiles    → supabase table  (profile goals, raw_data blob)
 *   daily_logs  → supabase table  (today's meals + water, keyed by user+date)
 *
 * All mutations use optimistic updates: React state is updated instantly,
 * then the async Supabase upsert runs in the background.
 *
 * Provides:
 *   profile        — full user profile object (null = new user, undefined = loading)
 *   macros         — { protein, carbs, fat, fiber, sugar } derived from goal
 *   consumed       — { kcal, protein, carbs, fat, fiber, sugar } for today
 *   logs           — today's food log entries
 *   water          — glasses of water today
 *   userId         — current Supabase UID (for child components that need it)
 *   updateProfile  — upserts profile to Supabase
 *   addLog / updateLog / deleteLog
 *   setWater
 */

import { createContext, useContext, useState, useEffect, useMemo } from 'react'
import { supabase } from '../utils/supabaseClient'
import { calcMacros, goalOffsetToId } from '../utils/macroEngine'

const DietContext = createContext(null)

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function extractMacroTargets(profile) {
  const dailyGoal = Number(profile?.dailyGoal) || 0
  if (!dailyGoal) return { calories: 0, protein: 0, carbs: 0, fat: 0 }
  const goalId = profile?.primaryGoal ?? goalOffsetToId(profile?.goalOffset)
  const m = calcMacros(dailyGoal, goalId) ?? {}
  return {
    calories: dailyGoal,
    protein:  m.protein ?? 0,
    carbs:    m.carbs   ?? 0,
    fat:      m.fat     ?? 0,
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function DietProvider({ children, userId }) {
  const [profile, setProfile] = useState(undefined) // undefined = loading
  const [day,     setDay]     = useState({ logs: [], water: 0 })

  // ── Initial data load from Supabase ────────────────────────────────────────
  useEffect(() => {
    if (!userId) return

    let cancelled = false

    async function load() {
      try {
        const [profileRes, logsRes] = await Promise.all([
          supabase
            .from('profiles')
            .select('raw_data')
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

        setProfile(profileRes.data?.raw_data ?? null)
        setDay(logsRes.data?.meals_data ?? { logs: [], water: 0 })
      } catch (err) {
        if (!cancelled) {
          console.error('[DietContext] load error:', err)
          setProfile(null)
        }
      }
    }

    load()
    return () => { cancelled = true }
  }, [userId])

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

  // ── Goal-based macros ──────────────────────────────────────────────────────
  const macros = useMemo(() => {
    const dailyGoal = Number(profile?.dailyGoal) || 0
    if (!dailyGoal) return null
    if (profile?.macroPercent) {
      const { protein: pp = 25, carbs: cp = 50, fat: fp = 25 } = profile.macroPercent
      return {
        protein: Math.round(dailyGoal * (pp / 100) / 4),
        carbs:   Math.round(dailyGoal * (cp / 100) / 4),
        fat:     Math.round(dailyGoal * (fp / 100) / 9),
        fiber:   Math.round((dailyGoal / 1000) * 14),
        sugar:   Math.round((dailyGoal * 0.10) / 4),
      }
    }
    const goalId = profile?.primaryGoal ?? goalOffsetToId(profile?.goalOffset)
    return calcMacros(dailyGoal, goalId)
  }, [profile])

  // ── Supabase persistence helpers ───────────────────────────────────────────

  async function persistDay(newDay) {
    if (!userId) return
    const totalKcal = newDay.logs.reduce((s, l) => s + (Number(l.kcal) || 0), 0)
    try {
      await supabase
        .from('daily_logs')
        .upsert(
          {
            user_id:    userId,
            date:       todayStr(),
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

  // ── Profile ────────────────────────────────────────────────────────────────

  async function updateProfile(newProfile) {
    const profileToSave = userId ? { ...newProfile, userId } : newProfile
    // Optimistic: update UI immediately
    setProfile(profileToSave)

    if (!userId) return

    const targets = extractMacroTargets(profileToSave)
    try {
      await supabase
        .from('profiles')
        .upsert(
          {
            id:              userId,
            target_calories: targets.calories,
            target_protein:  targets.protein,
            target_carbs:    targets.carbs,
            target_fat:      targets.fat,
            raw_data:        profileToSave,
            updated_at:      new Date().toISOString(),
          },
          { onConflict: 'id' },
        )
    } catch (err) {
      console.error('[DietContext] updateProfile error:', err)
    }
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

    setDay(prev => {
      const next = { ...prev, logs: [...prev.logs, newEntry] }
      persistDay(next)
      return next
    })
    return newEntry
  }

  function updateLog(id, updates) {
    setDay(prev => {
      const next = { ...prev, logs: prev.logs.map(l => l.id === id ? { ...l, ...updates } : l) }
      persistDay(next)
      return next
    })
  }

  function deleteLog(id) {
    setDay(prev => {
      const next = { ...prev, logs: prev.logs.filter(l => l.id !== id) }
      persistDay(next)
      return next
    })
  }

  function setWater(count) {
    const clamped = Math.max(0, Math.min(16, Number(count) || 0))
    setDay(prev => {
      const next = { ...prev, water: clamped }
      persistDay(next)
      return next
    })
  }

  // ── Context value ──────────────────────────────────────────────────────────

  const value = {
    profile,
    macros,
    consumed,
    logs:    day.logs,
    water:   day.water,
    userId,
    updateProfile,
    addLog,
    updateLog,
    deleteLog,
    setWater,
    // Kept for API compatibility — ephemeral in-memory only
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
