import { afterEach, describe, expect, it, vi } from 'vitest'
import { reactive, ref } from 'vue'
import { mount } from '@vue/test-utils'
import LeftPanel from '@/components/LeftPanel.vue'
import RivalBoard from '@/components/RivalBoard.vue'
import RivalPanel from '@/components/RivalPanel.vue'
import { GameKey, type GameContext, type Hud } from '@/composables/useGame'
import { defaultSettings } from '@/composables/useSettings'
import { ThemeKey, type ThemeContext } from '@/composables/useTheme'
import { BLOCK, COLS, ROWS } from '@/engine/constants'
import { Game } from '@/engine/game'

const HINT = 'Termina una partida para correr contra tu mejor marca'

function provideFor(
  over: Partial<Hud>,
  frames: ((now: number) => void)[] = [],
  settings = defaultSettings(),
) {
  const ctx = {
    game: new Game(),
    ghost: new Game(),
    hud: reactive({ score: 0, ghostDiff: 0, ghostScore: 0, ...over }),
    settings: { values: settings },
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

function fakeCanvas() {
  const log: string[] = []
  const ctx = new Proxy({} as Record<string | symbol, unknown>, {
    get(target, key) {
      if (key === 'canvas') return { width: COLS * BLOCK, height: ROWS * BLOCK }
      if (key in target) return target[key]
      return (...args: unknown[]) => log.push(`${String(key)}(${args.join(',')})`)
    },
    set(target, key, value) {
      target[key] = value
      return true
    },
  })
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    ctx as unknown as RenderingContext,
  )
  return log
}

afterEach(() => vi.restoreAllMocks())

describe('LeftPanel', () => {
  it('sin fantasma muestra los controles y la invitación', () => {
    const w = mount(LeftPanel, { global: provideFor({ hasGhost: false }) })
    expect(w.find('.controls').exists()).toBe(true)
    expect(w.text()).toContain(HINT)
  })

  it('contra el fantasma los controles siguen ahí, sin invitación', () => {
    const w = mount(LeftPanel, { global: provideFor({ hasGhost: true }) })
    expect(w.find('.controls').exists()).toBe(true)
    expect(w.text()).not.toContain(HINT)
  })

  it('con el ajuste apagado no invita a correr contra el fantasma', () => {
    const settings = { ...defaultSettings(), versusGhost: false }
    const w = mount(LeftPanel, { global: provideFor({ hasGhost: false }, [], settings) })
    expect(w.text()).not.toContain(HINT)
  })
})

describe('RivalBoard', () => {
  it('mide lo mismo que el tablero del jugador y dibuja en cada frame', () => {
    const log = fakeCanvas()
    const frames: ((now: number) => void)[] = []
    const w = mount(RivalBoard, { global: provideFor({ hasGhost: true }, frames) })
    const canvas = w.find('canvas').element
    expect([canvas.width, canvas.height]).toEqual([COLS * BLOCK, ROWS * BLOCK])
    frames[0]!(0)
    expect(log.some((l) => l.startsWith('clearRect'))).toBe(true)
  })

  it('al desmontar se da de baja del bucle', () => {
    fakeCanvas()
    const frames: ((now: number) => void)[] = []
    const w = mount(RivalBoard, { global: provideFor({ hasGhost: true }, frames) })
    expect(frames).toHaveLength(1)
    w.unmount()
    expect(frames).toHaveLength(0)
  })

  it.each([
    [1240, 'ahead', '▲', 'sobre el fantasma'],
    [-300, 'behind', '▼', 'bajo el fantasma'],
    [0, 'tied', '=', 'igual que el fantasma'],
  ])('franja VS con diferencia %i: color, símbolo y texto', (diff, trend, symbol, note) => {
    fakeCanvas()
    const w = mount(RivalBoard, { global: provideFor({ hasGhost: true, ghostDiff: diff }) })
    const el = w.find('.versus')
    expect(el.classes()).toContain(`versus--${trend}`)
    expect(el.text()).toContain('VS')
    expect(el.text()).toContain(symbol)
    expect(el.text()).toContain(note)
  })

  it('cuando el fantasma termina, su tablero muestra la puntuación final', () => {
    fakeCanvas()
    const playing = mount(RivalBoard, { global: provideFor({ hasGhost: true }) })
    expect(playing.find('.rival-final').exists()).toBe(false)
    const w = mount(RivalBoard, {
      global: provideFor({ hasGhost: true, ghostFinished: true, ghostScore: 1234 }),
    })
    expect(w.find('.rival-final').text()).toMatch(/Final: 1[.,\s]?234 puntos/)
    expect(w.find('canvas').exists()).toBe(true)
  })
})

describe('RivalPanel', () => {
  it('muestra puntos, líneas y nivel del fantasma', () => {
    const w = mount(RivalPanel, {
      global: provideFor({ ghostScore: 4321, ghostLines: 17, ghostLevel: 2 }),
    })
    expect(w.text()).toMatch(/4[.,\s]?321/)
    expect(w.text()).toContain('17')
    expect(w.text()).toContain('2')
  })
})
