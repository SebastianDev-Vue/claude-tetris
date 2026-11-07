// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { Game, type GameEvent } from '@/engine/game'
import { linesPerMinute, useRunStats } from '@/composables/useRunStats'

const lock: GameEvent = { type: 'lock', cells: [], color: '#fff', vanish: false }
const undo: GameEvent = { type: 'skill', id: 'undo', ok: true }

function clear(lines: number, points: number, extra: Partial<GameEvent> = {}): GameEvent {
  return {
    type: 'clear',
    rows: [],
    lines,
    points,
    combo: 1,
    tspin: false,
    b2b: false,
    perfect: false,
    ...extra,
  } as GameEvent
}

function setup() {
  const game = { score: 0, level: 1, elapsedMs: 0, maxCombo: 0 }
  const run = useRunStats(() => game)
  run.reset()
  return { game, run }
}

describe('useRunStats', () => {
  it('cuenta Tetris, T-spins, combo, perfect clears y piezas', () => {
    const { game, run } = setup()
    run.handle(lock)
    game.maxCombo = 12 // el motor no pone tope a maxCombo; el evento sí (x10)
    run.handle(clear(4, 800, { combo: 10 } as Partial<GameEvent>))
    run.handle(lock)
    run.handle(clear(2, 1200, { tspin: true } as Partial<GameEvent>))
    run.handle(lock)
    run.handle(clear(1, 3100, { perfect: true } as Partial<GameEvent>))
    const s = run.stats.value
    expect([s.tetrises, s.tspins, s.perfects, s.pieces, s.lines]).toEqual([1, 1, 1, 3, 7])
    expect(s.bestCombo).toBe(12)
  })

  it('un T-spin de 4 líneas no cuenta como Tetris y un T-spin sin líneas sí cuenta', () => {
    const { run } = setup()
    run.handle(clear(4, 100, { tspin: true } as Partial<GameEvent>))
    run.handle(clear(0, 400, { tspin: true } as Partial<GameEvent>))
    expect([run.stats.value.tetrises, run.stats.value.tspins]).toEqual([0, 2])
  })

  it('guarda la jugada con más puntos, con su nombre', () => {
    const { run } = setup()
    run.handle(clear(1, 100))
    run.handle(clear(4, 4800, { b2b: true } as Partial<GameEvent>))
    run.handle(clear(2, 300, { tspin: true } as Partial<GameEvent>))
    expect(run.stats.value.bestPlay).toEqual({ label: 'Tetris B2B', points: 4800 })
    run.handle(clear(2, 6000, { tspin: true, combo: 3, perfect: true } as Partial<GameEvent>))
    expect(run.stats.value.bestPlay?.label).toBe('T-spin doble · combo x3 · perfect clear')
  })

  it('toma muestras con elapsedMs y una final al terminar', () => {
    const { game, run } = setup()
    game.elapsedMs = 1000
    game.score = 20
    run.handle(lock)
    game.elapsedMs = 2500
    game.score = 90 // bono de comodines posterior al clear
    run.handle({ type: 'finish', won: false })
    expect(run.stats.value.samples).toEqual([
      { ms: 0, score: 0 },
      { ms: 1000, score: 20 },
      { ms: 2500, score: 90 },
    ])
  })

  it('marca la subida de nivel en el instante del fijado que la provocó', () => {
    const { game, run } = setup()
    game.elapsedMs = 5000
    run.handle(lock)
    run.handle(clear(4, 800)) // el motor aún no ha subido el nivel al emitir clear
    game.level = 2
    game.elapsedMs = 6000
    run.handle(lock)
    expect(run.stats.value.levelUps).toEqual([{ ms: 5000, level: 2 }])
  })

  it('no marca como subida el nivel inicial', () => {
    const game = { score: 0, level: 7, elapsedMs: 0, maxCombo: 0 }
    const run = useRunStats(() => game)
    run.reset()
    run.handle(lock)
    expect(run.stats.value.levelUps).toEqual([])
  })

  it('Deshacer vuelve al estado anterior al último fijado', () => {
    const { game, run } = setup()
    run.handle(lock)
    run.handle(clear(1, 100))
    const before = run.stats.value
    game.maxCombo = 2
    game.elapsedMs = 3000
    run.handle(lock)
    run.handle(clear(4, 4800, { b2b: true } as Partial<GameEvent>))
    run.handle(undo)
    expect(run.stats.value).toEqual(before)
  })

  it('Deshacer fallido, de otra habilidad o repetido no cambia nada', () => {
    const { run } = setup()
    run.handle(lock)
    run.handle(lock)
    const after = run.stats.value
    run.handle({ type: 'skill', id: 'undo', ok: false })
    run.handle({ type: 'skill', id: 'peek', ok: true })
    expect(run.stats.value).toBe(after)
    run.handle(undo)
    expect(run.stats.value.pieces).toBe(1)
    run.handle(undo) // el motor solo guarda un nivel
    expect(run.stats.value.pieces).toBe(1)
  })

  it('tras Deshacer vuelve a detectar la subida de nivel una sola vez', () => {
    const { game, run } = setup()
    run.handle(lock)
    run.handle(clear(4, 800))
    game.level = 2
    run.handle(lock) // detecta la subida
    run.handle(undo) // quita ese fijado, pero el nivel 2 sigue
    run.handle(lock)
    expect(run.stats.value.levelUps).toHaveLength(1)
  })

  it('reset vacía todo, incluido lo que Deshacer podría recuperar', () => {
    const { game, run } = setup()
    run.handle(lock)
    run.handle(clear(4, 800))
    game.score = 0
    game.elapsedMs = 0
    run.reset()
    expect(run.stats.value).toMatchObject({ pieces: 0, tetrises: 0, lines: 0, bestPlay: null })
    expect(run.stats.value.samples).toEqual([{ ms: 0, score: 0 }])
    run.handle(undo)
    expect(run.stats.value.samples).toHaveLength(1)
  })

  it('linesPerMinute no divide por cero', () => {
    const { game, run } = setup()
    run.handle(clear(1, 100)) // en el instante 0
    expect(linesPerMinute(run.stats.value)).toBe(0)
    game.elapsedMs = 30_000
    run.handle({ type: 'finish', won: false })
    expect(linesPerMinute(run.stats.value)).toBe(2)
  })

  it('con el motor real, Deshacer devuelve las estadísticas del último fijado', () => {
    let run!: ReturnType<typeof useRunStats>
    const game = new Game({ random: () => 0, onEvent: (e) => run?.handle(e) })
    run = useRunStats(() => game)
    game.reset('marathon')
    run.reset()
    game.hardDrop()
    const before = run.stats.value
    game.hardDrop()
    expect(run.stats.value.pieces).toBe(2)
    game.energy = 100
    expect(game.useSkill('undo')).toBe(true)
    expect(run.stats.value).toEqual(before)
    expect(run.stats.value.samples[run.stats.value.samples.length - 1]?.score).toBe(game.score)
  })
})
