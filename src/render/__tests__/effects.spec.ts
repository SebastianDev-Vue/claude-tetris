// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { Effects } from '@/render/effects'

/** Contexto 2D falso: registra las llamadas que nos interesan y acepta el resto. */
function fakeContext() {
  const arcs: number[] = []
  let draws = 0
  const ctx = new Proxy(
    { canvas: { width: 300, height: 600 } } as Record<string | symbol, unknown>,
    {
      get(target, key) {
        if (key in target) return target[key]
        if (key === 'arc') return (_x: number, _y: number, r: number) => arcs.push(r)
        if (key === 'fillRect' || key === 'fill' || key === 'fillText') return () => draws++
        return () => {}
      },
      set(target, key, value) {
        target[key] = value
        return true
      },
    },
  ) as unknown as CanvasRenderingContext2D
  return { ctx, arcs, drawCount: () => draws }
}

const cells = [
  { x: 4, y: 0 },
  { x: 5, y: 0 },
  { x: 6, y: 0 },
]

describe('Effects', () => {
  it('las ondas con retraso nunca dibujan un radio negativo', () => {
    const fx = new Effects()
    const { ctx, arcs } = fakeContext()
    fx.handle({ type: 'special', kind: 'challenge', cells, color: '#a1887f' }, 1000)
    for (let t = 1000; t <= 2000; t += 16) fx.draw(ctx, t)
    expect(arcs.length).toBeGreaterThan(0)
    expect(arcs.every((r) => r >= 0)).toBe(true)
  })

  it('las partículas y los popups desaparecen al terminar su vida', () => {
    const fx = new Effects()
    fx.handle({ type: 'special', kind: 'reward', cells, color: '#ffd700' }, 0)
    fx.handle({ type: 'popup', text: 'RECOMPENSA', color: '#ffd700' }, 0)

    const early = fakeContext()
    fx.draw(early.ctx, 16)
    expect(early.drawCount()).toBeGreaterThan(0)

    // avanzar en pasos pequeños (dt está acotado a 50 ms) hasta pasar todas las vidas
    for (let t = 32; t < 3000; t += 16) fx.draw(fakeContext().ctx, t)
    const late = fakeContext()
    fx.draw(late.ctx, 3000)
    expect(late.drawCount()).toBe(0)
  })

  it('clear() elimina todos los efectos activos', () => {
    const fx = new Effects()
    fx.handle({ type: 'special', kind: 'pentomino', cells, color: '#4db6ac' }, 0)
    fx.clear()
    const { ctx, drawCount } = fakeContext()
    fx.draw(ctx, 16)
    expect(drawCount()).toBe(0)
  })
})
