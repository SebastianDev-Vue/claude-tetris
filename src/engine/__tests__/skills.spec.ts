// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { Game, type GameEvent } from '@/engine/game'
import { COLS, ROWS, SINGLE, STANDARD_COUNT, isPowerUp } from '@/engine/constants'
import {
  ENERGY_BONUS,
  ENERGY_PER_LINE,
  MAX_ENERGY,
  PEEK_PIECES,
  QUEUE_SIZE,
  SLOW_FACTOR,
  SLOW_MS,
} from '@/engine/skills'

function newGame(events: GameEvent[] = []) {
  return new Game({ random: () => 0.5, onEvent: (e) => events.push(e) })
}

const fullRowExcept = (gap: number) => Array.from({ length: COLS }, (_, c) => (c === gap ? 0 : 1))

/** Limpia `n` líneas con una I vertical (n = 4 → Tetris), dejando un resto en el tablero. */
function clearLines(g: Game, n: number): void {
  for (let r = ROWS - n; r < ROWS; r++) g.board[r] = fullRowExcept(0)
  g.setCell(ROWS - n - 1, 5, 2) // resto, para que no sea perfect clear
  g.current = g.makePiece(1)
  g.rotate() // I vertical en la columna 2 de su matriz
  g.current.x = -2
  g.current.y = ROWS - 4 - (4 - n) // la parte sobrante queda por encima
  g.hardDrop()
}

const full = (g: Game) => {
  g.energy = MAX_ENERGY
  return g
}

describe('cola de piezas', () => {
  it(`siempre hay ${QUEUE_SIZE} piezas en cola y next es la primera`, () => {
    const g = newGame()
    expect(g.queue).toHaveLength(QUEUE_SIZE)
    expect(g.next).toBe(g.queue[0])
    const [first, second] = g.queue
    g.hardDrop()
    expect(g.current).toBe(first)
    expect(g.next).toBe(second)
    expect(g.queue.length).toBeGreaterThanOrEqual(QUEUE_SIZE)
  })

  it('la recompensa tras un Tetris se cuela como siguiente pieza', () => {
    const g = newGame()
    clearLines(g, 4)
    expect(g.next.type).toBe(SINGLE)
  })
})

describe('energía', () => {
  it(`+${ENERGY_PER_LINE} por línea`, () => {
    const g = newGame()
    clearLines(g, 2)
    expect(g.energy).toBe(2 * ENERGY_PER_LINE)
  })

  it('un Tetris suma la bonificación', () => {
    const g = newGame()
    clearLines(g, 4)
    expect(g.energy).toBe(4 * ENERGY_PER_LINE + ENERGY_BONUS)
  })

  it('no pasa del máximo y avisa una vez al llenarse', () => {
    const events: GameEvent[] = []
    const g = newGame(events)
    g.energy = MAX_ENERGY - 10
    clearLines(g, 4)
    expect(g.energy).toBe(MAX_ENERGY)
    expect(g.energyFull).toBe(true)
    expect(events.filter((e) => e.type === 'energy-full')).toHaveLength(1)
  })

  it('sin la barra llena no se puede usar ninguna habilidad', () => {
    const g = newGame()
    g.energy = MAX_ENERGY - 1
    expect(g.useSkill('slow')).toBe(false)
    expect(g.slowMs).toBe(0)
  })

  it('usar una habilidad gasta toda la energía y emite el evento', () => {
    const events: GameEvent[] = []
    const g = full(newGame(events))
    expect(g.useSkill('slow')).toBe(true)
    expect(g.energy).toBe(0)
    expect(events).toContainEqual({ type: 'skill', id: 'slow', ok: true })
  })

  it('una habilidad que falla no gasta energía', () => {
    const events: GameEvent[] = []
    const g = full(newGame(events))
    expect(g.useSkill('undo')).toBe(false) // aún no hay nada que deshacer
    expect(g.energy).toBe(MAX_ENERGY)
    expect(events).toContainEqual({ type: 'skill', id: 'undo', ok: false })
  })

  it('en pausa no se pueden usar habilidades', () => {
    const g = full(newGame())
    g.togglePause()
    expect(g.useSkill('peek')).toBe(false)
  })
})

describe('habilidades', () => {
  it(`Ver piezas dura ${PEEK_PIECES} piezas`, () => {
    const g = full(newGame())
    g.useSkill('peek')
    expect(g.peekPieces).toBe(PEEK_PIECES)
    for (let i = 0; i < PEEK_PIECES; i++) {
      g.board = g.board.map((row) => row.map(() => 0)) // que no se llene el tablero
      g.hardDrop()
    }
    expect(g.peekPieces).toBe(0)
  })

  it('Intercambiar cambia la pieza por otra estándar distinta en posición de salida', () => {
    const g = full(newGame())
    const before = g.current.type
    g.current.y = 5
    expect(g.useSkill('swap')).toBe(true)
    expect(g.current.type).not.toBe(before)
    expect(g.current.type).toBeGreaterThanOrEqual(1)
    expect(g.current.type).toBeLessThanOrEqual(STANDARD_COUNT)
    expect(g.current.y).toBe(0)
  })

  it('Intercambiar falla si la nueva pieza no cabe', () => {
    const g = full(newGame())
    g.current.y = 10
    g.board[0] = Array.from({ length: COLS }, () => 5)
    g.board[1] = Array.from({ length: COLS }, () => 5)
    expect(g.useSkill('swap')).toBe(false)
    expect(g.energy).toBe(MAX_ENERGY)
  })

  it(`Ralentizar multiplica el intervalo ×${SLOW_FACTOR} durante ${SLOW_MS / 1000} s`, () => {
    const g = full(newGame())
    g.useSkill('slow')
    expect(g.effectiveDropInterval).toBe(g.dropInterval * SLOW_FACTOR)
    const y = g.current.y
    g.update(g.dropInterval) // con la caída normal ya habría bajado una fila
    expect(g.current.y).toBe(y)
    g.update(g.dropInterval)
    expect(g.current.y).toBe(y + 1)
    g.update(SLOW_MS)
    expect(g.slowMs).toBe(0)
    expect(g.effectiveDropInterval).toBe(g.dropInterval)
  })

  it('Ralentizar no se consume en pausa', () => {
    const g = full(newGame())
    g.useSkill('slow')
    g.togglePause()
    g.update(SLOW_MS)
    expect(g.slowMs).toBe(SLOW_MS)
  })

  it('Deshacer revierte el último fijado (tablero, puntos, líneas, cola) y devuelve la pieza', () => {
    const g = newGame()
    for (let r = ROWS - 2; r < ROWS; r++) g.board[r] = fullRowExcept(0)
    g.current = g.makePiece(1)
    g.rotate()
    g.current.x = -2
    const board = g.board.map((row) => [...row])
    const queueTypes = g.queue.map((p) => p.type)
    g.hardDrop()
    expect(g.lines).toBe(2)

    g.energy = MAX_ENERGY
    expect(g.useSkill('undo')).toBe(true)
    expect(g.board).toEqual(board)
    expect(g.score).toBe(0)
    expect(g.lines).toBe(0)
    expect(g.combo).toBe(0)
    expect(g.queue.map((p) => p.type)).toEqual(queueTypes)
    expect(g.current.type).toBe(1)
    expect(g.current.y).toBe(0) // vuelve a salir desde arriba
    expect(g.energy).toBe(0)
  })

  it('Deshacer solo tiene un nivel', () => {
    const g = newGame()
    g.hardDrop()
    g.hardDrop()
    g.energy = MAX_ENERGY
    expect(g.useSkill('undo')).toBe(true)
    expect(g.canUndo).toBe(false)
    g.energy = MAX_ENERGY
    expect(g.useSkill('undo')).toBe(false)
  })

  it('Deshacer también revierte un power-up pendiente ganado con ese fijado', () => {
    const g = newGame()
    g.linesToPowerUp = 1
    clearLines(g, 1)
    expect(isPowerUp(g.next.type)).toBe(true)
    g.energy = MAX_ENERGY
    g.useSkill('undo')
    expect(g.linesToPowerUp).toBe(1)
    expect(isPowerUp(g.next.type)).toBe(false)
  })
})
