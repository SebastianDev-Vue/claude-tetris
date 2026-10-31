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

/** Verde fósforo del modo retro (terminal de 1984). */
export const RETRO_GREEN = '#33ff33'

/** Cómo dibujar: el canvas no lee CSS, así que el tema llega aquí ya resuelto. */
export interface RenderStyle {
  gridColor: string
  /** Modo retro: bloques `[]` monocromos, sin rejilla, sin pieza fantasma ni halos. */
  retro: boolean
}

/**
 * En retro cada celda es texto: `[]` para los bloques normales y una marca propia para los
 * que tienen significado (power-ups, comodín, basura, bloque fijo).
 */
const RETRO_GLYPHS: Readonly<Record<number, string>> = {
  [BOMB]: 'B',
  [LIGHTNING]: 'R',
  [TINT]: 'T',
  [GRAVITY]: 'G',
  [FREEZE]: 'F',
  [WILDCARD]: '**',
  [GARBAGE]: '::',
  [FIXED]: '##',
}

function drawRetroBlock(ctx: Ctx, x: number, y: number, colorIndex: number, size: number): void {
  ctx.fillStyle = RETRO_GREEN
  // dos caracteres monoespaciados (~0,6 em cada uno) llenan el ancho de la celda
  ctx.font = `bold ${Math.floor(size * 0.8)}px "Courier New", Courier, monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(RETRO_GLYPHS[colorIndex] ?? '[]', x * size + size / 2, y * size + size / 2 + 1)
}

/** Dibuja una celda. Compartido entre el tablero (BLOCK) y las vistas previas (su propio tamaño). */
export function drawBlock(
  ctx: Ctx,
  x: number,
  y: number,
  colorIndex: number,
  size: number,
  alpha = 1,
  retro = false,
): void {
  if (!colorIndex) return
  ctx.globalAlpha = alpha
  if (retro) {
    drawRetroBlock(ctx, x, y, colorIndex, size)
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

function drawPiece(ctx: Ctx, piece: Piece, y: number, retro: boolean, alpha = 1): void {
  forEachCell(piece.shape, (r, c, value) =>
    drawBlock(ctx, piece.x + c, y + r, value, BLOCK, alpha, retro),
  )
}

export function drawBoard(ctx: Ctx, game: Game, style: RenderStyle, now: number): void {
  const { retro } = style
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  if (!retro) drawGrid(ctx, style.gridColor)
  // Desafío Invisible: los bloques fijados no se ven hasta que termina la partida
  if (!game.hideLocked)
    forEachCell(game.board, (r, c, value) => drawBlock(ctx, c, r, value, BLOCK, 1, retro))
  const { current } = game
  if (!retro) drawPiece(ctx, current, game.ghostY(), false, 0.2) // en 1984 no había fantasma
  withSpecialGlow(ctx, current.type, now, retro, () => drawPiece(ctx, current, current.y, retro))
}

/** Vista previa centrada en una rejilla de `cells`×`cells`. */
export function drawPreview(
  ctx: Ctx,
  piece: Piece | null,
  size: number,
  cells: number,
  now: number,
  retro = false,
): void {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  if (!piece) return
  const { shape } = piece
  const offX = Math.floor((cells - (shape[0]?.length ?? 0)) / 2)
  const offY = Math.floor((cells - shape.length) / 2)
  withSpecialGlow(ctx, piece.type, now, retro, () =>
    forEachCell(shape, (r, c, value) => drawBlock(ctx, offX + c, offY + r, value, size, 1, retro)),
  )
}
