import { BLOCK } from '../engine/constants'
import type { Cell, GameEvent } from '../engine/game'

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
      // entra con un pequeño "pop" de escala y sube mientras se desvanece
      const scale = t < 0.15 ? 0.6 + (t / 0.15) * 0.4 : 1
      const y = height / 2 - 40 * t + i * 28
      ctx.globalAlpha = 1 - t
      ctx.fillStyle = p.color
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

  draw(ctx: Ctx, now: number): void {
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
      ctx.strokeStyle = r.color
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
      ctx.fillStyle = p.color
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

// ---- Fachada: traduce eventos del motor a efectos ----

export class Effects {
  readonly popups = new PopupLayer()
  readonly particles = new ParticleLayer()

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
    }
  }

  clear(): void {
    this.popups.clear()
    this.particles.clear()
  }

  draw(ctx: Ctx, now: number): void {
    this.particles.draw(ctx, now)
    this.popups.draw(ctx, now)
  }
}
