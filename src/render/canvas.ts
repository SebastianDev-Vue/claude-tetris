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

/**
 * Aspecto de los bloques. 'retro' = cuadrados de color plano (el clásico),
 * '8bit' = bloques en píxeles con la paleta del nivel, sin rejilla, fantasma ni halos.
 */
export type Skin = 'retro' | 'neon' | 'pastel' | 'pixel' | '8bit'

export const SKINS: readonly Skin[] = ['retro', 'neon', 'pastel', 'pixel', '8bit']

/** Cómo dibujar: el canvas no lee CSS, así que el tema llega aquí ya resuelto. */
export interface RenderStyle {
  gridColor: string
  skin: Skin
}

/** Mezcla un color #rrggbb con blanco (`amount` 0..1). */
export function lighten(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16)
  const mix = (v: number) => Math.round(v + (255 - v) * amount)
  return `rgb(${mix(n >> 16)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`
}

/** Color pastel de una celda: el de la pieza aclarado. */
export function pastelColor(colorIndex: number): string {
  return lighten(COLORS[colorIndex] ?? '#ffffff', 0.45)
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

/** Neón: interior oscuro translúcido y borde brillante con halo (shadowBlur) del color de la pieza. */
function drawNeonBlock(ctx: Ctx, px: number, py: number, color: string, size: number): void {
  ctx.save()
  ctx.fillStyle = color + '33'
  ctx.fillRect(px + 2, py + 2, size - 4, size - 4)
  ctx.shadowColor = color
  ctx.shadowBlur = size / 2
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.strokeRect(px + 3, py + 3, size - 6, size - 6)
  ctx.restore()
}

/** Pastel: color aclarado en un rectángulo redondeado con borde suave. */
function drawPastelBlock(ctx: Ctx, px: number, py: number, colorIndex: number, size: number): void {
  const s = size - 3
  ctx.fillStyle = pastelColor(colorIndex)
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'
  ctx.lineWidth = 1
  ctx.beginPath()
  // roundRect no existe en navegadores antiguos: rectángulo normal en su lugar
  if (typeof ctx.roundRect === 'function') ctx.roundRect(px + 1.5, py + 1.5, s, s, size / 4)
  else ctx.rect(px + 1.5, py + 1.5, s, s)
  ctx.fill()
  ctx.stroke()
}

/** Pixel art: color plano con una textura de tablero de ajedrez (dither) encima. */
function drawPixelBlock(ctx: Ctx, px: number, py: number, color: string, size: number): void {
  const inner = size - 2
  ctx.fillStyle = color
  ctx.fillRect(px + 1, py + 1, inner, inner)
  const u = Math.max(2, Math.floor(size / 6)) // tamaño de un "píxel" de la textura
  ctx.fillStyle = 'rgba(0,0,0,0.18)'
  for (let j = 0; j * u < inner; j++)
    for (let i = j % 2; i * u < inner; i += 2)
      ctx.fillRect(
        px + 1 + i * u,
        py + 1 + j * u,
        Math.min(u, inner - i * u),
        Math.min(u, inner - j * u),
      )
}

/** Dibuja una celda. Compartido entre el tablero (BLOCK) y las vistas previas (su propio tamaño). */
export function drawBlock(
  ctx: Ctx,
  x: number,
  y: number,
  colorIndex: number,
  size: number,
  alpha = 1,
  skin: Skin = 'retro',
  /** Nivel para la paleta 8-bit. */
  level = 1,
): void {
  if (!colorIndex) return
  ctx.globalAlpha = alpha
  if (skin === '8bit') {
    drawRetroBlock(ctx, x, y, colorIndex, size, level)
    ctx.globalAlpha = 1
    return
  }
  const px = x * size
  const py = y * size
  const color = COLORS[colorIndex] ?? '#ffffff'
  if (skin === 'neon') drawNeonBlock(ctx, px, py, color, size)
  else if (skin === 'pastel') drawPastelBlock(ctx, px, py, colorIndex, size)
  else if (skin === 'pixel') drawPixelBlock(ctx, px, py, color, size)
  else {
    ctx.fillStyle = color
    ctx.fillRect(px + 1, py + 1, size - 2, size - 2)
    // brillo superior
    ctx.fillStyle = 'rgba(255,255,255,0.12)'
    ctx.fillRect(px + 1, py + 1, size - 2, 4)
  }
  // icono de power-up / comodín
  const icon = CELL_ICONS[colorIndex]
  if (icon) {
    ctx.fillStyle = colorIndex === WILDCARD ? '#f9a825' : '#1a1a25'
    ctx.font = `${Math.floor(size * 0.6)}px system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(icon, px + size / 2, py + size / 2 + 1)
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

function drawPiece(ctx: Ctx, piece: Piece, y: number, skin: Skin, level: number, alpha = 1): void {
  forEachCell(piece.shape, (r, c, value) =>
    drawBlock(ctx, piece.x + c, y + r, value, BLOCK, alpha, skin, level),
  )
}

export function drawBoard(ctx: Ctx, game: Game, style: RenderStyle, now: number): void {
  const { skin } = style
  const retro = skin === '8bit'
  const lv = game.level
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  if (!retro) drawGrid(ctx, style.gridColor)
  // Desafío Invisible: los bloques fijados no se ven hasta que termina la partida
  if (!game.hideLocked)
    forEachCell(game.board, (r, c, value) => drawBlock(ctx, c, r, value, BLOCK, 1, skin, lv))
  const { current } = game
  if (!retro) drawPiece(ctx, current, game.ghostY(), skin, lv, 0.2) // en 8-bit no hay fantasma
  withSpecialGlow(ctx, current.type, now, retro, () => drawPiece(ctx, current, current.y, skin, lv))
}

/** Vista previa centrada en una rejilla de `cells`×`cells`. */
export function drawPreview(
  ctx: Ctx,
  piece: Piece | null,
  size: number,
  cells: number,
  now: number,
  skin: Skin = 'retro',
  /** Nivel para la paleta 8-bit. */
  level = 1,
): void {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  if (!piece) return
  const { shape } = piece
  const offX = Math.floor((cells - (shape[0]?.length ?? 0)) / 2)
  const offY = Math.floor((cells - shape.length) / 2)
  withSpecialGlow(ctx, piece.type, now, skin === '8bit', () =>
    forEachCell(shape, (r, c, value) =>
      drawBlock(ctx, offX + c, offY + r, value, size, 1, skin, level),
    ),
  )
}
