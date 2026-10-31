import { inject, markRaw, onMounted, onUnmounted, reactive, type InjectionKey } from 'vue'
import { Game } from '../engine/game'
import { isPowerUp } from '../engine/constants'
import { MODES, formatTime, type GameMode } from '../engine/challenges'
import { SKILLS, type SkillId } from '../engine/skills'
import { Effects } from '../render/effects'
import { Sfx } from '../audio/sfx'
import { isTypingTarget } from './useTheme'

// Tope del dt por frame: al volver de una pestaña oculta rAF entrega minutos de golpe
const MAX_FRAME_MS = 100
// Tras reanudar se ignoran las teclas de juego un instante para evitar movimientos accidentales
const RESUME_GRACE_MS = 200

type FrameListener = (now: number) => void

export interface Hud {
  score: number
  lines: number
  level: number
  powerUpInfo: string
  paused: boolean
  gameOver: boolean
  /** Fijados consecutivos con líneas (el panel muestra el multiplicador desde 2). */
  combo: number
  /** Mejor combo de la partida (tabla de récords). */
  maxCombo: number
  b2b: boolean
  muted: boolean
  /** Pantalla de selección de modo visible (el juego no avanza). */
  menu: boolean
  mode: GameMode
  /** Nombre del desafío activo ('' en Maratón). */
  challengeName: string
  /** Progreso del objetivo del desafío ('' en Maratón). */
  objective: string
  won: boolean
  endReason: string
  /** Energía 0–100 y si la barra está llena (habilidades disponibles). */
  energy: number
  energyFull: boolean
  /** Menú de habilidades abierto (el juego no avanza). */
  skillMenu: boolean
  /** «Ver piezas» activa: el panel muestra la cola completa. */
  peek: boolean
  /** Efectos temporales activos, para teñir el tablero. */
  slowed: boolean
  frozen: boolean
  /** HOLD ya usado en este turno (el slot se atenúa). */
  holdUsed: boolean
  /** La pieza que entraría con HOLD cabe (si no, Hold extra no serviría de nada). */
  holdFits: boolean
  canUndo: boolean
  /** Tiempo de juego formateado (m:ss). */
  time: string
  /** Nivel con el que empezará la próxima partida. */
  startLevel: number
}

export interface GameContext {
  /** Instancia del motor. markRaw: Vue no debe envolver el tablero en proxies (se recorre cada frame). */
  game: Game
  /** Efectos visuales pasajeros (popups, partículas, ondas) generados por eventos del motor. */
  effects: Effects
  /** Copia reactiva y plana de lo que muestra la interfaz; se sincroniza en cada frame. */
  hud: Hud
  /** Suscribe un dibujado por frame; devuelve la función para darse de baja. */
  onFrame: (fn: FrameListener) => () => void
  /** Empieza una partida nueva en el modo indicado. */
  start: (mode: GameMode) => void
  /** Repite el modo actual. */
  restart: () => void
  /** Vuelve a la pantalla de selección de modo. */
  openMenu: () => void
  togglePause: () => void
  /** Nivel inicial de la próxima partida (1–10). */
  setStartLevel: (level: number) => void
  /** Usa una habilidad desde el menú (lo cierra y reanuda). */
  useSkill: (id: SkillId) => void
  closeSkillMenu: () => void
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
 * en pausa / game over (y no se llama con el menú abierto), así que no hay que parar ni
 * reanudar el rAF: reanudar nunca acumula el tiempo de pausa y no puede quedar un bucle
 * vivo tras game over. Se cancela en onUnmounted (importante con HMR, o cada recarga
 * dejaría otro bucle).
 */
export function useGame(): GameContext {
  const effects = new Effects()
  const sfx = new Sfx()
  const game = markRaw(
    new Game({
      onEvent: (e) => {
        effects.handle(e, performance.now())
        sfx.handle(e)
      },
    }),
  )
  const hud = reactive<Hud>({
    score: 0,
    lines: 0,
    level: 1,
    powerUpInfo: '',
    paused: false,
    gameOver: false,
    combo: 0,
    maxCombo: 0,
    b2b: false,
    muted: false,
    menu: true, // la app arranca en la pantalla de selección de modo
    mode: 'marathon',
    challengeName: '',
    objective: '',
    won: false,
    endReason: '',
    time: '0:00',
    energy: 0,
    energyFull: false,
    skillMenu: false,
    peek: false,
    slowed: false,
    frozen: false,
    holdUsed: false,
    holdFits: true,
    canUndo: false,
    startLevel: 1,
  })
  const listeners = new Set<FrameListener>()
  let animId = 0
  let lastTime = 0
  let resumedAt = -Infinity
  /** Tras reanudar, la auto-repetición de una tecla ya pulsada no cuenta hasta una pulsación nueva. */
  let ignoreRepeat = false

  function syncHud(): void {
    // Asignar el mismo valor primitivo no dispara re-render en Vue
    hud.score = game.score
    hud.lines = game.lines
    hud.level = game.level
    hud.powerUpInfo = powerUpLabel(game)
    hud.paused = game.paused
    hud.gameOver = game.gameOver
    hud.combo = game.combo
    hud.maxCombo = game.maxCombo
    hud.b2b = game.b2b
    hud.muted = sfx.muted
    hud.mode = game.mode
    hud.challengeName = game.challenge?.name ?? ''
    hud.objective = game.challenge?.progress(game) ?? ''
    hud.won = game.result === 'won'
    hud.endReason = game.endReason
    hud.time = formatTime(game.elapsedMs)
    hud.energy = game.energy
    hud.energyFull = game.energyFull
    hud.peek = game.peekPieces > 0
    hud.slowed = game.slowMs > 0
    hud.frozen = game.frozenMs > 0
    hud.holdUsed = game.holdUsed
    hud.holdFits = game.holdFits
    hud.canUndo = game.canUndo
    hud.startLevel = game.startLevel
  }

  function frame(now: number): void {
    if (!hud.menu && !hud.skillMenu) game.update(Math.min(now - lastTime, MAX_FRAME_MS))
    lastTime = now
    syncHud()
    listeners.forEach((fn) => fn(now))
    animId = requestAnimationFrame(frame)
  }

  function start(mode: GameMode): void {
    // Limpiar antes de reset(): reset() ya puede anunciar una primera pieza especial
    effects.clear()
    game.reset(mode)
    hud.menu = false
    hud.skillMenu = false
    syncHud()
  }

  function restart(): void {
    start(game.mode)
  }

  function openMenu(): void {
    hud.menu = true
    hud.skillMenu = false
    syncHud()
  }

  function togglePause(): void {
    game.togglePause()
    if (!game.paused) {
      resumedAt = performance.now()
      ignoreRepeat = true
    }
    syncHud()
  }

  function setStartLevel(level: number): void {
    game.setStartLevel(level)
    syncHud()
  }

  /** El menú de habilidades solo se abre con la barra llena y la partida en marcha. */
  function openSkillMenu(): void {
    if (!game.energyFull || game.paused || game.gameOver) return
    hud.skillMenu = true
  }

  function closeSkillMenu(): void {
    hud.skillMenu = false
    syncHud()
  }

  function useSkill(id: SkillId): void {
    hud.skillMenu = false // el motor ignora input en menú/pausa, así que cerrar primero
    game.useSkill(id)
    syncHud()
  }

  function onSkillKey(e: KeyboardEvent): void {
    if (e.code === 'Escape' || e.code === 'KeyE') return closeSkillMenu()
    const skill = SKILLS[Number(e.key) - 1]
    if (skill) useSkill(skill.id)
  }

  function onMenuKey(e: KeyboardEvent): void {
    // Teclas 1–6 eligen modo en la pantalla de menú
    const index = Number(e.key) - 1
    const mode = MODES[index]
    if (mode) start(mode.id)
  }

  function onKeydown(e: KeyboardEvent): void {
    if (isTypingTarget(e.target)) return // escribir el nombre del récord no es jugar
    sfx.unlock() // el audio solo puede activarse tras un gesto del usuario
    if (e.code === 'KeyM') {
      sfx.toggleMute()
      return syncHud()
    }
    if (hud.menu) return onMenuKey(e)
    if (hud.skillMenu) return onSkillKey(e)
    if (e.code === 'KeyP' || e.code === 'Escape') {
      if (!e.repeat) togglePause()
      return
    }
    // Con el menú de pausa abierto (o recién cerrado) las teclas de juego no llegan al motor
    if (game.paused || performance.now() - resumedAt < RESUME_GRACE_MS) return
    if (e.repeat && ignoreRepeat) return
    if (!e.repeat) ignoreRepeat = false
    switch (e.code) {
      case 'KeyC':
        if (!e.repeat) game.holdPiece() // mantener C pulsada no debe guardar cada pieza nueva
        break
      case 'KeyE':
        openSkillMenu()
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
  return {
    game,
    effects,
    hud,
    onFrame,
    start,
    restart,
    openMenu,
    togglePause,
    setStartLevel,
    useSkill,
    closeSkillMenu,
  }
}
