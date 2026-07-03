/**
 * Primary nutrition goals — AMDR-aligned (sports science standard).
 * Goal ids are the exact Turkish display strings used by macroCalculator.
 */

export const GOAL_OPTIONS = [
  {
    id:    'Sağlıklı Beslenmek',
    label: 'Sağlıklı Beslenmek',
    desc:  'TDEE · Karb %45 · Protein %25 · Yağ %30',
    badge: 'TDEE',
  },
  {
    id:    'Dengeli Kilo Vermek',
    label: 'Dengeli Kilo Vermek',
    desc:  'TDEE − 300 kcal · Karb %40 · Protein %30 · Yağ %30',
    badge: '−300',
  },
  {
    id:    'Hızlı Kilo Vermek',
    label: 'Hızlı Kilo Vermek',
    desc:  'TDEE − 500 kcal · Karb %35 · Protein %35 · Yağ %30',
    badge: '−500',
  },
  {
    id:    'Dengeli Kilo Almak',
    label: 'Dengeli Kilo Almak',
    desc:  'TDEE + 300 kcal · Karb %45 · Protein %25 · Yağ %30',
    badge: '+300',
  },
  {
    id:    'Hızlı Kilo Almak',
    label: 'Hızlı Kilo Almak',
    desc:  'TDEE + 500 kcal · Karb %50 · Protein %20 · Yağ %30',
    badge: '+500',
  },
  {
    id:    'Dengeli Kas Kazanmak',
    label: 'Dengeli Kas Kazanmak',
    desc:  'TDEE + 200 kcal · Karb %45 · Protein %30 · Yağ %25',
    badge: '+200',
  },
  {
    id:    'Hızlı Kas Kazanmak',
    label: 'Hızlı Kas Kazanmak',
    desc:  'TDEE + 400 kcal · Karb %50 · Protein %25 · Yağ %25',
    badge: '+400',
  },
]

export const VALID_GOAL_IDS = new Set(GOAL_OPTIONS.map(({ id }) => id))

export const GOAL_LABELS = {
  ...Object.fromEntries(GOAL_OPTIONS.map(({ id, label }) => [id, label])),
  // legacy slug ids → display labels
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

/** Default goal when none is set. */
export const DEFAULT_GOAL = 'Sağlıklı Beslenmek'
