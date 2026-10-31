import {
  BLOCK,
  BOMB,
  CELL_ICONS,
  COLORS,
  COLS,
  FIXED,
  FREEZE,
  GARBAGE,
  GRAVITY,
  LIGHTNING,
  ROWS,
  TINT,
  WILDCARD,
  specialKind,
} from '../engine/constants'
import { forEachCell, type Game, type Piece } from '../engine/game'

type Ctx = CanvasRenderingContext2D

/** Fuente bitmap del modo retro (cargada en main.ts). */
export const RETRO_FONT = '"Press Start 2P", monospace'

/** Cómo dibujar: el canvas no lee CSS, así que el tema llega aquí ya resuelto. */
export interface RenderStyle {
  gridColor: string
  /** Modo retro: bloques 8-bit con la paleta del nivel, sin rejilla, fantasma ni halos. */
  retro: boolean
}

/**
 * Paletas 8-bit propias: tres colores por nivel, que rotan cada 10 niveles.
 * Cada pieza toma uno según su tipo, así que todo el tablero cambia de color al subir de nivel.
 */
const RETRO_PALETTES: readonly (readonly [string, string, string])[] = [
  ['#e04040', '#40a0f0', '#f0c020'],
  ['#30c060', '#f07830', '#a050e0'],
  ['#f04890', '#30d0d0', '#f0e040'],
  ['#5060f0', '#f0a020', '#60d040'],
  ['#d03030', '#e0e0e0', '#3070d0'],
  ['#20b0a0', '#f05050', '#f0d070'],
  ['#9040d0', '#40c0f0', '#f08040'],
  ['#e0a000', '#30a050', '#d04080'],
  ['#f07060', '#7080f0', '#b0e040'],
  ['#40d090', '#e050e0', '#f0f070'],
]

/** Paleta del nivel (1 = la primera). */
export function retroPalette(level: number): readonly [string, string, string] {
  return RETRO_PALETTES[(Math.max(1, level) - 1) % RETRO_PALETTES.length]!
}

/** Celdas con color fijo en retro (no dependen del nivel). */
const RETRO_FIXED_COLORS: Readonly<Record<number, string>> = {
  [WILDCARD]: '#fcfcfc',
  [GARBAGE]: '#7c7c7c',
  [FIXED]: '#4c4c4c',
}

/** Letra encima de los power-ups y el comodín, para distinguirlos sin emojis. */
const RETRO_GLYPHS: Readonly<Record<number, string>> = {
  [BOMB]: 'B',
  [LIGHTNING]: 'R',
  [TINT]: 'T',
  [GRAVITY]: 'G',
  [FREEZE]: 'F',
  [WILDCARD]: '*',
}

/** Color retro de una celda según el nivel. */
export function retroColor(colorIndex: number, level: number): string {
  return RETRO_FIXED_COLORS[colorIndex] ?? retroPalette(level)[(colorIndex - 1) % 3]!
}

/**
 * Bloque en píxeles: la celda es una rejilla de ~10×10 "píxeles" gruesos con contorno negro,
 * luz arriba/izquierda, sombra abajo/derecha y un destello en la esquina.
 */
function drawRetroBlock(
  ctx: Ctx,
  x: number,
  y: number,
  colorIndex: number,
  size: number,
  level: number,
): void {
  const u = Math.max(1, Math.floor(size / 10)) // tamaño de un píxel 8-bit
  const px = x * size
  const py = y * size
  const inner = size - 2 * u
  ctx.fillStyle = '#000'
  ctx.fillRect(px, py, size, size)
  ctx.fillStyle = retroColor(colorIndex, level)
  ctx.fillRect(px + u, py + u, inner, inner)
  ctx.fillStyle = 'rgba(255,255,255,0.45)'
  ctx.fillRect(px + u, py + u, inner, u)
  ctx.fillRect(px + u, py + 2 * u, u, inner - u)
  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  ctx.fillRect(px + 2 * u, py + size - 2 * u, inner - u, u)
  ctx.fillRect(px + size - 2 * u, py + 2 * u, u, inner - 2 * u)
  ctx.fillStyle = '#fff'
  ctx.fillRect(px + 2 * u, py + 2 * u, u, u)
  const glyph = RETRO_GLYPHS[colorIndex]
  if (glyph) {
    ctx.fillStyle = '#000'
    ctx.font = `${Math.floor(size * 0.4)}px ${RETRO_FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(glyph, px + size / 2, py + size / 2 + u / 2)
  }
}

/** Dibuja una celda. Compartido entre el tablero (BLOCK) y las vistas previas (su propio tamaño). */
export function drawBlock(
  ctx: Ctx,
  x: number,
  y: number,
  colorIndex: number,
  size: number,
  alpha = 1,
  /** Nivel para la paleta 8-bit; 0 = modo normal. */
  retroLevel = 0,
): void {
  if (!colorIndex) return
  ctx.globalAlpha = alpha
  if (retroLevel) {
    drawRetroBlock(ctx, x, y, colorIndex, size, retroLevel)
    ctx.globalAlpha = 1
    return
  }
  ctx.fillStyle = COLORS[colorIndex] ?? '#fff'
  ctx.fillRect(x * size + 1, y * size + 1, size - 2, size - 2)
  // highlight
  ctx.fillStyle = 'rgba(255,255,255,0.12)'
  ctx.fillRect(x * size + 1, y * size + 1, size - 2, 4)
  // icono de power-up / comodín
  const icon = CELL_ICONS[colorIndex]
  if (icon) {
    ctx.fillStyle = colorIndex === WILDCARD ? '#f9a825' : '#1a1a25'
    ctx.font = `${Math.floor(size * 0.6)}px system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(icon, x * size + size / 2, y * size + size / 2 + 1)
  }
  ctx.globalAlpha = 1
}

function drawGrid(ctx: Ctx, gridColor: string): void {
  ctx.strokeStyle = gridColor
  ctx.lineWidth = 0.5
  ctx.beginPath()
  for (let c = 1; c < COLS; c++) {
    ctx.moveTo(c * BLOCK, 0)
    ctx.lineTo(c * BLOCK, ROWS * BLOCK)
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.moveTo(0, r * BLOCK)
    ctx.lineTo(COLS * BLOCK, r * BLOCK)
  }
  ctx.stroke()
}

/**
 * Ejecuta `draw` con un halo pulsante del color de la pieza si es especial
 * (pentominó, reto o recompensa); si no (o en retro), dibuja sin más.
 */
function withSpecialGlow(
  ctx: Ctx,
  type: number,
  now: number,
  retro: boolean,
  draw: () => void,
): void {
  if (retro || !specialKind(type)) return draw()
  ctx.save()
  ctx.shadowColor = COLORS[type] ?? '#fff'
  ctx.shadowBlur = 10 + 6 * Math.sin(now / 160)
  draw()
  ctx.restore()
}

function drawPiece(ctx: Ctx, piece: Piece, y: number, retroLevel: number, alpha = 1): void {
  forEachCell(piece.shape, (r, c, value) =>
    drawBlock(ctx, piece.x + c, y + r, value, BLOCK, alpha, retroLevel),
  )
}

export function drawBoard(ctx: Ctx, game: Game, style: RenderStyle, now: number): void {
  const { retro } = style
  const lv = retro ? game.level : 0
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  if (!retro) drawGrid(ctx, style.gridColor)
  // Desafío Invisible: los bloques fijados no se ven hasta que termina la partida
  if (!game.hideLocked)
    forEachCell(game.board, (r, c, value) => drawBlock(ctx, c, r, value, BLOCK, 1, lv))
  const { current } = game
  if (!retro) drawPiece(ctx, current, game.ghostY(), 0, 0.2) // en 8-bit no hay fantasma
  withSpecialGlow(ctx, current.type, now, retro, () => drawPiece(ctx, current, current.y, lv))
}

/** Vista previa centrada en una rejilla de `cells`×`cells`. */
export function drawPreview(
  ctx: Ctx,
  piece: Piece | null,
  size: number,
  cells: number,
  now: number,
  /** Nivel para la paleta 8-bit; 0 = modo normal. */
  retroLevel = 0,
): void {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  if (!piece) return
  const { shape } = piece
  const offX = Math.floor((cells - (shape[0]?.length ?? 0)) / 2)
  const offY = Math.floor((cells - shape.length) / 2)
  withSpecialGlow(ctx, piece.type, now, retroLevel > 0, () =>
    forEachCell(shape, (r, c, value) =>
      drawBlock(ctx, offX + c, offY + r, value, size, 1, retroLevel),
    ),
  )
}
