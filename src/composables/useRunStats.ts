import { shallowRef, type ShallowRef } from 'vue'
import type { Game, GameEvent } from '../engine/game'

export interface ScoreSample {
  ms: number
  score: number
}

export interface LevelUp {
  ms: number
  level: number
}

export interface BestPlay {
  label: string
  points: number
}

export interface RunStats {
  tetrises: number
  tspins: number
  bestCombo: number
  perfects: number
  pieces: number
  lines: number
  bestPlay: BestPlay | null
  level: number
  samples: ScoreSample[]
  levelUps: LevelUp[]
}

const EMPTY: RunStats = {
  tetrises: 0,
  tspins: 0,
  bestCombo: 0,
  perfects: 0,
  pieces: 0,
  lines: 0,
  bestPlay: null,
  level: 0,
  samples: [],
  levelUps: [],
}

const LINE_NAMES = ['', 'Simple', 'Doble', 'Triple']

type ClearEvent = Extract<GameEvent, { type: 'clear' }>

function playLabel(e: ClearEvent): string {
  const name = e.tspin
    ? `T-spin ${LINE_NAMES[e.lines]?.toLowerCase() ?? ''}`.trim()
    : (LINE_NAMES[e.lines] ?? 'Tetris')
  const extras = [e.combo >= 2 && `combo x${e.combo}`, e.perfect && 'perfect clear']
  return [e.b2b ? `${name} B2B` : name, ...extras.filter(Boolean)].join(' · ')
}

/** Líneas por minuto de la partida (0 si aún no ha pasado tiempo). */
export function linesPerMinute(stats: RunStats): number {
  const ms = stats.samples[stats.samples.length - 1]?.ms ?? 0
  return ms > 0 ? (stats.lines * 60_000) / ms : 0
}

export interface RunStatsTracker {
  stats: ShallowRef<RunStats>
  handle: (event: GameEvent) => void
  reset: () => void
}

/**
 * Acumula el informe de partida a partir de los eventos del motor, sin tocarlo.
 * Cada estado es inmutable: Deshacer solo tiene que recuperar el objeto anterior al último fijado.
 * El motor emite `clear` antes de subir de nivel, así que la subida se detecta en la muestra
 * siguiente y se marca en el instante de la anterior, que es la del fijado que la provocó.
 */
export function useRunStats(
  source: () => Pick<Game, 'score' | 'level' | 'elapsedMs' | 'maxCombo'>,
): RunStatsTracker {
  const stats = shallowRef(EMPTY)
  let beforeLock: RunStats | null = null

  function withSample(s: RunStats): RunStats {
    const { score, level, elapsedMs } = source()
    const last = s.samples[s.samples.length - 1]
    return {
      ...s,
      level,
      samples: [...s.samples, { ms: elapsedMs, score }],
      levelUps: last && level > s.level ? [...s.levelUps, { ms: last.ms, level }] : s.levelUps,
    }
  }

  function withClear(s: RunStats, e: ClearEvent): RunStats {
    const isBest = e.points > 0 && e.points > (s.bestPlay?.points ?? 0)
    return {
      ...s,
      tetrises: s.tetrises + (!e.tspin && e.lines >= 4 ? 1 : 0),
      tspins: s.tspins + (e.tspin ? 1 : 0),
      // game.maxCombo y no e.combo: el del evento tiene el tope del multiplicador (x10)
      bestCombo: source().maxCombo,
      perfects: s.perfects + (e.perfect ? 1 : 0),
      lines: s.lines + e.lines,
      bestPlay: isBest ? { label: playLabel(e), points: e.points } : s.bestPlay,
    }
  }

  function handle(e: GameEvent): void {
    if (e.type === 'lock') {
      beforeLock = stats.value
      stats.value = withSample({ ...stats.value, pieces: stats.value.pieces + 1 })
    } else if (e.type === 'clear') {
      stats.value = withSample(withClear(stats.value, e))
    } else if (e.type === 'finish') {
      stats.value = withSample(stats.value)
    } else if (e.type === 'skill' && e.id === 'undo' && e.ok && beforeLock) {
      stats.value = beforeLock
      beforeLock = null
    }
  }

  /** Llamar después de game.reset(): la primera muestra sale del estado inicial del motor. */
  function reset(): void {
    beforeLock = null
    stats.value = withSample(EMPTY)
  }

  return { stats, handle, reset }
}
