import { FIXED, GARBAGE_INTERVAL_MS } from './constants'
import type { Game } from './game'

export type GameMode = 'marathon' | 'sprint' | 'garbage' | 'fixed' | 'invisible' | 'reverse'

export interface ModeInfo {
  id: GameMode
  name: string
  description: string
}

/**
 * Un desafío: objetivo, progreso para el panel y reglas propias. El motor llama a `setup`
 * en reset(), a `tick` en cada update() y comprueba `isWon` / `lossReason` tras cada
 * update y cada fijado.
 */
export interface Challenge extends ModeInfo {
  setup?(game: Game): void
  tick?(game: Game, dt: number): void
  /** Texto de progreso del objetivo para el panel. */
  progress(game: Game): string
  isWon(game: Game): boolean
  /** Motivo de derrota propio del desafío (además de llenar el tablero), o null. */
  lossReason?(game: Game): string | null
}

export const SPRINT_LINES = 40
export const SPRINT_MS = 120_000
export const SURVIVE_MS = 180_000
export const INVISIBLE_LINES = 20
export const FIXED_ROWS = 8
export const REVERSE_FROM_LEVEL = 3
export const REVERSE_GOAL_LEVEL = 5

/** Milisegundos a m:ss. */
export function formatTime(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

const countFixed = (game: Game) => game.board.flat().filter((v) => v === FIXED).length

export const CHALLENGES: Readonly<Record<Exclude<GameMode, 'marathon'>, Challenge>> = {
  sprint: {
    id: 'sprint',
    name: 'Sprint',
    description: `Limpia ${SPRINT_LINES} líneas en ${formatTime(SPRINT_MS)}`,
    progress: (g) =>
      `${Math.min(g.lines, SPRINT_LINES)}/${SPRINT_LINES} líneas · ${formatTime(SPRINT_MS - g.elapsedMs)}`,
    isWon: (g) => g.lines >= SPRINT_LINES,
    lossReason: (g) => (g.elapsedMs >= SPRINT_MS ? 'Se acabó el tiempo' : null),
  },
  garbage: {
    id: 'garbage',
    name: 'Basura',
    description: `Sobrevive ${formatTime(SURVIVE_MS)}: cada ${GARBAGE_INTERVAL_MS / 1000} s sube una fila de basura`,
    tick: (g, dt) => {
      g.challengeMs += dt
      while (g.challengeMs >= GARBAGE_INTERVAL_MS && !g.gameOver) {
        g.challengeMs -= GARBAGE_INTERVAL_MS
        g.addGarbageRow()
      }
    },
    progress: (g) =>
      `${formatTime(g.elapsedMs)} / ${formatTime(SURVIVE_MS)} · basura en ${Math.ceil(
        (GARBAGE_INTERVAL_MS - g.challengeMs) / 1000,
      )} s`,
    isWon: (g) => g.elapsedMs >= SURVIVE_MS,
  },
  fixed: {
    id: 'fixed',
    name: 'Bloques fijos',
    description: 'Elimina todos los bloques fijos (◆) del tablero',
    setup: (g) => g.placeFixedBlocks(FIXED_ROWS),
    progress: (g) => {
      const n = countFixed(g)
      return `${n} ${n === 1 ? 'bloque fijo' : 'bloques fijos'}`
    },
    isWon: (g) => countFixed(g) === 0,
  },
  invisible: {
    id: 'invisible',
    name: 'Invisible',
    description: `Limpia ${INVISIBLE_LINES} líneas: las piezas desaparecen al tocar suelo`,
    progress: (g) => `${Math.min(g.lines, INVISIBLE_LINES)}/${INVISIBLE_LINES} líneas`,
    isWon: (g) => g.lines >= INVISIBLE_LINES,
  },
  reverse: {
    id: 'reverse',
    name: 'Rotación inversa',
    description: `Llega al nivel ${REVERSE_GOAL_LEVEL}: desde el nivel ${REVERSE_FROM_LEVEL} se rota al revés`,
    progress: (g) =>
      `Nivel ${g.level}/${REVERSE_GOAL_LEVEL} · ${
        g.rotationReversed ? '↺ inversa' : `inversa en nivel ${REVERSE_FROM_LEVEL}`
      }`,
    isWon: (g) => g.level >= REVERSE_GOAL_LEVEL,
  },
}

/** Modos para el menú, en orden: Maratón y los desafíos. */
export const MODES: readonly ModeInfo[] = [
  { id: 'marathon', name: 'Maratón', description: 'El modo clásico: aguanta todo lo que puedas' },
  ...Object.values(CHALLENGES).map(({ id, name, description }) => ({ id, name, description })),
]

export function challengeFor(mode: GameMode): Challenge | undefined {
  return mode === 'marathon' ? undefined : CHALLENGES[mode]
}
