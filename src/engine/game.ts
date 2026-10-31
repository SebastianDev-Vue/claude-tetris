import {
  BOMB, COLORS, COLS, FREEZE, FREEZE_MS, GRAVITY, INITIAL_DROP_INTERVAL, LIGHTNING,
  LINES_PER_POWERUP, LINE_SCORES, PIECES, POWER_FIRST, POWER_LAST, POWER_NAMES, ROWS,
  STANDARD_COUNT, TINT, WILDCARD, WILDCARD_SCORE, isPowerUp,
} from './constants';

export type Board = number[][];
export type Shape = number[][];

export interface Piece {
  type: number;
  shape: Shape;
  x: number;
  y: number;
}

/** Eventos visuales que el motor emite; la capa de render decide cómo mostrarlos. */
export type GameEvent = { type: 'popup'; text: string; color: string };

export interface GameOptions {
  /** Generador aleatorio en [0, 1); inyectable para tests deterministas. */
  random?: () => number;
  onEvent?: (event: GameEvent) => void;
}

export function createBoard(): Board {
  return Array.from({ length: ROWS }, () => new Array<number>(COLS).fill(0));
}

/** Rotación horaria: transposición + reverso (no es SRS). */
export function rotateCW(shape: Shape): Shape {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array<number>(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

const KICKS = [0, -1, 1, -2, 2];

/**
 * Estado y reglas del juego, sin DOM ni temporizadores: quien lo usa llama a update(dt)
 * en cada frame y a los métodos de input. Todo el estado se reinicia en reset().
 */
export class Game {
  board!: Board;
  current!: Piece;
  next!: Piece;
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = INITIAL_DROP_INTERVAL;
  dropAccum = 0;
  linesToPowerUp = LINES_PER_POWERUP;
  pendingPowerUp = false;
  /** Tiempo restante de Congelar; solo baja dentro de update(), así que la pausa lo conserva. */
  frozenMs = 0;

  private readonly random: () => number;
  private readonly emit: (event: GameEvent) => void;

  constructor(options: GameOptions = {}) {
    this.random = options.random ?? Math.random;
    this.emit = options.onEvent ?? (() => {});
    this.reset();
  }

  /** Único camino de reinicio. */
  reset(): void {
    this.board = createBoard();
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.paused = false;
    this.gameOver = false;
    this.dropInterval = INITIAL_DROP_INTERVAL;
    this.dropAccum = 0;
    this.linesToPowerUp = LINES_PER_POWERUP;
    this.pendingPowerUp = false;
    this.frozenMs = 0;
    this.next = this.pickNextPiece();
    this.spawn();
  }

  // ---- Piezas ----

  makePiece(type: number): Piece {
    const template = PIECES[type];
    if (!template) throw new Error(`El tipo ${type} no es una pieza jugable`);
    const shape = template.map(row => [...row]);
    return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
  }

  private randomInt(min: number, max: number): number {
    return min + Math.floor(this.random() * (max - min + 1));
  }

  /** Único punto que decide qué pieza entra en la cola. */
  private pickNextPiece(): Piece {
    if (this.pendingPowerUp) {
      this.pendingPowerUp = false;
      return this.makePiece(this.randomInt(POWER_FIRST, POWER_LAST));
    }
    return this.makePiece(this.randomInt(1, STANDARD_COUNT));
  }

  collide(shape: Shape, ox: number, oy: number): boolean {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const nx = ox + c;
        const ny = oy + r;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && this.board[ny][nx]) return true;
      }
    }
    return false;
  }

  ghostY(): number {
    let gy = this.current.y;
    while (!this.collide(this.current.shape, this.current.x, gy + 1)) gy++;
    return gy;
  }

  private get canAct(): boolean {
    return !this.paused && !this.gameOver;
  }

  // ---- Bucle ----

  /** Avanza el juego dt milisegundos. No hace nada en pausa o tras game over. */
  update(dt: number): void {
    if (!this.canAct) return;
    if (this.frozenMs > 0) {
      // Congelar: la caída automática no avanza (el jugador sí puede moverse)
      this.frozenMs = Math.max(0, this.frozenMs - dt);
    } else {
      this.dropAccum += dt;
    }
    if (this.dropAccum >= this.dropInterval) {
      this.dropAccum = 0;
      if (!this.collide(this.current.shape, this.current.x, this.current.y + 1)) {
        this.current.y++;
      } else {
        this.lockPiece();
      }
    }
  }

  // ---- Input ----

  moveLeft(): void {
    if (this.canAct && !this.collide(this.current.shape, this.current.x - 1, this.current.y)) this.current.x--;
  }

  moveRight(): void {
    if (this.canAct && !this.collide(this.current.shape, this.current.x + 1, this.current.y)) this.current.x++;
  }

  rotate(): void {
    if (!this.canAct) return;
    const rotated = rotateCW(this.current.shape);
    for (const kick of KICKS) {
      if (!this.collide(rotated, this.current.x + kick, this.current.y)) {
        this.current.shape = rotated;
        this.current.x += kick;
        return;
      }
    }
  }

  softDrop(): void {
    if (!this.canAct) return;
    if (!this.collide(this.current.shape, this.current.x, this.current.y + 1)) {
      this.current.y++;
      this.score += 1;
    } else {
      this.lockPiece();
    }
  }

  hardDrop(): void {
    if (!this.canAct) return;
    const gy = this.ghostY();
    this.score += (gy - this.current.y) * 2;
    this.current.y = gy;
    this.lockPiece();
  }

  togglePause(): void {
    if (this.gameOver) return;
    this.paused = !this.paused;
  }

  // ---- Fijado: merge → power-ups → líneas → nueva pieza ----

  lockPiece(): void {
    this.merge();
    this.resolvePowerUp();
    this.clearLines();
    this.spawn();
  }

  private merge(): void {
    const { shape, x, y } = this.current;
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++)
        if (shape[r][c]) this.board[y + r][x + c] = shape[r][c];
  }

  private spawn(): void {
    this.current = this.next;
    this.next = this.pickNextPiece();
    if (this.collide(this.current.shape, this.current.x, this.current.y)) {
      this.gameOver = true;
    }
  }

  private clearLines(): void {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (this.board[r].every(v => v !== 0)) {
        this.board.splice(r, 1);
        this.board.unshift(new Array<number>(COLS).fill(0));
        cleared++;
        r++;
      }
    }
    if (!cleared) return;

    this.lines += cleared;
    this.score += (LINE_SCORES[cleared] ?? 0) * this.level;
    // Los comodines que queden se eliminan con cualquier limpieza de líneas
    const wild = this.removeWildcards();
    if (wild) {
      this.score += wild * WILDCARD_SCORE * this.level;
      this.popup(`COMODINES +${wild}`, WILDCARD);
    }
    this.level = Math.floor(this.lines / 10) + 1;
    this.dropInterval = Math.max(100, INITIAL_DROP_INTERVAL - (this.level - 1) * 90);
    this.linesToPowerUp -= cleared;
    if (this.linesToPowerUp <= 0) {
      this.linesToPowerUp += LINES_PER_POWERUP;
      this.pendingPowerUp = true;
    }
  }

  private removeWildcards(): number {
    let count = 0;
    for (const row of this.board)
      for (let c = 0; c < COLS; c++)
        if (row[c] === WILDCARD) { row[c] = 0; count++; }
    return count;
  }

  // ---- Power-ups ----

  /** Se llama tras merge(): consume los bloques especiales de la pieza recién fijada. */
  private resolvePowerUp(): void {
    const { shape, x, y } = this.current;
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        const v = shape[r][c];
        if (!isPowerUp(v)) continue;
        this.board[y + r][x + c] = 0;
        this.applyPowerUp(v, x + c, y + r);
        this.popup(POWER_NAMES[v], v);
      }
    }
  }

  private applyPowerUp(type: number, x: number, y: number): void {
    const b = this.board;
    switch (type) {
      case BOMB: // vacía el área 3×3 centrada en el bloque
        for (let r = y - 1; r <= y + 1; r++)
          for (let c = x - 1; c <= x + 1; c++)
            if (r >= 0 && r < ROWS && c >= 0 && c < COLS) b[r][c] = 0;
        break;
      case LIGHTNING: // vacía su fila y su columna
        b[y].fill(0);
        for (let r = 0; r < ROWS; r++) b[r][x] = 0;
        break;
      case TINT: { // un color entero pasa a comodín
        const color = this.tintTargetColor(x, y);
        if (!color) break;
        for (const row of b)
          for (let c = 0; c < COLS; c++)
            if (row[c] === color) row[c] = WILDCARD;
        break;
      }
      case GRAVITY: // cada columna cae hasta compactar los huecos
        for (let c = 0; c < COLS; c++) {
          const filled: number[] = [];
          for (let r = 0; r < ROWS; r++) if (b[r][c]) filled.push(b[r][c]);
          for (let r = ROWS - 1; r >= 0; r--) b[r][c] = filled.pop() ?? 0;
        }
        break;
      case FREEZE: // sin caída automática durante FREEZE_MS
        this.frozenMs = FREEZE_MS;
        break;
    }
  }

  /** Color del bloque sobre el que cae el Tinte; si no hay, el más abundante del tablero. */
  private tintTargetColor(x: number, y: number): number {
    const below = y + 1 < ROWS ? this.board[y + 1][x] : 0;
    if (below && below !== WILDCARD) return below;
    const counts = new Map<number, number>();
    let best = 0, bestCount = 0;
    for (const row of this.board)
      for (const v of row) {
        if (!v || v === WILDCARD) continue;
        const n = (counts.get(v) ?? 0) + 1;
        counts.set(v, n);
        if (n > bestCount) { best = v; bestCount = n; }
      }
    return best;
  }

  private popup(text: string, colorIndex: number): void {
    this.emit({ type: 'popup', text, color: COLORS[colorIndex] ?? '#fff' });
  }
}
