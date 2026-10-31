// @vitest-environment node
// El motor no usa DOM: no hace falta cargar jsdom.
import { describe, expect, it, vi } from 'vitest'
import { Game, createBoard, rotateCW, type GameEvent } from '@/engine/game'
import {
  BOMB,
  COLS,
  FREEZE,
  FREEZE_MS,
  GRAVITY,
  HOLLOW,
  HOLLOW_CHANCE,
  LIGHTNING,
  LINES_PER_POWERUP,
  PENTOMINOES,
  PENTOMINO_CHANCE,
  PIECES,
  PLUS,
  ROWS,
  SINGLE,
  STANDARD_COUNT,
  TINT,
  WILDCARD,
  Y_PIECE,
  isPowerUp,
} from '@/engine/constants'

/** Generador determinista (LCG) para que los tests no dependan de Math.random. */
function seeded(seed = 1): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 2 ** 32
    return s / 2 ** 32
  }
}

function newGame(events: GameEvent[] = []): Game {
  return new Game({ random: seeded(), onEvent: (e) => events.push(e) })
}

/** Coloca una pieza del tipo dado en (x, y) y la fija. */
function place(game: Game, type: number, x: number, y: number): void {
  game.current = game.makePiece(type)
  game.current.x = x
  game.current.y = y
  game.lockPiece()
}

/** Fila del tablero (o de una forma); falla si no existe. */
function rowOf(g: { board: number[][] }, r: number): number[] {
  const row = g.board[r]
  if (!row) throw new Error(`No existe la fila ${r}`)
  return row
}

const filled = (game: Game) => game.board.flat().filter(Boolean).length
const fullRow = (value = 1) => Array.from({ length: COLS }, () => value)

describe('utilidades', () => {
  it('createBoard crea un tablero vacío ROWS×COLS', () => {
    const b = createBoard()
    expect(b).toHaveLength(ROWS)
    expect(b.every((r) => r.length === COLS && r.every((v) => v === 0))).toBe(true)
  })

  it('rotateCW gira en sentido horario y 4 giros vuelven al origen', () => {
    const t = [
      [0, 3, 0],
      [3, 3, 3],
      [0, 0, 0],
    ]
    expect(rotateCW(t)).toEqual([
      [0, 3, 0],
      [0, 3, 3],
      [0, 3, 0],
    ])
    expect(rotateCW(rotateCW(rotateCW(rotateCW(t))))).toEqual(t)
  })
})

describe('movimiento y colisiones', () => {
  it('no atraviesa las paredes', () => {
    const g = newGame()
    for (let i = 0; i < 20; i++) g.moveLeft()
    expect(g.collide(g.current.shape, g.current.x - 1, g.current.y)).toBe(true)
    const x = g.current.x
    g.moveLeft()
    expect(g.current.x).toBe(x)
  })

  it('hard drop suma 2 puntos por celda y fija la pieza', () => {
    const g = newGame()
    g.current = g.makePiece(2) // O
    const distance = g.ghostY() - g.current.y
    g.hardDrop()
    expect(g.score).toBe(distance * 2)
    expect(rowOf(g, ROWS - 1).filter(Boolean)).toHaveLength(2)
  })

  it('el wall kick permite rotar pegado a la pared', () => {
    const g = newGame()
    g.current = g.makePiece(1) // I horizontal
    g.rotate() // vertical
    for (let i = 0; i < 10; i++) g.moveRight()
    g.rotate() // horizontal de nuevo: necesita desplazarse hacia la izquierda
    expect(g.current.shape[0]?.length).toBe(4)
    expect(g.collide(g.current.shape, g.current.x, g.current.y)).toBe(false)
  })
})

describe('bucle', () => {
  it('update baja la pieza al acumular dropInterval', () => {
    const g = newGame()
    const y = g.current.y
    g.update(g.dropInterval - 1)
    expect(g.current.y).toBe(y)
    g.update(1)
    expect(g.current.y).toBe(y + 1)
  })

  it('en pausa ni update ni el input hacen nada', () => {
    const g = newGame()
    g.togglePause()
    const { x, y } = g.current
    g.update(10_000)
    g.moveLeft()
    g.hardDrop()
    expect(g.current).toMatchObject({ x, y })
    expect(g.score).toBe(0)
  })

  it('game over cuando la nueva pieza aparece colisionando, y después nada avanza', () => {
    const g = newGame()
    for (let r = 0; r < ROWS; r++) g.board[r] = fullRow(5).map((v, c) => (c === 0 ? 0 : v))
    rowOf(g, 0).fill(5)
    g.hardDrop()
    expect(g.gameOver).toBe(true)
    const snapshot = JSON.stringify(g.board)
    g.update(10_000)
    g.togglePause()
    expect(g.paused).toBe(false)
    expect(JSON.stringify(g.board)).toBe(snapshot)
  })

  it('reset deja el estado inicial', () => {
    const g = newGame()
    g.score = 999
    g.setCell(ROWS - 1, 0, 1)
    g.frozenMs = 100
    g.reset()
    expect(g.score).toBe(0)
    expect(filled(g)).toBe(0)
    expect(g.frozenMs).toBe(0)
    expect(g.linesToPowerUp).toBe(LINES_PER_POWERUP)
  })
})

describe('líneas, puntuación y nivel', () => {
  it('limpiar una línea suma 100 × nivel', () => {
    const g = newGame()
    g.board[ROWS - 1] = fullRow().map((v, c) => (c === COLS - 1 ? 0 : v))
    place(g, 1, COLS - 4, ROWS - 2) // I horizontal: su fila 1 cae en la última fila
    expect(g.lines).toBe(1)
    expect(g.score).toBe(100)
  })

  it('un Tetris suma 800 y el nivel sube cada 10 líneas', () => {
    const g = newGame()
    g.lines = 8
    for (let r = ROWS - 4; r < ROWS; r++) g.board[r] = fullRow().map((v, c) => (c === 0 ? 0 : v))
    g.current = g.makePiece(1)
    g.rotate() // I vertical, ocupa la columna 2 de su matriz
    g.current.x = -2
    g.hardDrop()
    expect(g.lines).toBe(12)
    expect(g.level).toBe(2)
    expect(g.dropInterval).toBe(910)
  })
})

describe('power-ups', () => {
  it('cada LINES_PER_POWERUP líneas el siguiente es un power-up', () => {
    const g = newGame()
    g.linesToPowerUp = 1
    g.board[ROWS - 1] = fullRow().map((v, c) => (c === COLS - 1 ? 0 : v))
    place(g, 1, COLS - 4, ROWS - 2)
    expect(isPowerUp(g.next.type)).toBe(true)
    expect(g.linesToPowerUp).toBe(LINES_PER_POWERUP)
  })

  it('el bloque del power-up se consume y emite un popup', () => {
    const events: GameEvent[] = []
    const g = newGame(events)
    place(g, FREEZE, 0, ROWS - 1)
    expect(filled(g)).toBe(0)
    expect(events).toContainEqual(expect.objectContaining({ type: 'popup', text: 'CONGELAR' }))
  })

  it('Bomba vacía el área 3×3', () => {
    const g = newGame()
    for (let r = ROWS - 5; r < ROWS; r++) g.board[r] = fullRow().map((v, c) => (c === 0 ? 0 : v))
    place(g, BOMB, 5, ROWS - 4) // place() fija sin comprobar colisión: basta para probar el área
    for (let r = ROWS - 5; r <= ROWS - 3; r++)
      for (let c = 4; c <= 6; c++) expect(g.cell(r, c)).toBe(0)
    expect(g.cell(ROWS - 1, 5)).toBe(1)
  })

  it('Rayo vacía su fila y su columna', () => {
    const g = newGame()
    for (let r = 10; r < ROWS; r++) g.board[r] = fullRow().map((v, c) => (c === 0 ? 0 : v))
    place(g, LIGHTNING, 4, 9)
    expect(g.board.every((row) => row[4] === 0)).toBe(true)
    expect(rowOf(g, 9).every((v) => v === 0)).toBe(true)
  })

  it('Tinte convierte en comodín el color sobre el que cae', () => {
    const g = newGame()
    g.board[ROWS - 1] = [1, 1, 2, 2, 1, 1, 0, 1, 1, 1]
    place(g, TINT, 5, ROWS - 2) // cae sobre un bloque de color 1
    expect(g.board[ROWS - 1]).toEqual([13, 13, 2, 2, 13, 13, 0, 13, 13, 13])
  })

  it('Tinte en el vacío usa el color más abundante', () => {
    const g = newGame()
    g.board[ROWS - 1] = [4, 4, 4, 2, 0, 0, 0, 0, 0, 0]
    place(g, TINT, 8, 0)
    expect(rowOf(g, ROWS - 1).slice(0, 4)).toEqual([WILDCARD, WILDCARD, WILDCARD, 2])
  })

  it('los comodines desaparecen con la siguiente limpieza y puntúan', () => {
    const events: GameEvent[] = []
    const g = newGame(events)
    g.setCell(ROWS - 3, 0, WILDCARD)
    g.setCell(ROWS - 3, 1, WILDCARD)
    g.board[ROWS - 1] = fullRow().map((v, c) => (c === COLS - 1 ? 0 : v))
    place(g, 1, COLS - 4, ROWS - 2)
    expect(g.board.flat()).not.toContain(WILDCARD)
    expect(g.score).toBe(100 + 2 * 50)
    expect(events).toContainEqual(expect.objectContaining({ text: 'COMODINES +2' }))
  })

  it('Gravedad compacta cada columna', () => {
    const g = newGame()
    g.setCell(5, 0, 5)
    g.setCell(12, 0, 6)
    g.setCell(ROWS - 1, 1, 7)
    place(g, GRAVITY, COLS - 1, 0)
    expect(g.cell(ROWS - 1, 0)).toBe(6)
    expect(g.cell(ROWS - 2, 0)).toBe(5)
    expect(g.cell(5, 0)).toBe(0)
    expect(g.cell(ROWS - 1, 1)).toBe(7)
  })

  it('Congelar detiene la caída automática FREEZE_MS y la pausa lo conserva', () => {
    const g = newGame()
    place(g, FREEZE, 0, ROWS - 1)
    expect(g.frozenMs).toBe(FREEZE_MS)
    const y = g.current.y
    g.update(FREEZE_MS - 1000)
    expect(g.current.y).toBe(y)
    g.togglePause()
    g.update(10_000)
    expect(g.frozenMs).toBe(1000)
    g.togglePause()
    g.update(1000) // se agota el congelado
    g.update(g.dropInterval)
    expect(g.current.y).toBe(y + 1)
  })

  it('usa el generador inyectado', () => {
    const random = vi.fn<() => number>(() => 0)
    new Game({ random })
    expect(random).toHaveBeenCalled()
  })
})

describe('piezas no estándar', () => {
  /** Juego cuyo generador devuelve siempre el mismo valor. */
  const constantGame = (value: number, events: GameEvent[] = []) =>
    new Game({ random: () => value, onEvent: (e) => events.push(e) })

  /** Prepara 4 filas completas salvo la columna 0 y suelta una I vertical: un Tetris. */
  function doTetris(g: Game): void {
    for (let r = ROWS - 4; r < ROWS; r++) g.board[r] = fullRow().map((v, c) => (c === 0 ? 0 : v))
    g.current = g.makePiece(1)
    g.rotate()
    g.current.x = -2
    g.hardDrop()
  }

  it('la tirada baja da la pieza hueca (reto)', () => {
    const g = constantGame(HOLLOW_CHANCE / 2)
    expect(g.current.type).toBe(HOLLOW)
    expect(g.next.type).toBe(HOLLOW)
  })

  it('la tirada intermedia da un pentominó', () => {
    const g = constantGame(HOLLOW_CHANCE + PENTOMINO_CHANCE / 2)
    expect(PENTOMINOES).toContain(g.current.type)
    expect(g.current.type).toBe(PLUS) // randomInt(0, 2) con 0.09 → índice 0
  })

  it('el resto de tiradas da piezas estándar', () => {
    const g = constantGame(0.5)
    expect(g.current.type).toBeGreaterThanOrEqual(1)
    expect(g.current.type).toBeLessThanOrEqual(STANDARD_COUNT)
  })

  it('tras un Tetris la siguiente pieza es un single de recompensa', () => {
    const events: GameEvent[] = []
    const g = newGame(events)
    doTetris(g)
    expect(g.lines).toBe(4)
    expect(g.next.type).toBe(SINGLE)
    g.hardDrop() // entra el single en juego
    expect(g.current.type).toBe(SINGLE)
    expect(events).toContainEqual(expect.objectContaining({ type: 'popup', text: 'RECOMPENSA' }))
  })

  it('3 líneas no dan recompensa', () => {
    const g = constantGame(0.5)
    for (let r = ROWS - 3; r < ROWS; r++) g.board[r] = fullRow().map((v, c) => (c === 0 ? 0 : v))
    g.current = g.makePiece(1)
    g.rotate()
    g.current.x = -2
    g.hardDrop()
    expect(g.lines).toBe(3)
    expect(g.next.type).not.toBe(SINGLE)
  })

  it('la recompensa tiene prioridad sobre un power-up pendiente, que llega después', () => {
    const g = newGame()
    g.linesToPowerUp = 4 // el Tetris también completa el power-up
    doTetris(g)
    expect(g.next.type).toBe(SINGLE)
    expect(g.pendingPowerUp).toBe(true)
    g.hardDrop()
    expect(isPowerUp(g.next.type)).toBe(true)
  })

  it('al entrar una pieza especial emite popup y evento con sus celdas', () => {
    const events: GameEvent[] = []
    const g = constantGame(HOLLOW_CHANCE / 2, events)
    const special = events.find((e) => e.type === 'special')
    expect(special).toMatchObject({ type: 'special', kind: 'challenge' })
    expect(special?.type === 'special' && special.cells).toHaveLength(8)
    expect(events).toContainEqual(expect.objectContaining({ type: 'popup', text: '¡RETO!' }))
    expect(g.current.type).toBe(HOLLOW)
  })

  it('las piezas estándar no emiten eventos especiales', () => {
    const events: GameEvent[] = []
    constantGame(0.5, events)
    expect(events).toHaveLength(0)
  })

  it('la hueca es simétrica al rotar y la Y vuelve al origen tras 4 giros', () => {
    const g = newGame()
    const hollow = g.makePiece(HOLLOW).shape
    expect(rotateCW(hollow)).toEqual(hollow)
    const y = g.makePiece(Y_PIECE).shape
    expect(rotateCW(rotateCW(rotateCW(rotateCW(y))))).toEqual(y)
  })

  it('todas las piezas nuevas caben en la vista previa 4×4 y aparecen sin colisión', () => {
    const g = newGame()
    g.board = createBoard()
    for (const type of [...PENTOMINOES, SINGLE, HOLLOW]) {
      const piece = g.makePiece(type)
      expect(PIECES[type]?.length).toBeLessThanOrEqual(4)
      expect(piece.shape.flat().filter(Boolean)).toHaveLength(
        type === SINGLE ? 1 : type === HOLLOW ? 8 : 5,
      )
      expect(g.collide(piece.shape, piece.x, piece.y)).toBe(false)
    }
  })
})
