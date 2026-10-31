// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { Game, createBoard, type GameEvent } from '@/engine/game'
import { COLS, FIXED, GARBAGE, GARBAGE_INTERVAL_MS, ROWS, SINGLE } from '@/engine/constants'
import {
  FIXED_ROWS,
  INVISIBLE_LINES,
  MODES,
  REVERSE_FROM_LEVEL,
  REVERSE_GOAL_LEVEL,
  SPRINT_LINES,
  SPRINT_MS,
  SURVIVE_MS,
  formatTime,
  type GameMode,
} from '@/engine/challenges'

/** Partida en un modo, solo piezas estándar (random fijo) y registro de eventos. */
function setup(mode: GameMode) {
  const events: GameEvent[] = []
  const g = new Game({ random: () => 0.5, onEvent: (e) => events.push(e) })
  g.reset(mode)
  return { g, events }
}

const fullRowExcept = (gap: number, value = 1) =>
  Array.from({ length: COLS }, (_, c) => (c === gap ? 0 : value))

/** Limpia una línea colocando un single en el hueco de la última fila. */
function clearOneLine(g: Game): void {
  g.board[ROWS - 1] = fullRowExcept(9)
  g.setCell(ROWS - 2, 0, 5) // resto, para que no sea perfect clear
  g.current = g.makePiece(SINGLE)
  g.current.x = 9
  g.current.y = ROWS - 1
  g.lockPiece()
}

describe('modos', () => {
  it('hay Maratón y 5 desafíos', () => {
    expect(MODES.map((m) => m.id)).toEqual([
      'marathon',
      'sprint',
      'garbage',
      'fixed',
      'invisible',
      'reverse',
    ])
  })

  it('reset(mode) cambia de modo y reset() repite el actual', () => {
    const { g } = setup('sprint')
    expect(g.mode).toBe('sprint')
    g.reset()
    expect(g.mode).toBe('sprint')
    expect(g.challenge?.name).toBe('Sprint')
    g.reset('marathon')
    expect(g.challenge).toBeUndefined()
  })

  it('el tiempo de juego no avanza en pausa', () => {
    const { g } = setup('marathon')
    g.update(1000)
    g.togglePause()
    g.update(5000)
    expect(g.elapsedMs).toBe(1000)
  })

  it('en Maratón llenar el tablero termina la partida como derrota', () => {
    const { g, events } = setup('marathon')
    for (let r = 0; r < ROWS; r++) g.board[r] = fullRowExcept(0, 5)
    g.board[0] = Array.from({ length: COLS }, () => 5)
    g.hardDrop()
    expect(g.gameOver).toBe(true)
    expect(g.result).toBe('lost')
    expect(events).toContainEqual({ type: 'finish', won: false })
  })

  it('formatTime da m:ss', () => {
    expect(formatTime(0)).toBe('0:00')
    expect(formatTime(65_000)).toBe('1:05')
    expect(formatTime(119_001)).toBe('2:00')
  })
})

describe('Sprint', () => {
  it(`gana al llegar a ${SPRINT_LINES} líneas`, () => {
    const { g, events } = setup('sprint')
    g.lines = SPRINT_LINES - 1
    clearOneLine(g)
    expect(g.result).toBe('won')
    expect(events).toContainEqual({ type: 'finish', won: true })
  })

  it('pierde cuando se acaba el tiempo', () => {
    const { g } = setup('sprint')
    g.update(SPRINT_MS)
    expect(g.result).toBe('lost')
    expect(g.endReason).toBe('Se acabó el tiempo')
  })

  it('el progreso muestra líneas y tiempo restante', () => {
    const { g } = setup('sprint')
    g.update(30_000)
    expect(g.challenge?.progress(g)).toBe(`0/${SPRINT_LINES} líneas · 1:30`)
  })
})

describe('Basura', () => {
  it('cada 10 s sube una fila de basura con un hueco', () => {
    const { g, events } = setup('garbage')
    g.update(GARBAGE_INTERVAL_MS - 1)
    expect(g.board[ROWS - 1]?.some(Boolean)).toBe(false)
    g.update(1)
    const bottom = g.board[ROWS - 1] ?? []
    expect(bottom.filter((v) => v === GARBAGE)).toHaveLength(COLS - 1)
    expect(bottom.filter((v) => v === 0)).toHaveLength(1)
    expect(events).toContainEqual({ type: 'garbage' })
  })

  it('la basura empuja hacia arriba el contenido del tablero', () => {
    const { g } = setup('garbage')
    g.setCell(ROWS - 1, 0, 5)
    g.addGarbageRow()
    expect(g.cell(ROWS - 2, 0)).toBe(5)
  })

  it('pierde si la basura empuja bloques fuera por arriba', () => {
    const { g } = setup('garbage')
    g.setCell(0, 0, 5)
    g.addGarbageRow()
    expect(g.result).toBe('lost')
    expect(g.endReason).toBe('La basura llegó arriba')
  })

  it(`gana al sobrevivir ${formatTime(SURVIVE_MS)}`, () => {
    const { g } = setup('garbage')
    g.board = createBoard()
    // avanzar en pasos sin que la basura llene el tablero: se vacía antes de cada paso
    for (let t = 0; t < SURVIVE_MS; t += GARBAGE_INTERVAL_MS) {
      g.board = createBoard()
      g.current = g.makePiece(1)
      g.update(GARBAGE_INTERVAL_MS)
    }
    expect(g.result).toBe('won')
  })
})

describe('Bloques fijos', () => {
  it(`el tablero empieza con bloques fijos en las ${FIXED_ROWS} filas inferiores`, () => {
    const { g } = setup('fixed')
    for (let r = 0; r < ROWS - FIXED_ROWS; r++) expect(g.board[r]?.some(Boolean)).toBe(false)
    for (let r = ROWS - FIXED_ROWS; r < ROWS; r++) {
      const row = g.board[r] ?? []
      expect(row.every((v) => v === 0 || v === FIXED)).toBe(true)
      expect(row.filter((v) => v === 0).length).toBeGreaterThanOrEqual(2)
    }
  })

  it('gana al no quedar ningún bloque fijo', () => {
    const { g } = setup('fixed')
    g.board = createBoard()
    g.setCell(ROWS - 1, 0, 5)
    g.hardDrop()
    expect(g.result).toBe('won')
  })
})

describe('Invisible', () => {
  it('oculta los bloques fijados solo mientras dura la partida', () => {
    const { g, events } = setup('invisible')
    expect(g.hideLocked).toBe(true)
    g.hardDrop()
    expect(events).toContainEqual(expect.objectContaining({ type: 'lock', vanish: true }))
    g.lines = INVISIBLE_LINES - 1
    clearOneLine(g)
    expect(g.result).toBe('won')
    expect(g.hideLocked).toBe(false)
  })

  it('en otros modos las piezas no se desvanecen', () => {
    const { g, events } = setup('marathon')
    g.hardDrop()
    expect(events).toContainEqual(expect.objectContaining({ type: 'lock', vanish: false }))
    expect(g.hideLocked).toBe(false)
  })
})

describe('Rotación inversa', () => {
  const T = [
    [0, 3, 0],
    [3, 3, 3],
    [0, 0, 0],
  ]

  it(`rota en sentido horario antes del nivel ${REVERSE_FROM_LEVEL} y antihorario después`, () => {
    const { g, events } = setup('reverse')
    g.current = { type: 3, shape: T.map((r) => [...r]), x: 3, y: 5 }
    g.rotate()
    expect(g.current.shape).toEqual([
      [0, 3, 0],
      [0, 3, 3],
      [0, 3, 0],
    ]) // horario: la punta mira a la derecha

    g.lines = (REVERSE_FROM_LEVEL - 1) * 10 - 1
    g.level = REVERSE_FROM_LEVEL - 1
    clearOneLine(g)
    expect(g.rotationReversed).toBe(true)
    expect(events).toContainEqual(expect.objectContaining({ text: '¡ROTACIÓN INVERSA!' }))

    g.current = { type: 3, shape: T.map((r) => [...r]), x: 3, y: 5 }
    g.rotate()
    expect(g.current.shape).toEqual([
      [0, 3, 0],
      [3, 3, 0],
      [0, 3, 0],
    ]) // antihorario: la punta mira a la izquierda
  })

  it(`gana al llegar al nivel ${REVERSE_GOAL_LEVEL}`, () => {
    const { g } = setup('reverse')
    g.lines = (REVERSE_GOAL_LEVEL - 1) * 10 - 1
    g.level = REVERSE_GOAL_LEVEL - 1
    clearOneLine(g)
    expect(g.result).toBe('won')
  })

  it('la rotación inversa solo existe en su desafío', () => {
    const { g } = setup('marathon')
    g.level = 9
    expect(g.rotationReversed).toBe(false)
  })
})
