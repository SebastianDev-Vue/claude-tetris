import {
  BOMB,
  COLORS,
  COLS,
  FREEZE,
  FREEZE_MS,
  HOLLOW,
  HOLLOW_CHANCE,
  PENTOMINOES,
  PENTOMINO_CHANCE,
  GRAVITY,
  INITIAL_DROP_INTERVAL,
  LIGHTNING,
  LINES_PER_POWERUP,
  LINE_SCORES,
  PIECES,
  POWER_FIRST,
  POWER_LAST,
  POWER_NAMES,
  ROWS,
  SINGLE,
  SPECIAL_NAMES,
  STANDARD_COUNT,
  TINT,
  WILDCARD,
  WILDCARD_SCORE,
  B2B_MULTIPLIER,
  CLEAR_NAMES,
  MAX_COMBO_MULTIPLIER,
  PERFECT_CLEAR_SCORE,
  TSPIN_SCORES,
  T_PIECE,
  isPowerUp,
  specialKind,
  type SpecialKind,
} from './constants'

export type Board = number[][]
export type Shape = number[][]

export interface Piece {
  type: number
  shape: Shape
  x: number
  y: number
}

export interface Cell {
  x: number
  y: number
}

/** Eventos visuales que el motor emite; la capa de render decide cómo mostrarlos. */
export type GameEvent =
  | { type: 'popup'; text: string; color: string }
  /** Ha entrado en juego una pieza especial; `cells` son sus celdas en el tablero. */
  | { type: 'special'; kind: SpecialKind; cells: Cell[]; color: string }
  /**
   * Un fijado puntuable: limpió líneas o fue un T-spin. `rows` son los índices de las filas
   * limpiadas (antes de eliminarlas), `combo` el multiplicador aplicado.
   */
  | {
      type: 'clear'
      rows: number[]
      lines: number
      combo: number
      tspin: boolean
      b2b: boolean
      perfect: boolean
      points: number
    }

export interface GameOptions {
  /** Generador aleatorio en [0, 1); inyectable para tests deterministas. */
  random?: () => number
  onEvent?: (event: GameEvent) => void
}

export function emptyRow(): number[] {
  return Array.from({ length: COLS }, () => 0)
}

export function createBoard(): Board {
  return Array.from({ length: ROWS }, emptyRow)
}

/** Recorre las celdas ocupadas de una forma (valor distinto de 0). */
export function forEachCell(shape: Shape, fn: (r: number, c: number, value: number) => void): void {
  shape.forEach((row, r) =>
    row.forEach((value, c) => {
      if (value) fn(r, c, value)
    }),
  )
}

/** Rotación horaria: transposición + reverso (no es SRS). */
export function rotateCW(shape: Shape): Shape {
  const rows = shape.length
  const cols = shape[0]?.length ?? 0
  return Array.from({ length: cols }, (_, c) =>
    Array.from({ length: rows }, (_, i) => shape[rows - 1 - i]?.[c] ?? 0),
  )
}

const KICKS = [0, -1, 1, -2, 2]

/**
 * Estado y reglas del juego, sin DOM ni temporizadores: quien lo usa llama a update(dt)
 * en cada frame y a los métodos de input. Todo el estado se reinicia en reset().
 */
export class Game {
  board!: Board
  current!: Piece
  next!: Piece
  score = 0
  lines = 0
  level = 1
  paused = false
  gameOver = false
  dropInterval = INITIAL_DROP_INTERVAL
  dropAccum = 0
  linesToPowerUp = LINES_PER_POWERUP
  pendingPowerUp = false
  /** Tras un Tetris la siguiente pieza es un single de recompensa. */
  pendingReward = false
  /** Tiempo restante de Congelar; solo baja dentro de update(), así que la pausa lo conserva. */
  frozenMs = 0
  /** Fijados consecutivos que han limpiado líneas (0 = sin combo). */
  combo = 0
  /** El último fijado con líneas fue «difícil» (Tetris o T-spin): el siguiente puede ser B2B. */
  b2b = false
  /** El último movimiento de la pieza actual fue una rotación (para detectar T-spin). */
  lastMoveRotate = false

  private readonly random: () => number
  private readonly emit: (event: GameEvent) => void

  constructor(options: GameOptions = {}) {
    this.random = options.random ?? Math.random
    this.emit = options.onEvent ?? (() => {})
    this.reset()
  }

  /** Único camino de reinicio. */
  reset(): void {
    this.board = createBoard()
    this.score = 0
    this.lines = 0
    this.level = 1
    this.paused = false
    this.gameOver = false
    this.dropInterval = INITIAL_DROP_INTERVAL
    this.dropAccum = 0
    this.linesToPowerUp = LINES_PER_POWERUP
    this.pendingPowerUp = false
    this.pendingReward = false
    this.frozenMs = 0
    this.combo = 0
    this.b2b = false
    this.lastMoveRotate = false
    this.next = this.pickNextPiece()
    this.spawn()
  }

  // ---- Tablero ----

  /** Valor de una celda; fuera del tablero cuenta como vacía. */
  cell(r: number, c: number): number {
    return this.board[r]?.[c] ?? 0
  }

  /** Escribe una celda; ignora coordenadas fuera del tablero. */
  setCell(r: number, c: number, value: number): void {
    const row = this.board[r]
    if (row && c >= 0 && c < COLS) row[c] = value
  }

  // ---- Piezas ----

  makePiece(type: number): Piece {
    const template = PIECES[type]
    if (!template) throw new Error(`El tipo ${type} no es una pieza jugable`)
    const shape = template.map((row) => [...row])
    const width = shape[0]?.length ?? 0
    return { type, shape, x: Math.floor(COLS / 2) - Math.floor(width / 2), y: 0 }
  }

  private randomInt(min: number, max: number): number {
    return min + Math.floor(this.random() * (max - min + 1))
  }

  /**
   * Único punto que decide qué pieza entra en la cola. Prioridad: recompensa tras Tetris →
   * power-up pendiente → pieza hueca (reto) → pentominó → estándar. Lo pendiente que no
   * entra ahora se conserva para la siguiente pieza.
   */
  private pickNextPiece(): Piece {
    if (this.pendingReward) {
      this.pendingReward = false
      return this.makePiece(SINGLE)
    }
    if (this.pendingPowerUp) {
      this.pendingPowerUp = false
      return this.makePiece(this.randomInt(POWER_FIRST, POWER_LAST))
    }
    const roll = this.random()
    if (roll < HOLLOW_CHANCE) return this.makePiece(HOLLOW)
    if (roll < HOLLOW_CHANCE + PENTOMINO_CHANCE) {
      const type = PENTOMINOES[this.randomInt(0, PENTOMINOES.length - 1)] ?? PENTOMINOES[0]
      return this.makePiece(type)
    }
    return this.makePiece(this.randomInt(1, STANDARD_COUNT))
  }

  collide(shape: Shape, ox: number, oy: number): boolean {
    let hit = false
    forEachCell(shape, (r, c) => {
      const nx = ox + c
      const ny = oy + r
      if (nx < 0 || nx >= COLS || ny >= ROWS || (ny >= 0 && this.cell(ny, nx))) hit = true
    })
    return hit
  }

  ghostY(): number {
    let gy = this.current.y
    while (!this.collide(this.current.shape, this.current.x, gy + 1)) gy++
    return gy
  }

  private get canAct(): boolean {
    return !this.paused && !this.gameOver
  }

  // ---- Bucle ----

  /** Avanza el juego dt milisegundos. No hace nada en pausa o tras game over. */
  update(dt: number): void {
    if (!this.canAct) return
    if (this.frozenMs > 0) {
      // Congelar: la caída automática no avanza (el jugador sí puede moverse)
      this.frozenMs = Math.max(0, this.frozenMs - dt)
    } else {
      this.dropAccum += dt
    }
    if (this.dropAccum >= this.dropInterval) {
      this.dropAccum = 0
      if (!this.collide(this.current.shape, this.current.x, this.current.y + 1)) {
        this.current.y++
      } else {
        this.lockPiece()
      }
    }
  }

  // ---- Input ----

  // Para el T-spin cuenta si el último movimiento fue una rotación: desplazarse o el soft drop
  // lo anulan; la caída por gravedad y el hard drop no (permiten rotar y dejar caer).

  moveLeft(): void {
    if (this.canAct && !this.collide(this.current.shape, this.current.x - 1, this.current.y)) {
      this.current.x--
      this.lastMoveRotate = false
    }
  }

  moveRight(): void {
    if (this.canAct && !this.collide(this.current.shape, this.current.x + 1, this.current.y)) {
      this.current.x++
      this.lastMoveRotate = false
    }
  }

  rotate(): void {
    if (!this.canAct) return
    const rotated = rotateCW(this.current.shape)
    for (const kick of KICKS) {
      if (!this.collide(rotated, this.current.x + kick, this.current.y)) {
        this.current.shape = rotated
        this.current.x += kick
        this.lastMoveRotate = true
        return
      }
    }
  }

  softDrop(): void {
    if (!this.canAct) return
    if (!this.collide(this.current.shape, this.current.x, this.current.y + 1)) {
      this.current.y++
      this.score += 1
      this.lastMoveRotate = false
    } else {
      this.lockPiece()
    }
  }

  hardDrop(): void {
    if (!this.canAct) return
    const gy = this.ghostY()
    this.score += (gy - this.current.y) * 2
    this.current.y = gy
    this.lockPiece()
  }

  togglePause(): void {
    if (this.gameOver) return
    this.paused = !this.paused
  }

  // ---- Fijado: (T-spin) → merge → power-ups → líneas → nueva pieza ----

  lockPiece(): void {
    const tspin = this.isTSpin() // antes de merge(): se evalúa sobre el tablero sin la pieza
    this.merge()
    this.resolvePowerUp()
    this.clearLines(tspin)
    this.spawn()
  }

  /**
   * T-spin por la regla de las 3 esquinas: pieza T, último movimiento una rotación y al menos
   * 3 de las 4 esquinas de su caja 3×3 ocupadas (o fuera del tablero). Funciona sin SRS porque
   * transponer+invertir una matriz 3×3 mantiene el centro de la T en (x+1, y+1).
   */
  isTSpin(): boolean {
    const { type, x, y } = this.current
    if (type !== T_PIECE || !this.lastMoveRotate) return false
    const corners: [number, number][] = [
      [y, x],
      [y, x + 2],
      [y + 2, x],
      [y + 2, x + 2],
    ]
    const blocked = corners.filter(
      ([r, c]) => c < 0 || c >= COLS || r >= ROWS || (r >= 0 && this.cell(r, c) !== 0),
    )
    return blocked.length >= 3
  }

  private merge(): void {
    const { shape, x, y } = this.current
    forEachCell(shape, (r, c, value) => this.setCell(y + r, x + c, value))
  }

  private spawn(): void {
    this.current = this.next
    this.next = this.pickNextPiece()
    if (this.collide(this.current.shape, this.current.x, this.current.y)) {
      this.gameOver = true
      return
    }
    this.announceSpecial()
  }

  /** Avisa (popup + evento para animación) cuando entra en juego una pieza especial. */
  private announceSpecial(): void {
    const { type, shape, x, y } = this.current
    const kind = specialKind(type)
    if (!kind) return
    const color = COLORS[type] ?? '#fff'
    const cells: Cell[] = []
    forEachCell(shape, (r, c) => cells.push({ x: x + c, y: y + r }))
    this.emit({ type: 'popup', text: SPECIAL_NAMES[kind], color })
    this.emit({ type: 'special', kind, cells, color })
  }

  /**
   * Elimina filas completas y puntúa:
   * base (tabla normal o de T-spin) × nivel × combo × B2B (+ perfect clear).
   */
  private clearLines(tspin: boolean): void {
    const rows: number[] = []
    this.board.forEach((row, r) => {
      if (row.every((v) => v !== 0)) rows.push(r)
    })
    const cleared = rows.length

    if (!cleared) {
      this.combo = 0 // fijar sin limpiar rompe el combo (el B2B se conserva)
      if (tspin) this.scoreClear(rows, tspin) // T-spin sin líneas también puntúa
      return
    }

    this.board = [
      ...Array.from({ length: cleared }, emptyRow),
      ...this.board.filter((_, r) => !rows.includes(r)),
    ]
    this.lines += cleared
    this.combo++
    // Los comodines que queden se eliminan con cualquier limpieza de líneas (antes de
    // puntuar, para que cuenten en un posible perfect clear)
    const wild = this.removeWildcards()
    this.scoreClear(rows, tspin)
    if (wild) {
      this.score += wild * WILDCARD_SCORE * this.level
      this.popup(`COMODINES +${wild}`, COLORS[WILDCARD])
    }
    if (cleared >= 4) this.pendingReward = true
    this.level = Math.floor(this.lines / 10) + 1
    this.dropInterval = Math.max(100, INITIAL_DROP_INTERVAL - (this.level - 1) * 90)
    this.linesToPowerUp -= cleared
    if (this.linesToPowerUp <= 0) {
      this.linesToPowerUp += LINES_PER_POWERUP
      this.pendingPowerUp = true
    }
  }

  /** Puntúa un fijado con líneas o T-spin, actualiza el B2B y emite popups + evento 'clear'. */
  private scoreClear(rows: number[], tspin: boolean): void {
    const lines = rows.length
    const base = (tspin ? TSPIN_SCORES[lines] : LINE_SCORES[lines]) ?? 0
    // «Difícil» = Tetris o T-spin con líneas. Un clear fácil rompe la cadena B2B.
    const difficult = lines > 0 && (lines >= 4 || tspin)
    const b2b = difficult && this.b2b
    if (lines > 0) this.b2b = difficult
    const comboMult = Math.min(Math.max(this.combo, 1), MAX_COMBO_MULTIPLIER)
    const perfect = lines > 0 && this.board.every((row) => row.every((v) => v === 0))
    const points =
      Math.round(base * this.level * comboMult * (b2b ? B2B_MULTIPLIER : 1)) +
      (perfect ? PERFECT_CLEAR_SCORE * this.level : 0)
    this.score += points

    if (tspin) this.popup(`T-SPIN ${CLEAR_NAMES[lines] ?? ''}`.trim(), COLORS[T_PIECE])
    else if (lines >= 4) this.popup('TETRIS', COLORS[1])
    if (b2b) this.popup('BACK-TO-BACK', '#ffab40')
    if (comboMult >= 2) this.popup(`COMBO x${comboMult}`, '#ff8a80')
    if (perfect) this.popup('PERFECT CLEAR', '#ffffff')
    this.emit({ type: 'clear', rows, lines, combo: comboMult, tspin, b2b, perfect, points })
  }

  private removeWildcards(): number {
    let count = 0
    for (const row of this.board)
      row.forEach((v, c) => {
        if (v === WILDCARD) {
          row[c] = 0
          count++
        }
      })
    return count
  }

  // ---- Power-ups ----

  /** Se llama tras merge(): consume los bloques especiales de la pieza recién fijada. */
  private resolvePowerUp(): void {
    const { shape, x, y } = this.current
    forEachCell(shape, (r, c, value) => {
      if (!isPowerUp(value)) return
      this.setCell(y + r, x + c, 0)
      this.applyPowerUp(value, x + c, y + r)
      this.popup(POWER_NAMES[value] ?? '', COLORS[value])
    })
  }

  private applyPowerUp(type: number, x: number, y: number): void {
    switch (type) {
      case BOMB: // vacía el área 3×3 centrada en el bloque
        for (let r = y - 1; r <= y + 1; r++)
          for (let c = x - 1; c <= x + 1; c++) this.setCell(r, c, 0)
        break
      case LIGHTNING: // vacía su fila y su columna
        this.board[y]?.fill(0)
        for (let r = 0; r < ROWS; r++) this.setCell(r, x, 0)
        break
      case TINT: {
        // un color entero pasa a comodín
        const color = this.tintTargetColor(x, y)
        if (!color) break
        for (const row of this.board)
          row.forEach((v, c) => {
            if (v === color) row[c] = WILDCARD
          })
        break
      }
      case GRAVITY: // cada columna cae hasta compactar los huecos
        for (let c = 0; c < COLS; c++) {
          const filled = this.board.map((row) => row[c] ?? 0).filter(Boolean)
          for (let r = ROWS - 1; r >= 0; r--) this.setCell(r, c, filled.pop() ?? 0)
        }
        break
      case FREEZE: // sin caída automática durante FREEZE_MS
        this.frozenMs = FREEZE_MS
        break
    }
  }

  /** Color del bloque sobre el que cae el Tinte; si no hay, el más abundante del tablero. */
  private tintTargetColor(x: number, y: number): number {
    const below = this.cell(y + 1, x)
    if (below && below !== WILDCARD) return below
    const counts = new Map<number, number>()
    let best = 0,
      bestCount = 0
    for (const row of this.board)
      for (const v of row) {
        if (!v || v === WILDCARD) continue
        const n = (counts.get(v) ?? 0) + 1
        counts.set(v, n)
        if (n > bestCount) {
          best = v
          bestCount = n
        }
      }
    return best
  }

  private popup(text: string, color: string | null | undefined): void {
    this.emit({ type: 'popup', text, color: color ?? '#fff' })
  }
}
