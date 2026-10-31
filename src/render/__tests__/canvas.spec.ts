// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { BOMB, COLORS, GARBAGE } from '@/engine/constants'
import { Game } from '@/engine/game'
import { RETRO_GREEN, drawBlock, drawBoard, drawPreview } from '@/render/canvas'
import { Effects } from '@/render/effects'

interface Call {
  name: string
  args: unknown[]
  fillStyle: unknown
}

/** Contexto 2D falso que registra cada llamada junto al fillStyle vigente. */
function recordingContext() {
  const calls: Call[] = []
  const state: Record<string | symbol, unknown> = { canvas: { width: 300, height: 600 } }
  const ctx = new Proxy(state, {
    get(target, key) {
      if (key in target) return target[key]
      return (...args: unknown[]) => {
        calls.push({ name: String(key), args, fillStyle: target.fillStyle })
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

const opts = (retro: boolean) => ({ gridColor: '#222', retro })

describe('drawBlock en modo retro', () => {
  it('un bloque normal es el texto [] en verde, sin rectángulos de color', () => {
    const { ctx, named } = recordingContext()
    drawBlock(ctx, 0, 0, 1, 30, 1, true)
    expect(named('fillRect')).toHaveLength(0)
    expect(named('fillText')).toEqual([
      expect.objectContaining({ args: ['[]', 15, 16], fillStyle: RETRO_GREEN }),
    ])
  })

  it('los bloques con significado tienen su propia marca', () => {
    const { ctx, named } = recordingContext()
    drawBlock(ctx, 0, 0, BOMB, 30, 1, true)
    drawBlock(ctx, 0, 0, GARBAGE, 30, 1, true)
    expect(named('fillText').map((c) => c.args[0])).toEqual(['B', '::'])
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

  it('sin rejilla ni pieza fantasma: solo las 4 celdas de la pieza', () => {
    const { ctx, named } = recordingContext()
    drawBoard(ctx, game(), opts(true), 0)
    expect(named('stroke')).toHaveLength(0)
    expect(named('fillText')).toHaveLength(4)
  })

  it('el modo normal dibuja rejilla y fantasma', () => {
    const { ctx, named } = recordingContext()
    drawBoard(ctx, game(), opts(false), 0)
    expect(named('stroke')).toHaveLength(1)
    expect(named('fillRect').length).toBe(4 * 2 * 2) // pieza + fantasma, bloque + brillo
  })

  it('las vistas previas también cambian a texto', () => {
    const { ctx, named } = recordingContext()
    drawPreview(ctx, game().current, 30, 4, 0, true)
    expect(named('fillText')).toHaveLength(4)
    expect(named('fillRect')).toHaveLength(0)
  })
})

describe('efectos monocromos', () => {
  it('con tint todas las partículas y popups usan ese color', () => {
    const fx = new Effects()
    fx.handle({ type: 'popup', text: 'TETRIS', color: '#4dd0e1' }, 0)
    fx.handle({ type: 'special', kind: 'reward', cells: [{ x: 1, y: 1 }], color: '#ffd700' }, 0)
    const { ctx, calls } = recordingContext()
    fx.draw(ctx, 16, RETRO_GREEN)
    const painted = calls.filter((c) => ['fillRect', 'fill', 'fillText'].includes(c.name))
    expect(painted.length).toBeGreaterThan(0)
    expect(painted.every((c) => c.fillStyle === RETRO_GREEN)).toBe(true)
  })
})
