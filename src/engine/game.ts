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
  FIXED,
  GARBAGE,
  isPowerUp,
  specialKind,
  type SpecialKind,
} from './constants'
import { REVERSE_FROM_LEVEL, challengeFor, type Challenge, type GameMode } from './challenges'
import {
  ENERGY_BONUS,
  ENERGY_PER_LINE,
  MAX_ENERGY,
  PEEK_PIECES,
  QUEUE_SIZE,
  SLOW_FACTOR,
  SLOW_MS,
  skillInfo,
  type SkillId,
} from './skills'

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
  /** Una pieza se ha fijado. `vanish`: en el desafío Invisible sus bloques dejan de verse. */
  | { type: 'lock'; cells: Cell[]; color: string; vanish: boolean }
  /** Ha subido una fila de basura desde abajo. */
  | { type: 'garbage' }
  /** La partida terminó: `won` si se cumplió el objetivo del desafío. */
  | { type: 'finish'; won: boolean }
  /** Se ha usado una habilidad (`ok: false` si no se pudo y no gastó energía). */
  | { type: 'skill'; id: SkillId; ok: boolean }
  /** La barra de energía acaba de llenarse. */
  | { type: 'energy-full' }
  /** HOLD pedido: `ok` si la pieza fue al slot (o se intercambió), `false` si se rechazó. */
  | { type: 'hold'; ok: boolean }

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

/** Rotación antihoraria (desafío Rotación inversa): tres giros horarios. */
export function rotateCCW(shape: Shape): Shape {
  return rotateCW(rotateCW(rotateCW(shape)))
}

const KICKS = [0, -1, 1, -2, 2]

/**
 * Estado y reglas del juego, sin DOM ni temporizadores: quien lo usa llama a update(dt)
 * en cada frame y a los métodos de input. Todo el estado se reinicia en reset().
 */
/** Estado que «Deshacer» restaura: se guarda justo antes de cada fijado. */
interface Snapshot {
  board: Board
  score: number
  lines: number
  level: number
  dropInterval: number
  combo: number
  b2b: boolean
  linesToPowerUp: number
  pendingPowerUp: boolean
  pendingReward: boolean
  queue: Piece[]
  pieceType: number
  hold: Piece | null
}

const levelInterval = (level: number): number =>
  Math.max(100, INITIAL_DROP_INTERVAL - (level - 1) * 90)

const clonePiece = (p: Piece): Piece => ({ ...p, shape: p.shape.map((row) => [...row]) })

export class Game {
  board!: Board
  current!: Piece
  /** Próximas piezas; la primera es la siguiente («next»). */
  queue: Piece[] = []
  score = 0
  lines = 0
  level = 1
  /** Nivel con el que empieza la próxima partida (1–10); lo aplica reset(). */
  startLevel = 1
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

  // ---- Modo / desafío ----
  mode: GameMode = 'marathon'
  /** Tiempo de juego (no avanza en pausa ni tras terminar). */
  elapsedMs = 0
  /** Temporizador libre para el desafío activo (p. ej. la próxima fila de basura). */
  challengeMs = 0
  /** Resultado al terminar: 'won' solo en desafíos con objetivo cumplido. */
  result: 'won' | 'lost' | null = null
  endReason = ''

  // ---- Energía y habilidades ----
  energy = 0
  /** Piezas que quedan con la cola completa visible (habilidad «Ver piezas»). */
  peekPieces = 0
  /** Tiempo restante de «Ralentizar»; como Congelar, solo baja dentro de update(). */
  slowMs = 0
  /** Pieza reservada (slot HOLD). */
  hold: Piece | null = null
  /** HOLD ya usado en este turno; se libera al salir la siguiente pieza. */
  holdUsed = false
  private snapshot: Snapshot | null = null

  private readonly random: () => number
  private readonly emit: (event: GameEvent) => void

  constructor(options: GameOptions = {}) {
    this.random = options.random ?? Math.random
    this.emit = options.onEvent ?? (() => {})
    this.reset()
  }

  /** Siguiente pieza (cabeza de la cola). */
  get next(): Piece {
    if (!this.queue.length) this.fillQueue()
    return this.queue[0] as Piece
  }

  set next(piece: Piece) {
    this.queue[0] = piece
  }

  get energyFull(): boolean {
    return this.energy >= MAX_ENERGY
  }

  /** Hay un fijado que «Deshacer» puede revertir. */
  get canUndo(): boolean {
    return this.snapshot !== null
  }

  /** Intervalo de caída real (Ralentizar lo multiplica). */
  get effectiveDropInterval(): number {
    return this.slowMs > 0 ? this.dropInterval * SLOW_FACTOR : this.dropInterval
  }

  get challenge(): Challenge | undefined {
    return challengeFor(this.mode)
  }

  /** Desafío Rotación inversa a partir de REVERSE_FROM_LEVEL. */
  get rotationReversed(): boolean {
    return this.mode === 'reverse' && this.level >= REVERSE_FROM_LEVEL
  }

  /** Desafío Invisible: los bloques fijados no se dibujan mientras dura la partida. */
  get hideLocked(): boolean {
    return this.mode === 'invisible' && !this.gameOver
  }

  /** Fija el nivel inicial de la próxima partida (acotado a 1–10). */
  setStartLevel(level: number): void {
    this.startLevel = Math.min(10, Math.max(1, Math.round(level)))
  }

  /** Único camino de reinicio. Sin argumento repite el modo actual. */
  reset(mode: GameMode = this.mode): void {
    this.mode = mode
    this.elapsedMs = 0
    this.challengeMs = 0
    this.result = null
    this.endReason = ''
    this.board = createBoard()
    this.score = 0
    this.lines = 0
    this.level = this.startLevel
    this.paused = false
    this.gameOver = false
    this.dropInterval = levelInterval(this.level)
    this.dropAccum = 0
    this.linesToPowerUp = LINES_PER_POWERUP
    this.pendingPowerUp = false
    this.pendingReward = false
    this.frozenMs = 0
    this.combo = 0
    this.b2b = false
    this.lastMoveRotate = false
    this.energy = 0
    this.peekPieces = 0
    this.slowMs = 0
    this.hold = null
    this.holdUsed = false
    this.snapshot = null
    this.challenge?.setup?.(this)
    this.queue = []
    this.fillQueue()
    this.spawn()
  }

  // ---- Desafíos ----

  /** Termina la partida (victoria o derrota) y lo anuncia. */
  private finish(won: boolean, reason: string): void {
    if (this.gameOver) return
    this.gameOver = true
    this.result = won ? 'won' : 'lost'
    this.endReason = reason
    this.emit({ type: 'finish', won })
  }

  /** Comprueba objetivo y derrota del desafío activo. */
  private checkChallenge(): void {
    const challenge = this.challenge
    if (!challenge || this.gameOver) return
    if (challenge.isWon(this)) return this.finish(true, '¡Objetivo cumplido!')
    const loss = challenge.lossReason?.(this)
    if (loss) this.finish(false, loss)
  }

  /** Sube una fila de basura (con un hueco aleatorio) desde abajo. */
  addGarbageRow(): void {
    if (this.board[0]?.some((v) => v !== 0)) return this.finish(false, 'La basura llegó arriba')
    const hole = this.randomInt(0, COLS - 1)
    const row = Array.from({ length: COLS }, (_, c) => (c === hole ? 0 : GARBAGE))
    this.board = [...this.board.slice(1), row]
    // la pieza en juego sube con el tablero si ahora se solapa
    if (this.collide(this.current.shape, this.current.x, this.current.y)) {
      this.current.y--
      if (this.collide(this.current.shape, this.current.x, this.current.y))
        return this.finish(false, 'La basura llegó arriba')
    }
    this.emit({ type: 'garbage' })
  }

  /** Rellena las `rows` filas inferiores con bloques fijos, dejando al menos 2 huecos por fila. */
  placeFixedBlocks(rows: number): void {
    for (let r = ROWS - rows; r < ROWS; r++) {
      const row = Array.from({ length: COLS }, () => (this.random() < 0.55 ? FIXED : 0))
      // Abrir huecos eligiendo solo entre celdas aún llenas: cada vuelta vacía una distinta,
      // así el bucle siempre termina (elegir una columna cualquiera podía repetirse sin fin)
      while (row.filter((v) => v === 0).length < 2) {
        const filled = row.flatMap((v, c) => (v ? [c] : []))
        const c = filled[this.randomInt(0, filled.length - 1)] ?? 0
        row[c] = 0
      }
      this.board[r] = row
    }
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
   * Único punto que decide qué piezas entran en la cola. Lo pendiente se cuela al frente
   * (pasa a ser la siguiente), con prioridad recompensa tras Tetris → power-up; lo que no
   * entra ahora se conserva para la siguiente pieza. Después se rellena la cola al final con
   * piezas aleatorias: hueca (reto) → pentominó → estándar.
   */
  private refillQueue(): void {
    if (this.pendingReward) {
      this.pendingReward = false
      this.queue.unshift(this.makePiece(SINGLE))
    } else if (this.pendingPowerUp) {
      this.pendingPowerUp = false
      this.queue.unshift(this.makePiece(this.randomInt(POWER_FIRST, POWER_LAST)))
    }
    this.fillQueue()
  }

  private fillQueue(): void {
    while (this.queue.length < QUEUE_SIZE) this.queue.push(this.randomPiece())
  }

  private randomPiece(): Piece {
    const roll = this.random()
    if (roll < HOLLOW_CHANCE) return this.makePiece(HOLLOW)
    if (roll < HOLLOW_CHANCE + PENTOMINO_CHANCE) {
      const type = PENTOMINOES[this.randomInt(0, PENTOMINOES.length - 1)] ?? PENTOMINOES[0]
      return this.makePiece(type)
    }
    return this.makePiece(this.randomInt(1, STANDARD_COUNT))
  }

  collide(shape: Shape, ox: number, oy: number, board: Board = this.board): boolean {
    let hit = false
    forEachCell(shape, (r, c) => {
      const nx = ox + c
      const ny = oy + r
      if (nx < 0 || nx >= COLS || ny >= ROWS || (ny >= 0 && board[ny]?.[nx])) hit = true
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
    this.elapsedMs += dt
    this.challenge?.tick?.(this, dt)
    this.checkChallenge()
    if (this.gameOver) return
    if (this.frozenMs > 0) {
      // Congelar: la caída automática no avanza (el jugador sí puede moverse)
      this.frozenMs = Math.max(0, this.frozenMs - dt)
    } else {
      this.dropAccum += dt
    }
    if (this.slowMs > 0) this.slowMs = Math.max(0, this.slowMs - dt)
    if (this.dropAccum >= this.effectiveDropInterval) {
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
    const rotated = this.rotationReversed
      ? rotateCCW(this.current.shape)
      : rotateCW(this.current.shape)
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
    const dropPoints = (gy - this.current.y) * 2
    this.current.y = gy
    this.lockPiece(dropPoints)
  }

  /** HOLD (tecla C): una vez por turno. Devuelve si se pudo; si no, lo avisa. */
  holdPiece(): boolean {
    if (!this.canAct) return false
    const ok = !this.holdUsed && this.swapHold()
    if (ok) this.holdUsed = true
    else this.popup('NO DISPONIBLE', '#9e9e9e')
    this.emit({ type: 'hold', ok })
    return ok
  }

  togglePause(): void {
    if (this.gameOver) return
    this.paused = !this.paused
  }

  // ---- Fijado: (T-spin) → merge → power-ups → líneas → nueva pieza ----

  /** `dropPoints`: puntos del hard drop, sumados tras el snapshot para que Deshacer los quite. */
  lockPiece(dropPoints = 0): void {
    this.takeSnapshot() // para «Deshacer»
    this.score += dropPoints
    const tspin = this.isTSpin() // antes de merge(): se evalúa sobre el tablero sin la pieza
    this.emitLock()
    this.merge()
    this.resolvePowerUp()
    this.clearLines(tspin)
    this.checkChallenge() // el objetivo se puede cumplir con este fijado
    if (!this.gameOver) this.spawn()
  }

  private emitLock(): void {
    const { type, shape, x, y } = this.current
    const cells: Cell[] = []
    forEachCell(shape, (r, c) => cells.push({ x: x + c, y: y + r }))
    this.emit({
      type: 'lock',
      cells,
      color: COLORS[type] ?? '#fff',
      vanish: this.mode === 'invisible',
    })
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
    this.current = this.queue.shift() ?? this.randomPiece()
    this.refillQueue()
    if (this.peekPieces > 0) this.peekPieces--
    this.holdUsed = false // cada pieza nueva puede usar HOLD una vez
    if (this.collide(this.current.shape, this.current.x, this.current.y)) {
      this.finish(false, 'No queda espacio para la nueva pieza')
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
    this.addEnergy(cleared * ENERGY_PER_LINE + (cleared >= 4 || tspin ? ENERGY_BONUS : 0))
    // Los comodines que queden se eliminan con cualquier limpieza de líneas (antes de
    // puntuar, para que cuenten en un posible perfect clear)
    const wild = this.removeWildcards()
    this.scoreClear(rows, tspin)
    if (wild) {
      this.score += wild * WILDCARD_SCORE * this.level
      this.popup(`COMODINES +${wild}`, COLORS[WILDCARD])
    }
    if (cleared >= 4) this.pendingReward = true
    const prevLevel = this.level
    this.level = Math.max(this.startLevel, Math.floor(this.lines / 10) + 1)
    if (this.level > prevLevel) this.onLevelUp(prevLevel)
    this.dropInterval = levelInterval(this.level)
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

  private onLevelUp(prevLevel: number): void {
    this.popup(`NIVEL ${this.level}`, '#7aa2f7')
    if (this.mode === 'reverse' && prevLevel < REVERSE_FROM_LEVEL && this.rotationReversed)
      this.popup('¡ROTACIÓN INVERSA!', '#ff8a80')
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

  // ---- Energía y habilidades ----

  private addEnergy(amount: number): void {
    if (!amount || this.energyFull) return
    this.energy = Math.min(MAX_ENERGY, this.energy + amount)
    if (this.energyFull) {
      this.popup('¡ENERGÍA LLENA! (E)', '#ffd54f')
      this.emit({ type: 'energy-full' })
    }
  }

  private takeSnapshot(): void {
    this.snapshot = {
      board: this.board.map((row) => [...row]),
      score: this.score,
      lines: this.lines,
      level: this.level,
      dropInterval: this.dropInterval,
      combo: this.combo,
      b2b: this.b2b,
      linesToPowerUp: this.linesToPowerUp,
      pendingPowerUp: this.pendingPowerUp,
      pendingReward: this.pendingReward,
      queue: this.queue.map(clonePiece),
      pieceType: this.current.type,
      hold: this.hold && clonePiece(this.hold),
    }
  }

  /**
   * Gasta la barra llena en una habilidad. Si no se puede aplicar (p. ej. no hay nada que
   * deshacer o la pieza nueva no cabe) no se gasta energía. Devuelve si se aplicó.
   */
  useSkill(id: SkillId): boolean {
    if (!this.canAct || !this.energyFull) return false
    const ok = this.applySkill(id)
    const info = skillInfo(id)
    if (ok) {
      this.energy = 0
      this.popup(info?.name.toUpperCase() ?? '', info?.color)
    } else {
      this.popup('NO DISPONIBLE', '#9e9e9e')
    }
    this.emit({ type: 'skill', id, ok })
    return ok
  }

  private applySkill(id: SkillId): boolean {
    switch (id) {
      case 'peek':
        this.peekPieces = PEEK_PIECES
        return true
      case 'swap':
        return this.swapPiece()
      case 'slow':
        this.slowMs = SLOW_MS
        return true
      case 'undo':
        return this.undo()
      case 'hold':
        // Hold extra: libera HOLD para un segundo uso en este turno (solo si ese uso cabría)
        if (!this.holdUsed || !this.holdFits) return false
        this.holdUsed = false
        return true
    }
  }

  /** Sustituye la pieza actual por otra estándar de tipo distinto, en posición de salida. */
  private swapPiece(): boolean {
    const options = Array.from({ length: STANDARD_COUNT }, (_, i) => i + 1).filter(
      (t) => t !== this.current.type,
    )
    const type = options[this.randomInt(0, options.length - 1)] ?? 1
    return this.replaceCurrent(this.makePiece(type))
  }

  /** Revierte el último fijado: tablero, puntos, cola… y esa pieza vuelve a salir. */
  private undo(): boolean {
    const s = this.snapshot
    if (!s) return false
    const piece = this.makePiece(s.pieceType)
    if (this.collide(piece.shape, piece.x, piece.y, s.board)) return false
    this.board = s.board
    this.score = s.score
    this.lines = s.lines
    this.level = s.level
    this.dropInterval = s.dropInterval
    this.combo = s.combo
    this.b2b = s.b2b
    this.linesToPowerUp = s.linesToPowerUp
    this.pendingPowerUp = s.pendingPowerUp
    this.pendingReward = s.pendingReward
    this.queue = s.queue
    this.hold = s.hold
    this.snapshot = null // un solo nivel de deshacer
    this.holdUsed = false // la pieza devuelta empieza turno nuevo
    this.setCurrent(piece)
    return true
  }

  /**
   * Guarda la pieza actual en HOLD. Si el slot estaba vacío entra la siguiente de la cola;
   * si no, se intercambia con la guardada. Las piezas vuelven a su forma de salida.
   */
  private swapHold(): boolean {
    const fromQueue = !this.hold
    const outgoing = this.makePiece(this.current.type)
    if (!this.replaceCurrent(this.holdIncoming())) return false
    this.hold = outgoing
    if (fromQueue) {
      // la pieza salió de la cola: cuenta como una pieza más, igual que en spawn()
      this.queue.shift()
      this.fillQueue()
      if (this.peekPieces > 0) this.peekPieces--
    }
    return true
  }

  /** Pieza que entraría en juego con HOLD: la guardada o, con el slot vacío, la siguiente. */
  private holdIncoming(): Piece {
    return this.hold ? this.makePiece(this.hold.type) : this.next
  }

  /** La pieza que entraría con HOLD cabe en su posición de salida. */
  get holdFits(): boolean {
    const p = this.holdIncoming()
    return !this.collide(p.shape, p.x, p.y)
  }

  /** Cambia la pieza en juego si cabe en su posición de salida (y la anuncia si es especial). */
  private replaceCurrent(piece: Piece): boolean {
    if (this.collide(piece.shape, piece.x, piece.y)) return false
    this.setCurrent(piece)
    this.announceSpecial()
    return true
  }

  private setCurrent(piece: Piece): void {
    this.current = piece
    this.dropAccum = 0
    this.lastMoveRotate = false
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
    // comodines, fijos y basura no son colores: teñirlos ganaría Bloques fijos al instante
    const tintable = (v: number | undefined) =>
      !!v && v !== WILDCARD && v !== FIXED && v !== GARBAGE
    const below = this.cell(y + 1, x)
    if (below && tintable(below)) return below
    const counts = new Map<number, number>()
    let best = 0,
      bestCount = 0
    for (const row of this.board)
      for (const v of row) {
        if (!tintable(v)) continue
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
