// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { BOMB, COLORS, GARBAGE } from '@/engine/constants'
import { Game } from '@/engine/game'
import {
  drawBlock,
  drawBoard,
  drawPreview,
  pastelColor,
  retroColor,
  retroPalette,
  type Skin,
} from '@/render/canvas'
import { Effects } from '@/render/effects'

interface Call {
  name: string
  args: unknown[]
  fillStyle: unknown
  shadowBlur: unknown
}

/** Contexto 2D falso que registra cada llamada junto al fillStyle vigente. */
function recordingContext() {
  const calls: Call[] = []
  const state: Record<string | symbol, unknown> = { canvas: { width: 300, height: 600 } }
  const ctx = new Proxy(state, {
    get(target, key) {
      if (key in target) return target[key]
      return (...args: unknown[]) => {
        calls.push({
          name: String(key),
          args,
          fillStyle: target.fillStyle,
          shadowBlur: target.shadowBlur,
        })
      }
    },
    set(target, key, value) {
      target[key] = value
      return true
    },
  }) as unknown as CanvasRenderingContext2D
  const named = (name: string) => calls.filter((c) => c.name === name)
  return { ctx, calls, named }
}

const opts = (skin: Skin) => ({ gridColor: '#222', skin })

describe('drawBlock en modo retro', () => {
  it('un bloque normal es un bloque en píxeles con el color de la paleta del nivel', () => {
    const { ctx, named } = recordingContext()
    drawBlock(ctx, 0, 0, 1, 30, 1, '8bit', 1)
    expect(named('fillText')).toHaveLength(0)
    const rects = named('fillRect')
    expect(rects[0]).toEqual(expect.objectContaining({ args: [0, 0, 30, 30], fillStyle: '#000' }))
    expect(rects[1]).toEqual(
      expect.objectContaining({ args: [3, 3, 24, 24], fillStyle: retroPalette(1)[0] }),
    )
  })

  it('la paleta cambia con el nivel y rota cada 10 niveles', () => {
    expect(retroColor(1, 1)).not.toBe(retroColor(1, 2))
    expect(retroColor(1, 11)).toBe(retroColor(1, 1))
    // cada pieza toma uno de los tres colores según su tipo
    expect(retroColor(2, 1)).toBe(retroPalette(1)[1])
    expect(retroColor(4, 1)).toBe(retroPalette(1)[0])
  })

  it('power-ups llevan su letra y la basura tiene color fijo', () => {
    const { ctx, named } = recordingContext()
    drawBlock(ctx, 0, 0, BOMB, 30, 1, '8bit', 1)
    drawBlock(ctx, 0, 0, GARBAGE, 30, 1, '8bit', 1)
    expect(named('fillText').map((c) => c.args[0])).toEqual(['B'])
    expect(retroColor(GARBAGE, 1)).toBe(retroColor(GARBAGE, 5))
  })

  it('fuera de retro se sigue dibujando con el color de la pieza', () => {
    const { ctx, named } = recordingContext()
    drawBlock(ctx, 0, 0, 1, 30)
    expect(named('fillRect')[0]?.fillStyle).toBe(COLORS[1])
  })
})

describe('drawBoard en modo retro', () => {
  const game = () => {
    const g = new Game({ random: () => 0.5 })
    g.current = g.makePiece(1) // I horizontal: 4 celdas
    return g
  }
  const RECTS_PER_RETRO_BLOCK = 7

  it('sin rejilla ni pieza fantasma: solo las 4 celdas de la pieza', () => {
    const { ctx, named } = recordingContext()
    drawBoard(ctx, game(), opts('8bit'), 0)
    expect(named('stroke')).toHaveLength(0)
    expect(named('fillRect')).toHaveLength(4 * RECTS_PER_RETRO_BLOCK)
  })

  it('usa la paleta del nivel actual', () => {
    const g = game()
    g.level = 3
    const { ctx, named } = recordingContext()
    drawBoard(ctx, g, opts('8bit'), 0)
    expect(named('fillRect')[1]?.fillStyle).toBe(retroPalette(3)[0])
  })

  it('el modo normal dibuja rejilla y fantasma', () => {
    const { ctx, named } = recordingContext()
    drawBoard(ctx, game(), opts('retro'), 0)
    expect(named('stroke')).toHaveLength(1)
    expect(named('fillRect').length).toBe(4 * 2 * 2) // pieza + fantasma, bloque + brillo
  })

  it('las vistas previas también cambian a píxeles', () => {
    const { ctx, named } = recordingContext()
    drawPreview(ctx, game().current, 30, 4, 0, '8bit', 1)
    expect(named('fillRect')).toHaveLength(4 * RECTS_PER_RETRO_BLOCK)
  })
})

describe('skins', () => {
  it('neón: borde con halo shadowBlur del color de la pieza, envuelto en save/restore', () => {
    const { ctx, calls, named } = recordingContext()
    drawBlock(ctx, 0, 0, 1, 30, 1, 'neon')
    const stroke = named('strokeRect')[0]
    expect(stroke?.shadowBlur).toBeGreaterThan(0)
    expect(ctx.shadowColor).toBe(COLORS[1])
    const names = calls.map((c) => c.name)
    expect(names.indexOf('save')).toBeLessThan(names.indexOf('strokeRect'))
    expect(names.indexOf('restore')).toBeGreaterThan(names.indexOf('strokeRect'))
  })

  it('pastel: color aclarado en un rectángulo redondeado', () => {
    const { ctx, named } = recordingContext()
    drawBlock(ctx, 0, 0, 1, 30, 1, 'pastel')
    expect(named('roundRect')).toHaveLength(1)
    expect(named('fill')[0]?.fillStyle).toBe(pastelColor(1))
    expect(pastelColor(1)).not.toBe(COLORS[1])
    expect(pastelColor(5)).toBe('rgb(241, 178, 178)') // #e57373 mezclado con blanco al 45 %
  })

  it('pastel sin roundRect (navegadores antiguos) usa un rectángulo normal', () => {
    const { ctx, named } = recordingContext()
    ;(ctx as unknown as Record<string, unknown>).roundRect = undefined
    drawBlock(ctx, 0, 0, 1, 30, 1, 'pastel')
    expect(named('rect')).toHaveLength(1)
  })

  it('pixel art: color plano y textura de tablero de ajedrez encima', () => {
    const { ctx, named } = recordingContext()
    drawBlock(ctx, 0, 0, 1, 30, 1, 'pixel')
    const rects = named('fillRect')
    expect(rects[0]?.fillStyle).toBe(COLORS[1])
    expect(rects.length).toBe(1 + 18) // 6×6 "píxeles" de 5 px, la mitad sombreados
  })

  it('las vistas previas usan la skin indicada', () => {
    const { ctx, named } = recordingContext()
    drawPreview(ctx, new Game({ random: () => 0.5 }).makePiece(1), 30, 4, 0, 'pastel')
    expect(named('roundRect')).toHaveLength(4)
  })

  it('el tablero en neón conserva rejilla y fantasma', () => {
    const g = new Game({ random: () => 0.5 })
    g.current = g.makePiece(1)
    const { ctx, named } = recordingContext()
    drawBoard(ctx, g, opts('neon'), 0)
    expect(named('stroke')).toHaveLength(1)
    expect(named('strokeRect')).toHaveLength(8)
  })
})

describe('efectos de un solo color', () => {
  it('con tint todas las partículas y popups usan ese color', () => {
    const tint = retroPalette(1)[0]
    const fx = new Effects()
    fx.handle({ type: 'popup', text: 'TETRIS', color: '#4dd0e1' }, 0)
    fx.handle({ type: 'special', kind: 'reward', cells: [{ x: 1, y: 1 }], color: '#ffd700' }, 0)
    const { ctx, calls } = recordingContext()
    fx.draw(ctx, 16, tint)
    const painted = calls.filter((c) => ['fillRect', 'fill', 'fillText'].includes(c.name))
    expect(painted.length).toBeGreaterThan(0)
    expect(painted.every((c) => c.fillStyle === tint)).toBe(true)
  })
})
