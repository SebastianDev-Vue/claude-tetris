import { BLOCK, CELL_ICONS, COLORS, COLS, ROWS, WILDCARD, specialKind } from '../engine/constants'
import { forEachCell, type Game, type Piece } from '../engine/game'

type Ctx = CanvasRenderingContext2D

/** Dibuja una celda. Compartido entre el tablero (BLOCK) y las vistas previas (su propio tamaño). */
export function drawBlock(
  ctx: Ctx,
  x: number,
  y: number,
  colorIndex: number,
  size: number,
  alpha = 1,
): void {
  if (!colorIndex) return
  ctx.globalAlpha = alpha
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
 * (pentominó, reto o recompensa); si no, dibuja sin más.
 */
function withSpecialGlow(ctx: Ctx, type: number, now: number, draw: () => void): void {
  if (!specialKind(type)) return draw()
  ctx.save()
  ctx.shadowColor = COLORS[type] ?? '#fff'
  ctx.shadowBlur = 10 + 6 * Math.sin(now / 160)
  draw()
  ctx.restore()
}

function drawPiece(ctx: Ctx, piece: Piece, y: number, alpha = 1): void {
  forEachCell(piece.shape, (r, c, value) => drawBlock(ctx, piece.x + c, y + r, value, BLOCK, alpha))
}

export function drawBoard(ctx: Ctx, game: Game, gridColor: string, now: number): void {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  drawGrid(ctx, gridColor)
  // Desafío Invisible: los bloques fijados no se ven hasta que termina la partida
  if (!game.hideLocked) forEachCell(game.board, (r, c, value) => drawBlock(ctx, c, r, value, BLOCK))
  const { current } = game
  drawPiece(ctx, current, game.ghostY(), 0.2)
  withSpecialGlow(ctx, current.type, now, () => drawPiece(ctx, current, current.y))
}

/** Vista previa centrada en una rejilla de `cells`×`cells`. */
export function drawPreview(
  ctx: Ctx,
  piece: Piece | null,
  size: number,
  cells: number,
  now: number,
): void {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  if (!piece) return
  const { shape } = piece
  const offX = Math.floor((cells - (shape[0]?.length ?? 0)) / 2)
  const offY = Math.floor((cells - shape.length) / 2)
  withSpecialGlow(ctx, piece.type, now, () =>
    forEachCell(shape, (r, c, value) => drawBlock(ctx, offX + c, offY + r, value, size)),
  )
}
