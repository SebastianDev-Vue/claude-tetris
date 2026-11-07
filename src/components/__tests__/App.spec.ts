import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import App from '@/App.vue'
import { SETTINGS_KEY, defaultSettings } from '@/composables/useSettings'
import { GHOSTS_KEY } from '@/composables/useGhosts'
import { REPLAY_VERSION } from '@/engine/replay'

const STUBS = [
  'GameBoard',
  'LeftPanel',
  'SidePanel',
  'GameOverlay',
  'ThemeToggle',
  'RivalBoard',
  'RivalPanel',
]

function startWith(versusGhost: boolean, withGhost: boolean) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...defaultSettings(), versusGhost }))
  if (withGhost) {
    const replay = {
      version: REPLAY_VERSION,
      seed: 1,
      mode: 'marathon',
      startLevel: 1,
      score: 500,
      actions: [],
    }
    localStorage.setItem(GHOSTS_KEY, JSON.stringify({ marathon: replay }))
  }
  vi.stubGlobal('requestAnimationFrame', () => 1)
  const w = mount(App, { global: { stubs: Object.fromEntries(STUBS.map((s) => [s, true])) } })
  // El menú llama a start() con el modo elegido; aquí basta con la tecla 1
  window.dispatchEvent(new KeyboardEvent('keydown', { key: '1', code: 'Digit1' }))
  return w
}

afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

describe('App: pantalla contra el fantasma', () => {
  it.each([
    [false, true],
    [true, false],
  ])('ajuste %s y fantasma %s: pantalla de un jugador', async (versus, ghost) => {
    const w = startWith(versus, ghost)
    await w.vm.$nextTick()
    expect(w.find('rival-board-stub').exists()).toBe(false)
    expect(w.find('rival-panel-stub').exists()).toBe(false)
    w.unmount()
  })

  it('con fantasma y el ajuste activado aparecen el tablero y el panel rival', async () => {
    const w = startWith(true, true)
    await w.vm.$nextTick()
    expect(w.find('rival-board-stub').exists()).toBe(true)
    expect(w.find('rival-panel-stub').exists()).toBe(true)
    w.unmount()
  })
})
