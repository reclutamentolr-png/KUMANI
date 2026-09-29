// KUMANI Focus: impostazioni e statistiche di oggi salvate solo nel browser
// (localStorage). Niente va al database: ogni accesso è protetto da
// try/catch perché lo storage può mancare (navigazione privata, blocchi).

export type PresetId = 'classic' | 'long' | 'short' | 'custom'
export type Durations = { focus: number; short: number; long: number }

export type FocusSettings = {
  preset: PresetId
  custom: Durations
  sound: boolean
  vibration: boolean
  keepAwake: boolean
  notify: boolean
}

export const PRESETS: Record<Exclude<PresetId, 'custom'>, Durations> = {
  classic: { focus: 25, short: 5, long: 15 },
  long: { focus: 50, short: 10, long: 15 },
  short: { focus: 15, short: 3, long: 15 },
}

export const LIMITS: Record<keyof Durations, { min: number; max: number; step: number }> = {
  focus: { min: 5, max: 90, step: 5 },
  short: { min: 1, max: 30, step: 1 },
  long: { min: 5, max: 45, step: 5 },
}

export const SESSIONS_PER_CYCLE = 4

export const DEFAULT_SETTINGS: FocusSettings = {
  preset: 'classic',
  custom: { ...PRESETS.classic },
  sound: true,
  vibration: true,
  keepAwake: true,
  notify: false,
}

const SETTINGS_KEY = 'kumani-focus-settings'
const STATS_PREFIX = 'kumani-focus-stats-'

export function clamp(value: number, key: keyof Durations): number {
  const { min, max } = LIMITS[key]
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, Math.round(value)))
}

export function durationsFor(settings: FocusSettings): Durations {
  if (settings.preset === 'custom') {
    return {
      focus: clamp(settings.custom.focus, 'focus'),
      short: clamp(settings.custom.short, 'short'),
      long: clamp(settings.custom.long, 'long'),
    }
  }
  return PRESETS[settings.preset]
}

export function loadSettings(): FocusSettings {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const saved = JSON.parse(raw) as Partial<FocusSettings>
    const preset: PresetId = saved.preset && ['classic', 'long', 'short', 'custom'].includes(saved.preset) ? saved.preset : 'classic'
    const custom = saved.custom ?? DEFAULT_SETTINGS.custom
    return {
      preset,
      custom: {
        focus: clamp(Number(custom.focus), 'focus'),
        short: clamp(Number(custom.short), 'short'),
        long: clamp(Number(custom.long), 'long'),
      },
      sound: saved.sound !== false,
      vibration: saved.vibration !== false,
      keepAwake: saved.keepAwake !== false,
      notify: saved.notify === true,
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(settings: FocusSettings) {
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // storage non disponibile: le impostazioni valgono solo per questa visita
  }
}

export type TodayStats = { sessions: number; minutes: number }

// Chiave per data locale: un nuovo giorno parte da zero da solo
function todayKey(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${STATS_PREFIX}${now.getFullYear()}-${month}-${day}`
}

export function loadTodayStats(): TodayStats {
  try {
    const raw = window.localStorage.getItem(todayKey())
    if (!raw) return { sessions: 0, minutes: 0 }
    const saved = JSON.parse(raw) as Partial<TodayStats>
    return {
      sessions: Math.max(0, Math.floor(Number(saved.sessions) || 0)),
      minutes: Math.max(0, Math.floor(Number(saved.minutes) || 0)),
    }
  } catch {
    return { sessions: 0, minutes: 0 }
  }
}

export function addFocusSession(minutes: number): TodayStats {
  const current = loadTodayStats()
  const next = { sessions: current.sessions + 1, minutes: current.minutes + minutes }
  try {
    const key = todayKey()
    window.localStorage.setItem(key, JSON.stringify(next))
    // Pulizia dei giorni passati
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const other = window.localStorage.key(i)
      if (other && other.startsWith(STATS_PREFIX) && other !== key) window.localStorage.removeItem(other)
    }
  } catch {
    // storage non disponibile: il conteggio resta solo in pagina
  }
  return next
}
