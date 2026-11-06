import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, provide } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import SettingsPanel from '@/components/SettingsPanel.vue'
import { GameKey, useGame, type GameContext } from '@/composables/useGame'
import { useTheme, type ThemeContext } from '@/composables/useTheme'
import { SETTINGS_KEY } from '@/composables/useSettings'

let wrapper: VueWrapper | undefined
let ctx: GameContext
let theme: ThemeContext
let rafCallback: FrameRequestCallback | null
let now: number

/** Reloj falso: avanza `ms` entregando frames de 10 ms. */
function advance(ms: number): void {
  for (let t = 0; t < ms; t += 10) {
    now += 10
    const cb = rafCallback
    rafCallback = null
    cb?.(now)
  }
}

const down = (code: string, repeat = false) =>
  window.dispatchEvent(new KeyboardEvent('keydown', { code, repeat }))
const up = (code: string) => window.dispatchEvent(new KeyboardEvent('keyup', { code }))

function setHidden(hidden: boolean): void {
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(hidden)
  document.dispatchEvent(new Event('visibilitychange'))
}

function mountGame(withPanel = false): void {
  wrapper = mount(
    defineComponent({
      components: { SettingsPanel },
      setup() {
        theme = useTheme()
        ctx = useGame()
        provide(GameKey, ctx)
      },
      template: withPanel ? '<SettingsPanel />' : '<div />',
    }),
  )
}

function play(): void {
  mountGame()
  ctx.start('marathon')
  ctx.game.frozenMs = 1e9 // sin gravedad: solo cuentan los movimientos del test
}

beforeEach(() => {
  now = 0
  rafCallback = null
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    rafCallback = cb
    return 1
  })
  vi.stubGlobal('cancelAnimationFrame', () => {
    rafCallback = null
  })
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  localStorage.clear()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useGame: repetición propia', () => {
  it('mover da un paso al pulsar, otro tras el DAS y sigue cada ARR', () => {
    play()
    const x = ctx.game.current.x
    down('ArrowLeft')
    expect(ctx.game.current.x).toBe(x - 1)
    advance(160)
    expect(ctx.game.current.x).toBe(x - 1)
    advance(10)
    expect(ctx.game.current.x).toBe(x - 2)
    advance(50)
    expect(ctx.game.current.x).toBe(x - 3)
    up('ArrowLeft')
    advance(200)
    expect(ctx.game.current.x).toBe(x - 3)
  })

  it('la auto-repetición del sistema no mueve la pieza', () => {
    play()
    const x = ctx.game.current.x
    down('ArrowLeft')
    down('ArrowLeft', true)
    down('ArrowLeft', true)
    expect(ctx.game.current.x).toBe(x - 1)
  })

  it('rotar, caída y hold no se repiten al mantener la tecla', () => {
    play()
    const spies = [
      vi.spyOn(ctx.game, 'rotate'),
      vi.spyOn(ctx.game, 'hardDrop'),
      vi.spyOn(ctx.game, 'holdPiece'),
    ]
    for (const code of ['ArrowUp', 'Space', 'KeyC']) {
      down(code)
      down(code, true)
      advance(500)
      up(code)
    }
    for (const spy of spies) expect(spy).toHaveBeenCalledTimes(1)
  })

  it('mantener la tecla de habilidades no abre y cierra el menú', () => {
    play()
    ctx.game.energy = 100
    down('KeyE')
    down('KeyE', true)
    expect(ctx.hud.skillMenu).toBe(true)
  })

  it('usa las teclas reasignadas y deja de responder a las antiguas', () => {
    play()
    ctx.settings.assignKey('left', 'KeyA')
    const x = ctx.game.current.x
    down('ArrowLeft')
    expect(ctx.game.current.x).toBe(x)
    down('KeyA')
    expect(ctx.game.current.x).toBe(x - 1)
  })

  it.each([
    ['pausar', () => ctx.togglePause()],
    ['perder el foco', () => window.dispatchEvent(new Event('blur'))],
  ])('%s olvida las teclas mantenidas', (_name, leave) => {
    play()
    down('ArrowLeft')
    leave()
    ctx.togglePause() // reanuda...
    advance(3000) // ...tras la cuenta atrás
    const x = ctx.game.current.x
    advance(500)
    expect(ctx.game.current.x).toBe(x)
  })

  it('abrir el menú de habilidades olvida las teclas mantenidas', () => {
    play()
    ctx.game.energy = 100
    down('ArrowLeft')
    down('KeyE')
    advance(10)
    down('KeyE')
    const x = ctx.game.current.x
    advance(500)
    expect(ctx.game.current.x).toBe(x)
  })
})

describe('useGame: auto-pausa', () => {
  it('perder el foco pausa la partida en marcha', () => {
    play()
    window.dispatchEvent(new Event('blur'))
    expect(ctx.game.paused).toBe(true)
  })

  it('cambiar de pestaña pausa y al reanudar hay cuenta atrás', () => {
    play()
    setHidden(true)
    expect(ctx.hud.paused).toBe(true)
    setHidden(false)
    expect(ctx.hud.paused).toBe(true) // volver no reanuda solo
    down('KeyP')
    expect(ctx.hud.countdown).toBe(3)
  })

  it('volver a la pestaña visible no pausa', () => {
    play()
    setHidden(false)
    expect(ctx.game.paused).toBe(false)
  })

  it('un segundo evento (blur + visibilitychange) no reanuda', () => {
    play()
    window.dispatchEvent(new Event('blur'))
    setHidden(true)
    expect(ctx.game.paused).toBe(true)
    expect(ctx.hud.countdown).toBe(0)
  })

  it('no se activa en el menú de modos', () => {
    mountGame()
    window.dispatchEvent(new Event('blur'))
    expect(ctx.game.paused).toBe(false)
  })

  it('no se activa con el menú de habilidades', () => {
    play()
    ctx.game.energy = 100
    down('KeyE')
    window.dispatchEvent(new Event('blur'))
    expect(ctx.game.paused).toBe(false)
  })

  it('no se activa tras el fin de partida', () => {
    play()
    ctx.game.gameOver = true
    window.dispatchEvent(new Event('blur'))
    expect(ctx.game.paused).toBe(false)
  })

  it('al desmontar retira los listeners y el bucle (HMR)', () => {
    play()
    const keep = ctx
    wrapper?.unmount()
    wrapper = undefined
    window.dispatchEvent(new Event('blur'))
    setHidden(true)
    const x = keep.game.current.x
    down('ArrowLeft')
    expect(keep.game.paused).toBe(false)
    expect(keep.game.current.x).toBe(x)
    expect(rafCallback).toBeNull()
  })
})

describe('useGame: cuenta atrás', () => {
  function pausedGame(): void {
    play()
    ctx.game.frozenMs = 0
    ctx.togglePause()
  }

  it('cuenta 3-2-1 sin avanzar el juego y luego reanuda', () => {
    pausedGame()
    const update = vi.spyOn(ctx.game, 'update')
    ctx.togglePause()
    expect(ctx.hud.countdown).toBe(3)
    advance(1000)
    expect(ctx.hud.countdown).toBe(2)
    advance(1000)
    expect(ctx.hud.countdown).toBe(1)
    advance(990)
    expect(ctx.hud.countdown).toBe(1)
    expect(ctx.game.paused).toBe(true)
    expect(update).not.toHaveBeenCalled()
    advance(10)
    expect(ctx.hud.countdown).toBe(0)
    expect(ctx.game.paused).toBe(false)
    expect(update).toHaveBeenCalled()
  })

  it('no acepta teclas de juego durante la cuenta', () => {
    pausedGame()
    ctx.togglePause()
    const x = ctx.game.current.x
    down('ArrowLeft')
    advance(1000)
    expect(ctx.game.current.x).toBe(x)
  })

  it('una tecla mantenida desde la cuenta no actúa al terminar', () => {
    pausedGame()
    ctx.togglePause()
    down('ArrowLeft')
    advance(3000)
    const x = ctx.game.current.x
    down('ArrowLeft', true)
    advance(500)
    expect(ctx.game.current.x).toBe(x)
  })

  it('pausar durante la cuenta la cancela', () => {
    pausedGame()
    ctx.togglePause()
    advance(1000)
    down('KeyP')
    expect(ctx.hud.countdown).toBe(0)
    advance(5000)
    expect(ctx.game.paused).toBe(true)
  })

  it('perder el foco durante la cuenta la cancela', () => {
    pausedGame()
    ctx.togglePause()
    window.dispatchEvent(new Event('blur'))
    expect(ctx.hud.countdown).toBe(0)
    advance(5000)
    expect(ctx.game.paused).toBe(true)
  })
})

describe('captura de teclas', () => {
  const clickFirstKey = () => wrapper!.find('.key-btn').trigger('click')

  function pausedPanel(): void {
    mountGame(true)
    ctx.start('marathon')
    ctx.togglePause()
  }

  it('R, M y P no se disparan mientras se captura y se indica el motivo', async () => {
    pausedPanel()
    await clickFirstKey()
    const skin = theme.skin.value
    const muted = ctx.hud.muted
    for (const code of ['KeyR', 'KeyM', 'KeyP']) down(code)
    await wrapper!.vm.$nextTick()
    expect(theme.skin.value).toBe(skin)
    expect(ctx.hud.muted).toBe(muted)
    expect(ctx.hud.countdown).toBe(0)
    expect(wrapper!.find('.settings-message').text()).toMatch(/pausa/)
    expect(ctx.settings.values.keys.left).toBe('ArrowLeft')
  })

  it('una tecla libre se asigna, se guarda y termina la captura', async () => {
    pausedPanel()
    await clickFirstKey()
    down('KeyA')
    await wrapper!.vm.$nextTick()
    expect(ctx.settings.values.keys.left).toBe('KeyA')
    expect(localStorage.getItem(SETTINGS_KEY)).toContain('KeyA')
    expect(wrapper!.find('.key-btn').text()).toBe('A')
    down('KeyR')
    expect(theme.skin.value).toBe('neon') // los atajos vuelven a funcionar
  })

  it('Esc cancela la captura sin reanudar ni asignar', async () => {
    pausedPanel()
    await clickFirstKey()
    down('Escape')
    expect(ctx.hud.countdown).toBe(0)
    expect(ctx.settings.values.keys.left).toBe('ArrowLeft')
    down('KeyR')
    expect(theme.skin.value).toBe('neon')
  })

  it('al desmontar el panel durante una captura se retira la señal y el listener', async () => {
    pausedPanel()
    await clickFirstKey()
    wrapper?.unmount()
    wrapper = undefined
    mountGame()
    down('KeyR')
    expect(theme.skin.value).toBe('neon')
    down('KeyA')
    expect(ctx.settings.values.keys.left).toBe('ArrowLeft')
  })
})
