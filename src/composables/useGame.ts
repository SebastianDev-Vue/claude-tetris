import { inject, markRaw, onMounted, onUnmounted, reactive, type InjectionKey } from 'vue'
import { Game } from '../engine/game'
import { isPowerUp } from '../engine/constants'
import { PopupLayer } from '../render/canvas'

type FrameListener = (now: number) => void

export interface Hud {
  score: number
  lines: number
  level: number
  powerUpInfo: string
  paused: boolean
  gameOver: boolean
}

export interface GameContext {
  /** Instancia del motor. markRaw: Vue no debe envolver el tablero en proxies (se recorre cada frame). */
  game: Game
  popups: PopupLayer
  /** Copia reactiva y plana de lo que muestra la interfaz; se sincroniza en cada frame. */
  hud: Hud
  /** Suscribe un dibujado por frame; devuelve la función para darse de baja. */
  onFrame: (fn: FrameListener) => () => void
  restart: () => void
}

export const GameKey: InjectionKey<GameContext> = Symbol('game')

export function useGameContext(): GameContext {
  const ctx = inject(GameKey)
  if (!ctx) throw new Error('useGameContext() requiere un useGame() en un componente padre')
  return ctx
}

function powerUpLabel(game: Game): string {
  if (game.frozenMs > 0) return `❄ ${Math.ceil(game.frozenMs / 1000)}s`
  if (game.pendingPowerUp || isPowerUp(game.next.type)) return '¡listo!'
  const n = game.linesToPowerUp
  return `en ${n} ${n === 1 ? 'línea' : 'líneas'}`
}

/**
 * Crea el motor y el único bucle requestAnimationFrame de la app.
 * El bucle corre siempre mientras el componente está montado y el motor ignora update()
 * en pausa / game over, así que no hay que parar ni reanudar el rAF: reanudar nunca
 * acumula el tiempo de pausa y no puede quedar un bucle vivo tras game over.
 * Se cancela en onUnmounted (importante con HMR, o cada recarga dejaría otro bucle).
 */
export function useGame(): GameContext {
  const popups = new PopupLayer()
  const game = markRaw(
    new Game({
      onEvent: (e) => popups.add(e.text, e.color, performance.now()),
    }),
  )
  const hud = reactive<Hud>({
    score: 0,
    lines: 0,
    level: 1,
    powerUpInfo: '',
    paused: false,
    gameOver: false,
  })
  const listeners = new Set<FrameListener>()
  let animId = 0
  let lastTime = 0

  function syncHud(): void {
    // Asignar el mismo valor primitivo no dispara re-render en Vue
    hud.score = game.score
    hud.lines = game.lines
    hud.level = game.level
    hud.powerUpInfo = powerUpLabel(game)
    hud.paused = game.paused
    hud.gameOver = game.gameOver
  }

  function frame(now: number): void {
    game.update(now - lastTime)
    lastTime = now
    syncHud()
    listeners.forEach((fn) => fn(now))
    animId = requestAnimationFrame(frame)
  }

  function onKeydown(e: KeyboardEvent): void {
    switch (e.code) {
      case 'KeyP':
        game.togglePause()
        break
      case 'ArrowLeft':
        game.moveLeft()
        break
      case 'ArrowRight':
        game.moveRight()
        break
      case 'ArrowDown':
        game.softDrop()
        break
      case 'ArrowUp':
      case 'KeyX':
        game.rotate()
        break
      case 'Space':
        e.preventDefault() // evita scroll y que Space active el botón con foco
        game.hardDrop()
        break
      default:
        return
    }
    syncHud()
  }

  function restart(): void {
    game.reset()
    popups.clear()
    syncHud()
  }

  function onFrame(fn: FrameListener): () => void {
    listeners.add(fn)
    return () => listeners.delete(fn)
  }

  onMounted(() => {
    window.addEventListener('keydown', onKeydown)
    lastTime = performance.now()
    animId = requestAnimationFrame(frame)
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', onKeydown)
    cancelAnimationFrame(animId)
    listeners.clear()
  })

  syncHud()
  return { game, popups, hud, onFrame, restart }
}
