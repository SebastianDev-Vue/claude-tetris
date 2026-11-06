import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, provide } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import SettingsPanel from '@/components/SettingsPanel.vue'
import { GameKey, useGame, type GameContext } from '@/composables/useGame'
import { useTheme, type ThemeContext } from '@/composables/useTheme'
import { SETTINGS_KEY } from '@/composables/useSettings'
import { loadGhost, saveGhost } from '@/composables/useGhosts'
import { Game } from '@/engine/game'
import { REPLAY_VERSION, STEP_MS, createReplayer } from '@/engine/replay'
import { MAX_ENERGY } from '@/engine/skills'

let wrapper: VueWrapper | undefined
let ctx: GameContext
let theme: ThemeContext
let rafCallback: FrameRequestCallback | null
let now: number

/** Reloj falso: avanza `ms` entregando frames de `frame` ms (10 por defecto). */
function advance(ms: number, frame = 10): void {
  for (let t = 0; t < ms; t += frame) {
    now += frame
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

describe('useGame: pasos fijos', () => {
  it.each([7, 10, 16, 33])('el tiempo simulado no depende de los frames de %i ms', (frame) => {
    play()
    advance(990, frame)
    const real = Math.floor(990 / frame) * frame + (990 % frame ? frame : 0)
    expect(ctx.game.elapsedMs).toBeGreaterThan(real - STEP_MS - 1e-6)
    expect(ctx.game.elapsedMs).toBeLessThanOrEqual(real + 1e-6)
  })

  it('el tope de frame se mantiene: una pestaña oculta no entrega minutos de golpe', () => {
    play()
    advance(60_000, 60_000)
    expect(ctx.game.elapsedMs).toBeLessThanOrEqual(100 + 1e-6)
  })
})

/** Termina la partida en curso a golpe de caída rápida. */
function finishGame(gap = 10): void {
  for (let i = 0; i < 200 && !ctx.game.gameOver; i++) {
    down('Space')
    up('Space')
    advance(gap)
  }
  expect(ctx.game.gameOver).toBe(true)
}

/** Termina una partida que deja fantasma y empieza otra en el mismo modo. */
function playAgainstGhost(): void {
  mountGame()
  ctx.start('marathon')
  finishGame(100) // caídas espaciadas: el fantasma debe durar unos segundos
  ctx.restart()
}

describe('useGame: grabación', () => {
  it('una partida terminada se guarda y al reproducirla da el mismo resultado', () => {
    mountGame()
    ctx.start('marathon')
    down('ArrowLeft') // con repetición propia: DAS y ARR no deben importar al reproducir
    advance(300)
    up('ArrowLeft')
    down('ArrowUp')
    up('ArrowUp')
    advance(1500) // algo de gravedad entre acciones
    down('KeyC')
    up('KeyC')
    finishGame()
    const saved = loadGhost('marathon')!
    expect(saved.score).toBe(ctx.game.score)
    const [lastStep, lastAction] = saved.actions[saved.actions.length - 1]!
    expect(lastAction).toBe('hardDrop') // incluye la acción que terminó la partida
    const replayed = new Game()
    const step = createReplayer(replayed, saved)
    for (let i = 0; i <= lastStep; i++) step()
    expect(replayed.gameOver).toBe(true)
    expect(replayed.score).toBe(ctx.game.score)
    expect(replayed.board).toEqual(ctx.game.board)
    expect(replayed.lines).toBe(ctx.game.lines)
  })

  it('graba el nivel con el que empezó, aunque se cambie luego en la pausa', () => {
    mountGame()
    ctx.setStartLevel(3)
    ctx.start('marathon')
    ctx.togglePause()
    ctx.setStartLevel(7)
    ctx.togglePause()
    advance(3100)
    finishGame()
    expect(loadGhost('marathon')?.startLevel).toBe(3)
  })

  it('reiniciar o salir al menú descarta la grabación', () => {
    mountGame()
    ctx.start('marathon')
    down('Space')
    ctx.restart()
    down('Space')
    ctx.togglePause()
    ctx.openMenu()
    expect(loadGhost('marathon')).toBeNull()
  })

  it('una partida peor no sustituye al fantasma guardado', () => {
    const best = {
      version: REPLAY_VERSION,
      seed: 5,
      mode: 'marathon' as const,
      startLevel: 1,
      score: 999_999,
      actions: [],
    }
    saveGhost(best)
    mountGame()
    ctx.start('marathon')
    finishGame()
    expect(loadGhost('marathon')).toEqual(best)
  })

  it('una acción con la partida parada no se graba', () => {
    mountGame()
    ctx.start('marathon')
    ctx.game.energy = MAX_ENERGY
    ctx.togglePause()
    ctx.useSkill('slow') // el motor la rechaza en pausa; el fantasma no estaría en pausa
    ctx.togglePause()
    advance(3100)
    finishGame()
    const actions = loadGhost('marathon')!.actions.map(([, a]) => a)
    expect(actions).not.toContain('useSkill:slow')
  })

  it('terminar a mitad de frame no da más pasos', () => {
    mountGame()
    ctx.start('marathon')
    finishGame()
    const elapsed = ctx.game.elapsedMs
    advance(500)
    expect(ctx.game.elapsedMs).toBe(elapsed)
  })
})

describe('useGame: fantasma en partida', () => {
  it('sin grabación no hay fantasma', () => {
    play()
    expect(ctx.hud.hasGhost).toBe(false)
  })

  it('el fantasma avanza a la par que el jugador', () => {
    playAgainstGhost()
    expect(ctx.hud.hasGhost).toBe(true)
    advance(200)
    expect(ctx.ghost.elapsedMs).toBeGreaterThan(0)
    expect(ctx.ghost.elapsedMs).toBe(ctx.game.elapsedMs)
  })

  it('reproduce sus acciones y Hud lleva la diferencia de puntos', () => {
    playAgainstGhost()
    advance(100)
    expect(ctx.ghost.score).toBeGreaterThan(0) // ya ha hecho al menos una caída rápida
    down('Space')
    up('Space')
    advance(10)
    expect(ctx.hud.ghostScore).toBe(ctx.ghost.score)
    expect(ctx.hud.ghostDiff).toBe(ctx.game.score - ctx.ghost.score)
  })

  it('el fantasma no emite efectos ni sonido', () => {
    playAgainstGhost()
    const handle = vi.spyOn(ctx.effects, 'handle')
    advance(100) // el fantasma hace caídas; el jugador, ninguna
    expect(ctx.ghost.score).toBeGreaterThan(0)
    expect(handle).not.toHaveBeenCalled()
  })

  it.each([
    ['la pausa', () => ctx.togglePause()],
    [
      'el menú de habilidades',
      () => {
        ctx.game.energy = MAX_ENERGY
        down('KeyE')
      },
    ],
  ])('%s detiene a ambos', (_name, stop) => {
    playAgainstGhost()
    advance(100)
    stop()
    const [player, ghost] = [ctx.game.elapsedMs, ctx.ghost.elapsedMs]
    advance(500)
    expect(ctx.game.elapsedMs).toBe(player)
    expect(ctx.ghost.elapsedMs).toBe(ghost)
  })

  it('la cuenta atrás detiene a ambos', () => {
    playAgainstGhost()
    advance(100)
    ctx.togglePause()
    ctx.togglePause()
    const ghost = ctx.ghost.elapsedMs
    advance(2900)
    expect(ctx.ghost.elapsedMs).toBe(ghost)
    advance(300)
    expect(ctx.ghost.elapsedMs).toBeGreaterThan(ghost)
  })

  it('si termina antes queda fijo y mantiene su puntuación final', () => {
    playAgainstGhost()
    ctx.game.frozenMs = 1e9 // el jugador aguanta; el fantasma se agota con sus caídas
    for (let i = 0; i < 300 && !ctx.ghost.gameOver; i++) advance(100)
    expect(ctx.ghost.gameOver).toBe(true)
    expect(ctx.hud.ghostFinished).toBe(true)
    const board = ctx.ghost.board.map((row) => [...row])
    const score = ctx.ghost.score
    advance(1000)
    expect(ctx.ghost.board).toEqual(board)
    expect(ctx.hud.ghostScore).toBe(score)
  })

  it('reiniciar carga la mejor marca y arranca al fantasma de cero', () => {
    playAgainstGhost()
    advance(500)
    ctx.restart()
    expect(ctx.ghost.elapsedMs).toBe(0)
    expect(ctx.ghost.gameOver).toBe(false)
  })

  it('desmontar para el bucle: el fantasma no sigue avanzando', () => {
    playAgainstGhost()
    advance(100)
    const { ghost } = ctx
    const elapsed = ghost.elapsedMs
    wrapper?.unmount()
    wrapper = undefined
    expect(rafCallback).toBeNull()
    advance(500)
    expect(ghost.elapsedMs).toBe(elapsed)
  })
})
