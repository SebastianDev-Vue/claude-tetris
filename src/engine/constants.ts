export const COLS = 10;
export const ROWS = 20;
/** Tamaño en píxeles de cada celda del tablero (el canvas mide COLS*BLOCK × ROWS*BLOCK). */
export const BLOCK = 30;

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
];

export const PIECES: readonly (readonly (readonly number[])[] | null)[] = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8]],                                       // Bomba
  [[9]],                                       // Rayo
  [[10]],                                      // Tinte
  [[11]],                                      // Gravedad
  [[12]],                                      // Congelar
  null,                                        // 13 comodín: solo existe en el tablero
];

export const STANDARD_COUNT = 7;
export const LINE_SCORES = [0, 100, 300, 500, 800];
export const INITIAL_DROP_INTERVAL = 1000;

// Power-ups: piezas 1×1 que se consumen al fijarse y aplican un efecto
export const POWER_FIRST = 8;
export const POWER_LAST = 12;
export const BOMB = 8;
export const LIGHTNING = 9;
export const TINT = 10;
export const GRAVITY = 11;
export const FREEZE = 12;
export const WILDCARD = 13;

export const POWER_NAMES: Readonly<Record<number, string>> = {
  [BOMB]: 'BOMBA',
  [LIGHTNING]: 'RAYO',
  [TINT]: 'TINTE',
  [GRAVITY]: 'GRAVEDAD',
  [FREEZE]: 'CONGELAR',
};

export const CELL_ICONS: Readonly<Record<number, string>> = {
  [BOMB]: '💣',
  [LIGHTNING]: '⚡',
  [TINT]: '🎨',
  [GRAVITY]: '⬇',
  [FREEZE]: '❄',
  [WILDCARD]: '★',
};

export const LINES_PER_POWERUP = 8;
export const FREEZE_MS = 5000;
export const WILDCARD_SCORE = 50;

export const isPowerUp = (v: number): boolean => v >= POWER_FIRST && v <= POWER_LAST;
