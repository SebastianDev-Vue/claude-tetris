import { afterEach, describe, expect, it, vi } from 'vitest'
import { reactive, ref } from 'vue'
import { mount } from '@vue/test-utils'
import GhostBoard from '@/components/GhostBoard.vue'
import LeftPanel from '@/components/LeftPanel.vue'
import SidePanel from '@/components/SidePanel.vue'
import { GameKey, type GameContext, type Hud } from '@/composables/useGame'
import { defaultSettings } from '@/composables/useSettings'
import { ThemeKey, type ThemeContext } from '@/composables/useTheme'
import { BLOCK, COLS, ROWS } from '@/engine/constants'
import { Game } from '@/engine/game'

const HINT = 'Termina una partida para correr contra tu mejor marca'

function provideFor(over: Partial<Hud>, frames: ((now: number) => void)[] = []) {
  const ctx = {
    game: new Game(),
    ghost: new Game(),
    hud: reactive({ score: 0, ghostDiff: 0, ghostScore: 0, ...over }),
    settings: { values: defaultSettings() },
    onFrame: (fn: (now: number) => void) => {
      frames.push(fn)
      return () => frames.splice(frames.indexOf(fn), 1)
    },
  } as unknown as GameContext
  const theme = { gridColor: ref('#222'), skin: ref('retro') } as unknown as ThemeContext
  return {
    provide: { [GameKey as symbol]: ctx, [ThemeKey as symbol]: theme },
    stubs: { PiecePreview: true },
  }
}

afterEach(() => vi.restoreAllMocks())

describe('LeftPanel', () => {
  it('sin fantasma muestra los controles y la invitación', () => {
    const w = mount(LeftPanel, { global: { ...provideFor({ hasGhost: false }) } })
    expect(w.find('.controls').exists()).toBe(true)
    expect(w.text()).toContain(HINT)
    expect(w.findComponent(GhostBoard).exists()).toBe(false)
  })

  it('con fantasma el mini tablero ocupa ese hueco, debajo de HOLD', () => {
    const global = provideFor({ hasGhost: true })
    const w = mount(LeftPanel, {
      global: { ...global, stubs: { ...global.stubs, GhostBoard: true } },
    })
    expect(w.find('.controls').exists()).toBe(false)
    expect(w.text()).not.toContain(HINT)
    expect(w.find('.hold-slot + * + ghost-board-stub').exists()).toBe(true)
  })
})

describe('SidePanel', () => {
  it('sin fantasma no muestra diferencia', () => {
    const w = mount(SidePanel, { global: provideFor({ hasGhost: false }) })
    expect(w.find('.ghost-diff').exists()).toBe(false)
  })

  it.each([
    [1240, 'ahead', '▲', 'sobre el fantasma'],
    [-300, 'behind', '▼', 'bajo el fantasma'],
    [0, 'tied', '=', 'igual que el fantasma'],
  ])('diferencia %i: color, símbolo y texto', (diff, trend, symbol, note) => {
    const w = mount(SidePanel, { global: provideFor({ hasGhost: true, ghostDiff: diff }) })
    const el = w.find('.ghost-diff')
    expect(el.classes()).toContain(`ghost-diff--${trend}`)
    expect(el.text()).toContain(symbol)
    expect(el.text()).toContain(note)
  })
})

describe('GhostBoard', () => {
  function fakeCanvas() {
    const log: string[] = []
    const ctx = new Proxy(
      { getTransform: () => ({ a: 1 / 3 }) } as Record<string | symbol, unknown>,
      {
        get(target, key) {
          if (key === 'canvas') return { width: 100, height: 200 }
          if (key in target) return target[key]
          return (...args: unknown[]) => log.push(`${String(key)}(${args.join(',')})`)
        },
        set(target, key, value) {
          target[key] = value
          return true
        },
      },
    )
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      ctx as unknown as RenderingContext,
    )
    return log
  }

  it('mide 10 px por celda y limpia todo el canvas antes de escalar', () => {
    const log = fakeCanvas()
    const frames: ((now: number) => void)[] = []
    const w = mount(GhostBoard, { global: provideFor({ hasGhost: true }, frames) })
    const canvas = w.find('canvas').element
    expect([canvas.width, canvas.height]).toEqual([COLS * 10, ROWS * 10])
    frames[0]!(0)
    const clear = log.indexOf('clearRect(0,0,100,200)')
    const scale = log.indexOf(`scale(${10 / BLOCK},${10 / BLOCK})`)
    expect(clear).toBeGreaterThanOrEqual(0)
    expect(scale).toBeGreaterThan(clear)
    expect(log[clear - 1]).toBe('setTransform(1,0,0,1,0,0)')
  })

  it('al desmontar se da de baja del bucle', () => {
    fakeCanvas()
    const frames: ((now: number) => void)[] = []
    const w = mount(GhostBoard, { global: provideFor({ hasGhost: true }, frames) })
    expect(frames).toHaveLength(1)
    w.unmount()
    expect(frames).toHaveLength(0)
  })

  it('indica la puntuación final cuando el fantasma ya terminó', () => {
    fakeCanvas()
    const w = mount(GhostBoard, {
      global: provideFor({ hasGhost: true, ghostFinished: true, ghostScore: 1234 }),
    })
    expect(w.text()).toContain('Final')
    expect(w.text()).toMatch(/1[.,\s]?234/)
  })
})
