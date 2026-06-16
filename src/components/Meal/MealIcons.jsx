/**
 * MealIcons — shared SVG icon library.
 *
 * Strict macro color-code system:
 *   Calories  → CalorieIcon  (emerald)
 *   Protein   → ProteinIcon  (indigo)
 *   Carbs     → CarbsIcon    (amber)
 *   Fat       → FatIcon      (rose)
 *   Flame     → FlameIcon    (amber — avg kcal, history)
 *   Weight    → WeightIcon   (slate)
 *   Muscle    → MuscleIcon   (violet)
 */

// ─── Existing utility icons ───────────────────────────────────────────────────

export function TrashIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
    </svg>
  )
}

export function PlusIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
    </svg>
  )
}

export function CloseIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
  )
}

// ─── Macro color-code icons ───────────────────────────────────────────────────

/** Calories — Lightning / Zap bolt (filled). Color: emerald. */
export function CalorieIcon({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path fillRule="evenodd" d="M14.615 1.595a.75.75 0 01.359.852L12.982 9.75h7.268a.75.75 0 01.548 1.262l-10.5 11.25a.75.75 0 01-1.272-.71l1.992-7.302H3.818a.75.75 0 01-.548-1.262l10.5-11.25a.75.75 0 01.845-.143z" clipRule="evenodd" />
    </svg>
  )
}

/** Protein — Horizontal barbell/dumbbell (filled rects). Color: indigo. */
export function ProteinIcon({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      {/* Outer left grip */}
      <rect x="1.5" y="9.5" width="3" height="5" rx="1.5" />
      {/* Inner left plate */}
      <rect x="5.5" y="6.5" width="3" height="11" rx="1.5" />
      {/* Bar */}
      <rect x="8.5" y="10.75" width="7" height="2.5" rx="1.25" />
      {/* Inner right plate */}
      <rect x="15.5" y="6.5" width="3" height="11" rx="1.5" />
      {/* Outer right grip */}
      <rect x="19.5" y="9.5" width="3" height="5" rx="1.5" />
    </svg>
  )
}

/** Carbs — Leaf / botanical growth. Color: amber. */
export function CarbsIcon({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 8C8 10 5.9 16.17 3.82 19l3.09-3.09A4 4 0 016 13c3.58-3.58 8.5-4.5 13-4-.87 5-4 8-8.5 8.5" />
      <line x1="6" y1="19" x2="5" y2="22" />
    </svg>
  )
}

/** Fat — Water droplet (filled). Color: rose. */
export function FatIcon({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path fillRule="evenodd" d="M11.484 2.17a.75.75 0 011.032 0 11.209 11.209 0 017.877 10.58c0 5.799-4.338 10.5-9.893 10.5-5.554 0-9.893-4.701-9.893-10.5 0-4.368 2.667-8.112 6.503-9.858L11.484 2.17z" clipRule="evenodd" />
    </svg>
  )
}

/** Flame — for "avg kcal" in history and similar stats. Color: amber. */
export function FlameIcon({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
    </svg>
  )
}

/** Weight — weighing scale platform. Color: slate. */
export function WeightIcon({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {/* Platform base */}
      <rect x="2" y="16" width="20" height="4" rx="2" />
      {/* Dial / body */}
      <path d="M12 16V9" />
      <circle cx="12" cy="7" r="3" />
      {/* Tick at top */}
      <path d="M12 4v1" />
    </svg>
  )
}

/** Muscle — vertical barbell (filled). Color: violet. */
export function MuscleIcon({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      {/* Top outer grip */}
      <rect x="9.5" y="1" width="5" height="3" rx="1.5" />
      {/* Top inner plate */}
      <rect x="7" y="4" width="10" height="3" rx="1.5" />
      {/* Center bar */}
      <rect x="10" y="7" width="4" height="10" rx="1" />
      {/* Bottom inner plate */}
      <rect x="7" y="17" width="10" height="3" rx="1.5" />
      {/* Bottom outer grip */}
      <rect x="9.5" y="20" width="5" height="3" rx="1.5" />
    </svg>
  )
}
