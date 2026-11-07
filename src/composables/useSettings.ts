import { reactive } from 'vue'

export const SETTINGS_KEY = 'tetris-settings'

export const ACTIONS = [
  { id: 'left', label: 'izquierda' },
  { id: 'right', label: 'derecha' },
  { id: 'down', label: 'bajar' },
  { id: 'rotate', label: 'rotar' },
  { id: 'rotateAlt', label: 'rotar (alt.)' },
  { id: 'hardDrop', label: 'caída' },
  { id: 'hold', label: 'hold' },
  { id: 'skills', label: 'habilidades' },
] as const

export type GameAction = (typeof ACTIONS)[number]['id']
export type KeyMap = Record<GameAction, string>

export interface Settings {
  das: number
  arr: number
  /** Tecla física (KeyboardEvent.code) de cada acción. */
  keys: KeyMap
  /** Jugar contra el fantasma guardado del modo; se lee al empezar cada partida. */
  versusGhost: boolean
}

export type TimingName = 'das' | 'arr'

/** ARR nunca llega a 0: KeyRepeat haría un bucle infinito. */
export const TIMING_LIMITS: Record<TimingName, { min: number; max: number; step: number }> = {
  das: { min: 50, max: 300, step: 10 },
  arr: { min: 10, max: 150, step: 5 },
}

export function defaultSettings(): Settings {
  return {
    das: 170,
    arr: 50,
    keys: {
      left: 'ArrowLeft',
      right: 'ArrowRight',
      down: 'ArrowDown',
      rotate: 'ArrowUp',
      rotateAlt: 'KeyX',
      hardDrop: 'Space',
      hold: 'KeyC',
      skills: 'KeyE',
    },
    versusGhost: true,
  }
}

const KEY_LABELS: Record<string, string> = {
  ArrowLeft: '←',
  ArrowRight: '→',
  ArrowUp: '↑',
  ArrowDown: '↓',
}

/** Texto de una tecla para mostrarla en la interfaz. */
export function keyLabel(code: string): string {
  return KEY_LABELS[code] ?? code.replace(/^Key/, '')
}

/** Motivo por el que una tecla no se puede asignar a ninguna acción (null si se puede). */
export function forbiddenReason(code: string): string | null {
  if (code.startsWith('Shift'))
    return 'Shift no se puede asignar: cinco pulsaciones abren las Teclas especiales de Windows'
  if (code.startsWith('Alt') || code.startsWith('Meta') || code.startsWith('OS'))
    return `${code} no se puede asignar: el sistema le quita el foco al juego`
  if (code === 'KeyR') return 'R está reservada: cambia la skin'
  if (code === 'KeyM') return 'M está reservada: sonido'
  if (code === 'KeyP' || code === 'Escape') return `${keyLabel(code)} está reservada: pausa`
  if (/^(Digit|Numpad)\d$/.test(code)) return 'Los números están reservados: eligen en los menús'
  return null
}

/** Motivo para rechazar `code` en `action` (reservada o ya asignada); null si se acepta. */
export function rejectKey(keys: KeyMap, action: GameAction, code: string): string | null {
  const other = ACTIONS.find((a) => a.id !== action && keys[a.id] === code)
  return (
    forbiddenReason(code) ??
    (other ? `${keyLabel(code)} ya está asignada a «${other.label}»` : null)
  )
}

export function actionForKey(keys: KeyMap, code: string): GameAction | undefined {
  return ACTIONS.find((a) => keys[a.id] === code)?.id
}

function clampTiming(name: TimingName, value: number): number {
  const { min, max } = TIMING_LIMITS[name]
  return Math.min(max, Math.max(min, value))
}

function validTiming(name: TimingName, value: unknown): number {
  return Number.isFinite(value) ? clampTiming(name, value as number) : defaultSettings()[name]
}

/** Todo o nada: rellenar solo la tecla inválida con su valor por defecto podría duplicar otra. */
function validKeys(keys: unknown): keys is KeyMap {
  if (typeof keys !== 'object' || keys === null) return false
  const codes = ACTIONS.map((a) => (keys as Record<string, unknown>)[a.id])
  return (
    new Set(codes).size === codes.length &&
    codes.every((c) => typeof c === 'string' && c !== '' && !forbiddenReason(c))
  )
}

/** Interpreta lo guardado; cualquier dato inválido vuelve a su valor por defecto. */
export function parseSettings(raw: string | null): Settings {
  let data: Partial<Settings> | null
  try {
    data = JSON.parse(raw ?? 'null') as Partial<Settings> | null
  } catch {
    return defaultSettings()
  }
  return {
    das: validTiming('das', data?.das),
    arr: validTiming('arr', data?.arr),
    keys: validKeys(data?.keys) ? data.keys : defaultSettings().keys,
    versusGhost:
      typeof data?.versusGhost === 'boolean' ? data.versusGhost : defaultSettings().versusGhost,
  }
}

export function loadSettings(): Settings {
  try {
    return parseSettings(localStorage.getItem(SETTINGS_KEY))
  } catch {
    return defaultSettings() // almacenamiento bloqueado (modo privado, permisos...)
  }
}

export interface SettingsContext {
  /** Valores actuales; reactivos para que la interfaz muestre las teclas configuradas. */
  values: Settings
  setTiming: (name: TimingName, value: number) => void
  /** Asigna la tecla y guarda; si se rechaza no cambia nada y devuelve el motivo. */
  assignKey: (action: GameAction, code: string) => string | null
  setVersusGhost: (on: boolean) => void
  restoreDefaults: () => void
}

/** Ajustes de control guardados en localStorage. Lo instancia useGame() una sola vez. */
export function useSettings(): SettingsContext {
  const values = reactive(loadSettings())

  function persist(): void {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(values))
    } catch {
      // sin almacenamiento los ajustes solo duran esta sesión
    }
  }

  function setTiming(name: TimingName, value: number): void {
    values[name] = clampTiming(name, value)
    persist()
  }

  function assignKey(action: GameAction, code: string): string | null {
    const reason = rejectKey(values.keys, action, code)
    if (reason) return reason
    values.keys[action] = code
    persist()
    return null
  }

  function setVersusGhost(on: boolean): void {
    values.versusGhost = on
    persist()
  }

  function restoreDefaults(): void {
    Object.assign(values, defaultSettings())
    persist()
  }

  return { values, setTiming, assignKey, setVersusGhost, restoreDefaults }
}
