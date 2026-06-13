/**
 * DietContext — single source of truth for the whole app.
 *
 * Provides:
 *   profile        — user profile object
 *   consumed       — { kcal, protein, carbs, fat } for today
 *   logs           — today's food log entries
 *   water          — glasses of water today
 *   recipes        — saved meal recipes array
 *   updateProfile  — saves profile to LS + updates state
 *   addLog         — adds a food/meal log entry (supports basket items array)
 *   deleteLog      — removes a log entry by id
 *   setWater       — updates today's water count
 *   saveRecipe     — persists a basket as a named recipe
 *   deleteRecipe   — removes a saved recipe by id
 */

import { createContext, useContext, useState, useEffect, useMemo } from 'react'
import { getUserProfile, saveUserProfile } from '../utils/storage'

const DietContext = createContext(null)

// ─── Per-day store ────────────────────────────────────────────────────────────

function todayKey() {
  return `kalorimetre_day_${new Date().toISOString().slice(0, 10)}`
}

function loadDayStore() {
  try {
    const raw = window.localStorage.getItem(todayKey())
    if (!raw) return { logs: [], water: 0 }
    const p = JSON.parse(raw)
    return { logs: Array.isArray(p.logs) ? p.logs : [], water: Number(p.water) || 0 }
  } catch { return { logs: [], water: 0 } }
}

function persistDayStore(data) {
  try { window.localStorage.setItem(todayKey(), JSON.stringify(data)) } catch {}
}

// ─── Recipes store ────────────────────────────────────────────────────────────

const RECIPES_KEY = 'kalorimetre_recipes'

function loadRecipes() {
  try {
    const raw = window.localStorage.getItem(RECIPES_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return []
}

function persistRecipes(recipes) {
  try { window.localStorage.setItem(RECIPES_KEY, JSON.stringify(recipes)) } catch {}
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function DietProvider({ children }) {
  const [profile,  setProfile]  = useState(undefined)
  const [day,      setDay]      = useState({ logs: [], water: 0 })
  const [recipes,  setRecipes]  = useState([])

  useEffect(() => {
    setProfile(getUserProfile() ?? null)
    setDay(loadDayStore())
    setRecipes(loadRecipes())
  }, [])

  // ── Derived totals ────────────────────────────────────────────────────────
  const consumed = useMemo(() => {
    const { logs } = day
    return {
      kcal:    logs.reduce((s, l) => s + (Number(l.kcal)    || 0), 0),
      protein: logs.reduce((s, l) => s + (Number(l.protein) || 0), 0),
      carbs:   logs.reduce((s, l) => s + (Number(l.carbs)   || 0), 0),
      fat:     logs.reduce((s, l) => s + (Number(l.fat)     || 0), 0),
    }
  }, [day.logs])

  // ── Profile ───────────────────────────────────────────────────────────────
  function updateProfile(newProfile) {
    saveUserProfile(newProfile)
    setProfile(newProfile)
  }

  // ── Day logs ──────────────────────────────────────────────────────────────
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
    }
    // Preserve optional extended fields (basket items, serving info)
    if (Array.isArray(entry.items) && entry.items.length > 0) {
      newEntry.items = entry.items
    }
    if (entry.servingInfo) newEntry.servingInfo = entry.servingInfo

    setDay(prev => {
      const next = { ...prev, logs: [...prev.logs, newEntry] }
      persistDayStore(next)
      return next
    })
    return newEntry
  }

  function deleteLog(id) {
    setDay(prev => {
      const next = { ...prev, logs: prev.logs.filter(l => l.id !== id) }
      persistDayStore(next)
      return next
    })
  }

  function setWater(count) {
    const clamped = Math.max(0, Math.min(16, Number(count) || 0))
    setDay(prev => {
      const next = { ...prev, water: clamped }
      persistDayStore(next)
      return next
    })
  }

  // ── Recipes ───────────────────────────────────────────────────────────────
  function saveRecipe(recipeData) {
    const newRecipe = {
      id:        crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      ...recipeData,
    }
    setRecipes(prev => {
      const next = [...prev, newRecipe]
      persistRecipes(next)
      return next
    })
    return newRecipe
  }

  function deleteRecipe(id) {
    setRecipes(prev => {
      const next = prev.filter(r => r.id !== id)
      persistRecipes(next)
      return next
    })
  }

  const value = {
    profile, consumed, logs: day.logs, water: day.water, recipes,
    updateProfile, addLog, deleteLog, setWater, saveRecipe, deleteRecipe,
  }

  return <DietContext.Provider value={value}>{children}</DietContext.Provider>
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDiet() {
  const ctx = useContext(DietContext)
  if (!ctx) throw new Error('useDiet must be used inside <DietProvider>')
  return ctx
}
