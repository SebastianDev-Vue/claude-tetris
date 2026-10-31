export const COLS = 10
export const ROWS = 20
/** Tamaño en píxeles de cada celda del tablero (el canvas mide COLS*BLOCK × ROWS*BLOCK). */
export const BLOCK = 30

/**
 * El tipo de pieza es también su índice de color: las formas de PIECES se rellenan con su
 * propio tipo y esos valores se copian tal cual al tablero. 0 = celda vacía.
 * Ampliar COLORS y PIECES siempre juntos y añadiendo al final.
 */
export const COLORS: readonly (string | null)[] = [
  null,
  '#4dd0e1', // 1  I - cyan
  '#ffd54f', // 2  O - yellow
  '#ba68c8', // 3  T - purple
  '#81c784', // 4  S - green
  '#e57373', // 5  Z - red
  '#90caf9', // 6  J - azul pálido
  '#ffb74d', // 7  L - orange
  '#ff7043', // 8  power-up: Bomba
  '#fff176', // 9  power-up: Rayo
  '#f06292', // 10 power-up: Tinte
  '#7986cb', // 11 power-up: Gravedad
  '#b3e5fc', // 12 power-up: Congelar
  '#e0e0e0', // 13 comodín (creado por Tinte)
  '#4db6ac', // 14 pentominó +
  '#dce775', // 15 pentominó U
  '#9575cd', // 16 pentominó Y
  '#ffd700', // 17 single (recompensa tras un Tetris)
  '#a1887f', // 18 hueca 3×3 (reto)
]

export const PIECES: readonly (readonly (readonly number[])[] | null)[] = [
  null,
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ], // I
  [
    [2, 2],
    [2, 2],
  ], // O
  [
    [0, 3, 0],
    [3, 3, 3],
    [0, 0, 0],
  ], // T
  [
    [0, 4, 4],
    [4, 4, 0],
    [0, 0, 0],
  ], // S
  [
    [5, 5, 0],
    [0, 5, 5],
    [0, 0, 0],
  ], // Z
  [
    [6, 0, 0],
    [6, 6, 6],
    [0, 0, 0],
  ], // J
  [
    [0, 0, 7],
    [7, 7, 7],
    [0, 0, 0],
  ], // L
  [[8]], // Bomba
  [[9]], // Rayo
  [[10]], // Tinte
  [[11]], // Gravedad
  [[12]], // Congelar
  null, // 13 comodín: solo existe en el tablero
  [
    [0, 14, 0],
    [14, 14, 14],
    [0, 14, 0],
  ], // pentominó +
  [
    [15, 0, 15],
    [15, 15, 15],
    [0, 0, 0],
  ], // pentominó U
  [
    [0, 0, 0, 0],
    [16, 16, 16, 16],
    [0, 16, 0, 0],
    [0, 0, 0, 0],
  ], // pentominó Y
  [[17]], // single
  [
    [18, 18, 18],
    [18, 0, 18],
    [18, 18, 18],
  ], // hueca 3×3
]

export const STANDARD_COUNT = 7
export const LINE_SCORES = [0, 100, 300, 500, 800]
export const INITIAL_DROP_INTERVAL = 1000

// Power-ups: piezas 1×1 que se consumen al fijarse y aplican un efecto
export const POWER_FIRST = 8
export const POWER_LAST = 12
export const BOMB = 8
export const LIGHTNING = 9
export const TINT = 10
export const GRAVITY = 11
export const FREEZE = 12
export const WILDCARD = 13

export const POWER_NAMES: Readonly<Record<number, string>> = {
  [BOMB]: 'BOMBA',
  [LIGHTNING]: 'RAYO',
  [TINT]: 'TINTE',
  [GRAVITY]: 'GRAVEDAD',
  [FREEZE]: 'CONGELAR',
}

export const CELL_ICONS: Readonly<Record<number, string>> = {
  [BOMB]: '💣',
  [LIGHTNING]: '⚡',
  [TINT]: '🎨',
  [GRAVITY]: '⬇',
  [FREEZE]: '❄',
  [WILDCARD]: '★',
}

export const LINES_PER_POWERUP = 8
export const FREEZE_MS = 5000
export const WILDCARD_SCORE = 50

export const isPowerUp = (v: number): boolean => v >= POWER_FIRST && v <= POWER_LAST

// Piezas no estándar
export const PLUS = 14
export const U_PIECE = 15
export const Y_PIECE = 16
export const SINGLE = 17
export const HOLLOW = 18
export const PENTOMINOES = [PLUS, U_PIECE, Y_PIECE] as const
/** Probabilidad de que la siguiente pieza sea un pentominó (+, U o Y). */
export const PENTOMINO_CHANCE = 0.1
/** Probabilidad de la pieza hueca 3×3 («reto»); se evalúa antes que la de pentominó. */
export const HOLLOW_CHANCE = 0.04

export type SpecialKind = 'pentomino' | 'challenge' | 'reward'

/** Qué tipo de pieza especial es (o null si es estándar / power-up). */
export function specialKind(type: number): SpecialKind | null {
  if (type === SINGLE) return 'reward'
  if (type === HOLLOW) return 'challenge'
  if ((PENTOMINOES as readonly number[]).includes(type)) return 'pentomino'
  return null
}

export const SPECIAL_NAMES: Readonly<Record<SpecialKind, string>> = {
  pentomino: 'PENTOMINÓ',
  challenge: '¡RETO!',
  reward: 'RECOMPENSA',
}

// Combos y bonificaciones
export const T_PIECE = 3
/** Puntos base de un T-spin según las líneas que limpia (0–3), multiplicados por el nivel. */
export const TSPIN_SCORES = [400, 800, 1200, 1600]
/** Multiplicador máximo del combo (x2, x3… hasta este valor). */
export const MAX_COMBO_MULTIPLIER = 10
/** Bonificación Back-to-Back: Tetris o T-spin con líneas encadenados. */
export const B2B_MULTIPLIER = 1.5
export const PERFECT_CLEAR_SCORE = 3000

export const CLEAR_NAMES = ['', 'SINGLE', 'DOUBLE', 'TRIPLE', 'TETRIS']
