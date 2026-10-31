import { BLOCK, COLORS, COLS, ROWS, T_PIECE } from '../engine/constants'
import type { Cell, GameEvent } from '../engine/game'
import { skillInfo } from '../engine/skills'

type Ctx = CanvasRenderingContext2D

/** Centro en píxeles de una celda del tablero. */
const center = (cell: Cell) => ({ x: (cell.x + 0.5) * BLOCK, y: (cell.y + 0.5) * BLOCK })

// ---- Popups de texto flotante ----

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

  /** `tint`: color único que sustituye a todos (modo retro: un color de la paleta del nivel). */
  draw(ctx: Ctx, now: number, tint: string | null = null): void {
    this.items = this.items.filter((p) => now - p.born < this.duration)
    if (!this.items.length) return
    const { width, height } = ctx.canvas
    ctx.save()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = tint ? '14px "Press Start 2P", monospace' : 'bold 22px system-ui, sans-serif'
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'
    ctx.lineWidth = 3
    this.items.forEach((p, i) => {
      const t = (now - p.born) / this.duration
      // entra con un pequeño "pop" de escala y sube mientras se desvanece
      const scale = t < 0.15 ? 0.6 + (t / 0.15) * 0.4 : 1
      const y = height / 2 - 40 * t + i * 28
      ctx.globalAlpha = 1 - t
      ctx.fillStyle = tint ?? p.color
      ctx.setTransform(scale, 0, 0, scale, width / 2, y)
      ctx.strokeText(p.text, 0, 0)
      ctx.fillText(p.text, 0, 0)
    })
    ctx.restore()
  }
}

// ---- Partículas y ondas ----

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  /** Vida restante y total, en ms. */
  life: number
  maxLife: number
  size: number
  color: string
  /** Las estrellas giran y no caen; las chispas tienen gravedad. */
  star: boolean
}

interface Ring {
  x: number
  y: number
  born: number
  duration: number
  maxRadius: number
  color: string
}

const GRAVITY = 0.0006 // px/ms²

export class ParticleLayer {
  private particles: Particle[] = []
  private rings: Ring[] = []
  private last = 0

  constructor(private readonly random: () => number = Math.random) {}

  /** Explosión de chispas desde un punto. */
  burst(
    x: number,
    y: number,
    color: string,
    count: number,
    opts: { speed?: number; star?: boolean } = {},
  ): void {
    const speed = opts.speed ?? 0.15
    for (let i = 0; i < count; i++) {
      const angle = this.random() * Math.PI * 2
      const v = speed * (0.4 + this.random() * 0.8)
      const life = 500 + this.random() * 400
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v - (opts.star ? 0 : 0.05),
        life,
        maxLife: life,
        size: opts.star ? 5 + this.random() * 3 : 2 + this.random() * 2,
        color,
        star: opts.star ?? false,
      })
    }
  }

  /** Onda circular que se expande y desvanece. */
  ring(
    x: number,
    y: number,
    color: string,
    now: number,
    maxRadius = BLOCK * 3,
    duration = 600,
  ): void {
    this.rings.push({ x, y, born: now, duration, maxRadius, color })
  }

  clear(): void {
    this.particles = []
    this.rings = []
  }

  /** `tint`: color único que sustituye a todos (modo retro: un color de la paleta del nivel). */
  draw(ctx: Ctx, now: number, tint: string | null = null): void {
    // dt acotado: si la pestaña estuvo oculta no queremos un salto enorme
    const dt = this.last ? Math.min(now - this.last, 50) : 16
    this.last = now
    this.rings = this.rings.filter((r) => now - r.born < r.duration)
    this.particles = this.particles.filter((p) => (p.life -= dt) > 0)
    if (!this.particles.length && !this.rings.length) return

    ctx.save()
    for (const r of this.rings) {
      const t = (now - r.born) / r.duration
      if (t < 0) continue // onda programada con retraso: aún no empieza
      ctx.globalAlpha = (1 - t) * 0.8
      ctx.strokeStyle = tint ?? r.color
      ctx.lineWidth = 3 * (1 - t) + 1
      ctx.beginPath()
      ctx.arc(r.x, r.y, r.maxRadius * easeOut(t), 0, Math.PI * 2)
      ctx.stroke()
    }
    for (const p of this.particles) {
      if (!p.star) p.vy += GRAVITY * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      ctx.globalAlpha = p.life / p.maxLife
      ctx.fillStyle = tint ?? p.color
      if (p.star) drawStar(ctx, p.x, p.y, p.size, (p.maxLife - p.life) / 150)
      else ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size)
    }
    ctx.restore()
  }
}

const easeOut = (t: number) => 1 - (1 - t) ** 3

function drawStar(ctx: Ctx, x: number, y: number, r: number, angle: number): void {
  ctx.beginPath()
  for (let i = 0; i < 8; i++) {
    const rad = i % 2 === 0 ? r : r * 0.4
    const a = angle + (i * Math.PI) / 4
    ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad)
  }
  ctx.closePath()
  ctx.fill()
}

// ---- Destellos de filas y sacudida ----

interface Flash {
  row: number
  born: number
  color: string
}

const FLASH_MS = 280

class FlashLayer {
  private items: Flash[] = []

  add(row: number, color: string, now: number): void {
    this.items.push({ row, born: now, color })
  }

  clear(): void {
    this.items = []
  }

  /** `tint`: color único que sustituye a todos (modo retro: un color de la paleta del nivel). */
  draw(ctx: Ctx, now: number, tint: string | null = null): void {
    this.items = this.items.filter((f) => now - f.born < FLASH_MS)
    if (!this.items.length) return
    ctx.save()
    for (const f of this.items) {
      const t = (now - f.born) / FLASH_MS
      ctx.globalAlpha = (1 - t) * 0.85
      ctx.fillStyle = tint ?? f.color
      // la banda se estrecha verticalmente mientras se apaga
      const h = BLOCK * (1 - t * 0.6)
      ctx.fillRect(0, f.row * BLOCK + (BLOCK - h) / 2, COLS * BLOCK, h)
    }
    ctx.restore()
  }
}

/** Sacudida del tablero que decae linealmente. */
class Shake {
  private intensity = 0
  private born = 0
  private duration = 0

  constructor(private readonly random: () => number = Math.random) {}

  start(intensity: number, now: number, duration = 320): void {
    // una sacudida más fuerte sustituye a la que esté en curso
    if (intensity < this.current(now)) return
    this.intensity = intensity
    this.born = now
    this.duration = duration
  }

  private current(now: number): number {
    const t = (now - this.born) / this.duration
    return t >= 1 || t < 0 ? 0 : this.intensity * (1 - t)
  }

  offset(now: number): { x: number; y: number } {
    const a = this.current(now)
    if (!a) return { x: 0, y: 0 }
    return { x: (this.random() * 2 - 1) * a, y: (this.random() * 2 - 1) * a }
  }

  clear(): void {
    this.intensity = 0
  }
}

// ---- Celdas que se desvanecen (desafío Invisible) ----

interface Fading {
  cells: Cell[]
  color: string
  born: number
}

const VANISH_MS = 650

class VanishLayer {
  private items: Fading[] = []

  add(cells: Cell[], color: string, now: number): void {
    this.items.push({ cells, color, born: now })
  }

  clear(): void {
    this.items = []
  }

  /** `tint`: color único que sustituye a todos (modo retro: un color de la paleta del nivel). */
  draw(ctx: Ctx, now: number, tint: string | null = null): void {
    this.items = this.items.filter((f) => now - f.born < VANISH_MS)
    if (!this.items.length) return
    ctx.save()
    for (const f of this.items) {
      const t = (now - f.born) / VANISH_MS
      ctx.globalAlpha = (1 - t) * 0.9
      ctx.fillStyle = tint ?? f.color
      for (const { x, y } of f.cells)
        ctx.fillRect(x * BLOCK + 1, y * BLOCK + 1, BLOCK - 2, BLOCK - 2)
    }
    ctx.restore()
  }
}

// ---- Fachada: traduce eventos del motor a efectos ----

const FIREWORK_COLORS = ['#ff8a80', '#ffd54f', '#81c784', '#4dd0e1', '#ba68c8', '#fff59d']

export class Effects {
  readonly popups = new PopupLayer()
  readonly particles = new ParticleLayer()
  private readonly flashes = new FlashLayer()
  private readonly vanish = new VanishLayer()
  private readonly shake = new Shake()
  /** Efectos programados para más adelante (p. ej. fuegos artificiales escalonados). */
  private timers: { at: number; run: (now: number) => void }[] = []

  private schedule(at: number, run: (now: number) => void): void {
    this.timers.push({ at, run })
  }

  handle(event: GameEvent, now: number): void {
    switch (event.type) {
      case 'popup':
        this.popups.add(event.text, event.color, now)
        break
      case 'special': {
        const points = event.cells.map(center)
        // centro de la pieza, para las ondas
        const cx = points.reduce((s, p) => s + p.x, 0) / points.length
        const cy = points.reduce((s, p) => s + p.y, 0) / points.length
        for (const p of points) this.particles.burst(p.x, p.y, event.color, 6)
        if (event.kind === 'reward') {
          this.particles.burst(cx, cy, '#fff59d', 14, { star: true, speed: 0.12 })
          this.particles.ring(cx, cy, event.color, now)
        } else if (event.kind === 'challenge') {
          this.particles.ring(cx, cy, '#e57373', now, BLOCK * 4, 800)
          this.particles.ring(cx, cy, event.color, now + 150, BLOCK * 3, 650)
        }
        break
      }
      case 'clear':
        this.handleClear(event, now)
        break
      case 'lock':
        if (event.vanish) this.vanish.add(event.cells, event.color, now)
        break
      case 'garbage':
        this.shake.start(3, now, 220)
        for (let c = 0; c < COLS; c++)
          this.particles.burst((c + 0.5) * BLOCK, ROWS * BLOCK - 4, '#b0bec5', 2, { speed: 0.12 })
        break
      case 'finish':
        this.handleFinish(event.won, now)
        break
      case 'skill': {
        if (!event.ok) break
        // onda y estrellas del color de la habilidad desde el centro del tablero
        const color = skillInfo(event.id)?.color ?? '#fff'
        const cx = (COLS * BLOCK) / 2
        const cy = (ROWS * BLOCK) / 2
        this.particles.ring(cx, cy, color, now, BLOCK * 6, 700)
        this.particles.burst(cx, cy, color, 20, { star: true, speed: 0.16 })
        break
      }
      case 'energy-full':
        this.particles.ring((COLS * BLOCK) / 2, (ROWS * BLOCK) / 2, '#ffd54f', now, BLOCK * 4, 600)
        break
    }
  }

  private handleFinish(won: boolean, now: number): void {
    const w = COLS * BLOCK
    const h = ROWS * BLOCK
    if (!won) {
      this.shake.start(5, now, 400)
      this.particles.ring(w / 2, h / 2, '#e57373', now, BLOCK * 7, 900)
      return
    }
    // fuegos artificiales: 8 explosiones escalonadas en posiciones aleatorias
    for (let i = 0; i < 8; i++) {
      this.schedule(now + i * 180, (t) => {
        const x = w * (0.15 + Math.random() * 0.7)
        const y = h * (0.15 + Math.random() * 0.5)
        const color = FIREWORK_COLORS[i % FIREWORK_COLORS.length] ?? '#fff'
        this.particles.burst(x, y, color, 24, { speed: 0.22 })
        this.particles.burst(x, y, '#ffffff', 6, { star: true, speed: 0.1 })
        this.particles.ring(x, y, color, t, BLOCK * 2, 500)
      })
    }
  }

  private handleClear(event: Extract<GameEvent, { type: 'clear' }>, now: number): void {
    const color = event.perfect
      ? '#fff59d'
      : event.tspin
        ? (COLORS[T_PIECE] ?? '#fff')
        : event.lines >= 4
          ? (COLORS[1] ?? '#fff')
          : '#ffffff'

    // destello + barrido de chispas a lo largo de cada fila limpiada
    for (const row of event.rows) {
      this.flashes.add(row, color, now)
      for (let c = 0; c < COLS; c++)
        this.particles.burst((c + 0.5) * BLOCK, (row + 0.5) * BLOCK, color, 2, { speed: 0.1 })
    }

    // sacudida proporcional a la jugada
    const intensity = event.perfect
      ? 9
      : event.lines >= 4
        ? 6
        : event.tspin
          ? 5
          : event.combo >= 3
            ? 2 + Math.min(event.combo, 6) * 0.5
            : 0
    if (intensity) this.shake.start(intensity, now)

    const cx = (COLS * BLOCK) / 2
    const cy = (ROWS * BLOCK) / 2
    if (event.b2b) this.particles.ring(cx, cy, '#ffab40', now, BLOCK * 5, 700)
    if (event.perfect) {
      this.particles.ring(cx, cy, '#ffffff', now, BLOCK * 8, 900)
      this.particles.ring(cx, cy, '#fff59d', now + 200, BLOCK * 6, 800)
      for (let i = 0; i < 6; i++)
        this.particles.burst(cx, cy - BLOCK * 3 + i * BLOCK, '#fff59d', 6, {
          star: true,
          speed: 0.2,
        })
    }
  }

  /** Desplazamiento a aplicar al tablero en este frame (sacudida). */
  offset(now: number): { x: number; y: number } {
    return this.shake.offset(now)
  }

  clear(): void {
    this.popups.clear()
    this.particles.clear()
    this.flashes.clear()
    this.vanish.clear()
    this.shake.clear()
    this.timers = []
  }

  /** `tint`: color único que sustituye a todos (modo retro: un color de la paleta del nivel). */
  draw(ctx: Ctx, now: number, tint: string | null = null): void {
    const due = this.timers.filter((t) => t.at <= now)
    if (due.length) {
      this.timers = this.timers.filter((t) => t.at > now)
      for (const t of due) t.run(now)
    }
    this.vanish.draw(ctx, now, tint)
    this.flashes.draw(ctx, now, tint)
    this.particles.draw(ctx, now, tint)
    this.popups.draw(ctx, now, tint)
  }
}
