import { MODES, type GameMode } from '../engine/challenges'
import { REPLAY_VERSION, type RecordedAction, type Replay } from '../engine/replay'
import { SKILLS } from '../engine/skills'

export const GHOSTS_KEY = 'tetris-ghosts'

const ACTIONS: ReadonlySet<string> = new Set([
  'moveLeft',
  'moveRight',
  'softDrop',
  'rotate',
  'hardDrop',
  'holdPiece',
  ...SKILLS.map((s) => `useSkill:${s.id}`),
])

function validActions(actions: unknown): actions is RecordedAction[] {
  if (!Array.isArray(actions)) return false
  let prev = 0
  for (const entry of actions) {
    if (!Array.isArray(entry) || entry.length !== 2) return false
    const [step, action] = entry as [unknown, unknown]
    if (!Number.isInteger(step) || (step as number) < prev) return false
    if (typeof action !== 'string' || !ACTIONS.has(action)) return false
    prev = step as number
  }
  return true
}

function isReplay(data: unknown, mode: GameMode): data is Replay {
  if (typeof data !== 'object' || data === null) return false
  const r = data as Replay
  return (
    r.version === REPLAY_VERSION &&
    r.mode === mode &&
    Number.isInteger(r.seed) &&
    Number.isInteger(r.startLevel) &&
    r.startLevel >= 1 &&
    r.startLevel <= 10 &&
    Number.isFinite(r.score) &&
    r.score >= 0 &&
    validActions(r.actions)
  )
}

/** Lee las grabaciones válidas; lo corrupto o de otra versión se descarta sin afectar al resto. */
export function loadAll(): Partial<Record<GameMode, Replay>> {
  const ghosts: Partial<Record<GameMode, Replay>> = {}
  try {
    const data: unknown = JSON.parse(localStorage.getItem(GHOSTS_KEY) ?? '{}')
    if (typeof data !== 'object' || data === null) return ghosts
    for (const { id } of MODES) {
      const entry = (data as Record<string, unknown>)[id]
      if (isReplay(entry, id)) ghosts[id] = entry
    }
  } catch {
    // JSON inválido o sin localStorage: como si no hubiera fantasmas
  }
  return ghosts
}

/** Mejor partida guardada de ese modo, o null. */
export function loadGhost(mode: GameMode): Replay | null {
  return loadAll()[mode] ?? null
}

/** Guarda la partida si tiene puntos y supera a la de su modo. Devuelve si se guardó. */
export function saveGhost(replay: Replay): boolean {
  const ghosts = loadAll()
  if (replay.score <= 0 || replay.score <= (ghosts[replay.mode]?.score ?? 0)) return false
  try {
    ghosts[replay.mode] = replay
    localStorage.setItem(GHOSTS_KEY, JSON.stringify(ghosts))
    return true
  } catch {
    return false // sin almacenamiento o cuota llena: la partida sigue y queda el fantasma anterior
  }
}

export interface GhostDiffLabel {
  text: string
  note: string
  trend: 'ahead' | 'behind' | 'tied'
}

/** Diferencia con el fantasma, con signo y flecha para no depender solo del color. */
export function ghostDiffLabel(diff: number): GhostDiffLabel {
  if (diff === 0) return { text: '=', note: 'igual que el fantasma', trend: 'tied' }
  const value = Math.abs(diff).toLocaleString()
  return diff > 0
    ? { text: `+${value} ▲`, note: 'sobre el fantasma', trend: 'ahead' }
    : { text: `−${value} ▼`, note: 'bajo el fantasma', trend: 'behind' }
}
