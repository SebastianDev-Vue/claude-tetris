// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { Game, type GameEvent } from '@/engine/game'
import { COLS, FREEZE, PLUS, isPowerUp } from '@/engine/constants'
import { MAX_ENERGY, PEEK_PIECES, QUEUE_SIZE } from '@/engine/skills'

function newGame(events: GameEvent[] = []) {
  return new Game({ random: () => 0.5, onEvent: (e) => events.push(e) })
}

describe('hold', () => {
  it('con el slot vacío guarda la pieza actual y saca la siguiente de la cola', () => {
    const events: GameEvent[] = []
    const g = newGame(events)
    const current = g.current.type
    const next = g.next
    expect(g.holdPiece()).toBe(true)
    expect(g.hold?.type).toBe(current)
    expect(g.current).toBe(next)
    expect(g.queue).toHaveLength(QUEUE_SIZE)
    expect(events).toContainEqual({ type: 'hold', ok: true })
  })

  it('con algo guardado lo intercambia; ambas piezas vuelven a su forma de salida', () => {
    const g = newGame()
    g.current = g.makePiece(1)
    g.holdPiece()
    g.hardDrop() // libera HOLD para el turno siguiente
    g.current = g.makePiece(3)
    g.rotate()
    g.current.y = 8
    expect(g.holdPiece()).toBe(true)
    expect(g.current.type).toBe(1)
    expect(g.current.y).toBe(0)
    expect(g.current.shape).toEqual(g.makePiece(1).shape)
    expect(g.hold).toEqual(g.makePiece(3)) // sin rotar
  })

  it('solo se puede usar una vez por turno', () => {
    const g = newGame()
    expect(g.holdPiece()).toBe(true)
    expect(g.holdUsed).toBe(true)
    const playing = g.current
    expect(g.holdPiece()).toBe(false)
    expect(g.current).toBe(playing)
  })

  it('se libera al fijar y salir la siguiente pieza', () => {
    const g = newGame()
    g.holdPiece()
    g.hardDrop()
    expect(g.holdUsed).toBe(false)
    expect(g.holdPiece()).toBe(true)
  })

  it('anula la rotación previa para el T-spin', () => {
    const g = newGame()
    g.current = g.makePiece(3)
    g.rotate()
    g.holdPiece()
    expect(g.lastMoveRotate).toBe(false)
  })

  it('no hace nada si la pieza que entra no cabe', () => {
    const g = newGame()
    g.current.y = 10
    g.board[0] = Array.from({ length: COLS }, () => 5)
    g.board[1] = Array.from({ length: COLS }, () => 5)
    expect(g.holdPiece()).toBe(false)
    expect(g.hold).toBeNull()
    expect(g.holdUsed).toBe(false)
  })

  it('no funciona en pausa', () => {
    const g = newGame()
    g.togglePause()
    expect(g.holdPiece()).toBe(false)
  })

  it('los power-ups también se pueden guardar', () => {
    const g = newGame()
    g.current = g.makePiece(FREEZE)
    g.holdPiece()
    expect(isPowerUp(g.hold?.type ?? 0)).toBe(true)
  })

  it('reiniciar vacía el slot', () => {
    const g = newGame()
    g.holdPiece()
    g.reset()
    expect(g.hold).toBeNull()
    expect(g.holdUsed).toBe(false)
  })
})

describe('Hold extra (habilidad 5)', () => {
  it('libera HOLD para un segundo uso en el mismo turno', () => {
    const g = newGame()
    g.holdPiece()
    g.energy = MAX_ENERGY
    expect(g.useSkill('hold')).toBe(true)
    expect(g.holdUsed).toBe(false)
    expect(g.holdPiece()).toBe(true)
    expect(g.energy).toBe(0)
  })

  it('falla sin gastar energía si HOLD ya está disponible', () => {
    const g = newGame()
    g.energy = MAX_ENERGY
    expect(g.useSkill('hold')).toBe(false)
    expect(g.energy).toBe(MAX_ENERGY)
  })

  it('Deshacer restaura el slot HOLD y da turno nuevo', () => {
    const g = newGame()
    g.current = g.makePiece(2)
    g.holdPiece() // HOLD = O
    g.hardDrop()
    g.holdPiece() // HOLD pasa a tener la pieza que entró; juega la O
    const heldBeforeLock = g.hold?.type
    g.hardDrop()
    g.energy = MAX_ENERGY
    expect(g.useSkill('undo')).toBe(true)
    expect(g.current.type).toBe(2)
    expect(heldBeforeLock).toBeDefined()
    expect(g.hold?.type).toBe(heldBeforeLock) // exactamente lo que había en HOLD
    expect(g.holdUsed).toBe(false)
  })
})

describe('hold: casos límite', () => {
  /** Llena las dos filas de arriba: ninguna pieza cabe en su posición de salida. */
  function blockSpawn(g: Game): void {
    g.current.y = 10
    g.board[0] = Array.from({ length: COLS }, () => 5)
    g.board[1] = Array.from({ length: COLS }, () => 5)
  }

  it('una pieza especial que entra desde HOLD se anuncia', () => {
    const events: GameEvent[] = []
    const g = newGame(events)
    g.next = g.makePiece(PLUS)
    g.holdPiece()
    expect(g.current.type).toBe(PLUS)
    expect(events).toContainEqual(expect.objectContaining({ type: 'special', kind: 'pentomino' }))
  })

  it('sacar una pieza de la cola con HOLD descuenta «Ver piezas»', () => {
    const g = newGame()
    g.energy = MAX_ENERGY
    g.useSkill('peek')
    g.holdPiece()
    expect(g.peekPieces).toBe(PEEK_PIECES - 1)
  })

  it('intercambiar con la pieza guardada no descuenta «Ver piezas»', () => {
    const g = newGame()
    g.holdPiece()
    g.hardDrop()
    g.energy = MAX_ENERGY
    g.useSkill('peek')
    g.holdPiece() // el slot ya tenía pieza: no sale nada de la cola
    expect(g.peekPieces).toBe(PEEK_PIECES)
  })

  it('un hold rechazado avisa con popup y evento ok: false', () => {
    const events: GameEvent[] = []
    const g = newGame(events)
    blockSpawn(g)
    expect(g.holdPiece()).toBe(false)
    expect(events).toContainEqual({ type: 'hold', ok: false })
    expect(events).toContainEqual(expect.objectContaining({ type: 'popup', text: 'NO DISPONIBLE' }))
  })

  it('Hold extra no gasta energía si la pieza guardada no cabría', () => {
    const g = newGame()
    g.holdPiece()
    blockSpawn(g)
    expect(g.holdFits).toBe(false)
    g.energy = MAX_ENERGY
    expect(g.useSkill('hold')).toBe(false)
    expect(g.energy).toBe(MAX_ENERGY)
    expect(g.holdUsed).toBe(true)
  })
})
