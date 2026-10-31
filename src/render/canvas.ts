import { BLOCK, CELL_ICONS, COLORS, COLS, ROWS, WILDCARD } from '../engine/constants'
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

function drawPiece(ctx: Ctx, piece: Piece, y: number, alpha = 1): void {
  forEachCell(piece.shape, (r, c, value) => drawBlock(ctx, piece.x + c, y + r, value, BLOCK, alpha))
}

export function drawBoard(ctx: Ctx, game: Game, gridColor: string): void {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  drawGrid(ctx, gridColor)
  forEachCell(game.board, (r, c, value) => drawBlock(ctx, c, r, value, BLOCK))
  drawPiece(ctx, game.current, game.ghostY(), 0.2)
  drawPiece(ctx, game.current, game.current.y)
}

/** Vista previa centrada en una rejilla de `cells`×`cells`. */
export function drawPreview(ctx: Ctx, piece: Piece | null, size: number, cells = 4): void {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  if (!piece) return
  const { shape } = piece
  const offX = Math.floor((cells - (shape[0]?.length ?? 0)) / 2)
  const offY = Math.floor((cells - shape.length) / 2)
  forEachCell(shape, (r, c, value) => drawBlock(ctx, offX + c, offY + r, value, size))
}

// ---- Popups de texto flotante sobre el tablero ----

interface Popup {
  text: string
  color: string
  born: number
}

export class PopupLayer {
  private items: Popup[] = []

  constructor(private readonly duration = 1200) {}

  add(text: string, color: string, now: number): void {
    this.items.push({ text, color, born: now })
  }

  clear(): void {
    this.items = []
  }

  draw(ctx: Ctx, now: number): void {
    this.items = this.items.filter((p) => now - p.born < this.duration)
    if (!this.items.length) return
    const { width, height } = ctx.canvas
    ctx.save()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = 'bold 22px system-ui, sans-serif'
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'
    ctx.lineWidth = 3
    this.items.forEach((p, i) => {
      const t = (now - p.born) / this.duration
      const y = height / 2 - 40 * t + i * 28
      ctx.globalAlpha = 1 - t
      ctx.fillStyle = p.color
      ctx.strokeText(p.text, width / 2, y)
      ctx.fillText(p.text, width / 2, y)
    })
    ctx.restore()
  }
}
