// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { MODES, type GameMode } from '../challenges'
import { COLS, POWER_NAMES, ROWS } from '../constants'
import { Game, forEachCell, rotateCCW, rotateCW, type GameEvent, type Piece } from '../game'
import {
  REPLAY_VERSION,
  STEP_MS,
  applyAction,
  createReplayer,
  type RecordedAction,
  type ReplayAction,
} from '../replay'
import { createRng } from '../rng'
import { MAX_ENERGY, SKILLS } from '../skills'

const MAX_STEPS = 12_000
/** Un bot que actúa cada pocos pasos deja caer unas 2 piezas por segundo. */
const BOT_EVERY = 12
/** Cada cierto tiempo se rellena la barra y se usa la siguiente habilidad de la lista. */
const SKILL_EVERY = 400

/** Coste de dejar una forma en (x, y): altura, huecos y desniveles penalizan; las líneas premian. */
function placementCost(g: Game, shape: number[][], x: number, y: number): number {
  const board = g.board.map((row) => [...row])
  forEachCell(shape, (r, c) => {
    const row = board[y + r]
    if (row) row[x + c] = 1
  })
  const kept = board.filter((row) => row.some((v) => !v))
  const lines = ROWS - kept.length
  let height = 0
  let holes = 0
  let bumps = 0
  let prev = -1
  for (let c = 0; c < COLS; c++) {
    const top = kept.findIndex((row) => row[c])
    const h = top < 0 ? 0 : kept.length - top
    height += h
    if (top >= 0) for (let r = top; r < kept.length; r++) if (!kept[r]?.[c]) holes++
    if (prev >= 0) bumps += Math.abs(h - prev)
    prev = h
  }
  return height * 5 + holes * 4 + bumps * 2 - lines * 8
}

/** Mejor colocación de la pieza actual: giros necesarios y columna final. */
function plan(g: Game): { turns: number; x: number } {
  const turn = g.rotationReversed ? rotateCCW : rotateCW
  let best = { turns: 0, x: g.current.x, cost: Infinity }
  let shape = g.current.shape
  for (let turns = 0; turns < 4; turns++) {
    for (let x = -2; x < COLS; x++) {
      if (g.collide(shape, x, g.current.y)) continue
      let y = g.current.y
      while (!g.collide(shape, x, y + 1)) y++
      const cost = placementCost(g, shape, x, y)
      if (cost < best.cost) best = { turns, x, cost }
    }
    shape = turn(shape)
  }
  return best
}

/** Jugador simulado: coloca piezas con cabeza y mete algún soft drop y hold por el camino. */
function createBot(seed: number): (g: Game) => ReplayAction {
  const random = createRng(seed)
  let piece: Piece | null = null
  let target = { turns: 0, x: 0 }
  return (g) => {
    if (g.current !== piece) {
      piece = g.current
      target = plan(g)
      if (random() < 0.1) return 'holdPiece'
    }
    if (random() < 0.1) return 'softDrop'
    if (target.turns > 0) {
      target.turns--
      return 'rotate'
    }
    if (g.current.x < target.x && !g.collide(g.current.shape, g.current.x + 1, g.current.y))
      return 'moveRight'
    if (g.current.x > target.x && !g.collide(g.current.shape, g.current.x - 1, g.current.y))
      return 'moveLeft'
    return 'hardDrop'
  }
}

function snapshot(g: Game) {
  return {
    board: g.board,
    score: g.score,
    lines: g.lines,
    level: g.level,
    combo: g.combo,
    b2b: g.b2b,
    energy: g.energy,
    elapsedMs: g.elapsedMs,
    current: g.current,
    queue: g.queue,
    hold: g.hold,
    gameOver: g.gameOver,
    result: g.result,
  }
}

/** Juega como lo hará useGame: en cada paso, primero las acciones y luego update(). */
function playLive(mode: GameMode, seed: number, startLevel: number) {
  const events: GameEvent[] = []
  const game = new Game({ onEvent: (e) => events.push(e) })
  game.setStartLevel(startLevel)
  game.reset(mode, seed)
  const bot = createBot(seed)
  const actions: RecordedAction[] = []
  const energyAt = new Set<number>()
  const act = (step: number, action: ReplayAction) => {
    actions.push([step, action])
    applyAction(game, action)
  }
  let step = 0
  let nextSkill = SKILLS.findIndex((s) => s.id === 'undo') // primero: algunas partidas duran poco
  for (; step < MAX_STEPS && !game.gameOver; step++) {
    if (step % SKILL_EVERY === SKILL_EVERY - 1) {
      game.energy = MAX_ENERGY
      energyAt.add(step)
      const { id } = SKILLS[nextSkill++ % SKILLS.length]!
      if (id === 'hold') act(step, 'holdPiece') // Hold extra solo se aplica con HOLD ya usado
      act(step, `useSkill:${id}`)
    } else if (step % BOT_EVERY === 0) {
      act(step, bot(game))
    }
    // La interfaz lee esto cada frame: leer no debe gastar números aleatorios
    void game.holdFits
    void game.next
    game.update(STEP_MS)
  }
  return { game, events, actions, energyAt, steps: step }
}

function replayGame(
  mode: GameMode,
  seed: number,
  startLevel: number,
  live: ReturnType<typeof playLive>,
) {
  const ghost = new Game() // sin onEvent, como el fantasma real
  const step = createReplayer(ghost, {
    version: REPLAY_VERSION,
    seed,
    mode,
    startLevel,
    score: live.game.score,
    actions: live.actions,
  })
  for (let i = 0; i < live.steps; i++) {
    if (live.energyAt.has(i)) ghost.energy = MAX_ENERGY
    step()
  }
  return ghost
}

describe('createRng', () => {
  it('la misma semilla da la misma secuencia y otra semilla, otra distinta', () => {
    const seq = (seed: number) => {
      const random = createRng(seed)
      return Array.from({ length: 50 }, () => random())
    }
    expect(seq(42)).toEqual(seq(42))
    expect(seq(42)).not.toEqual(seq(43))
  })

  it('devuelve valores en [0, 1)', () => {
    const random = createRng(7)
    for (let i = 0; i < 10_000; i++) {
      const v = random()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe('reset con semilla', () => {
  it('vuelve a sembrar antes de generar nada, sea cual sea el generador anterior', () => {
    const a = new Game()
    a.reset('fixed', 1234)
    const b = new Game({ random: () => 0.5 })
    b.hardDrop()
    b.reset('fixed', 1234)
    expect(snapshot(b)).toEqual(snapshot(a))
  })
})

describe.each(MODES.map((m) => m.id))('reproducción en modo %s', (mode) => {
  it.each([1, 3])('misma semilla y acciones dan la misma partida (nivel %i)', (startLevel) => {
    const seed = 1000 + startLevel
    const live = playLive(mode, seed, startLevel)
    const ghost = replayGame(mode, seed, startLevel, live)
    expect(snapshot(ghost)).toEqual(snapshot(live.game))
    expect(ghost.score).toBeGreaterThan(0)
    expect(live.game.lines).toBeGreaterThan(0)
    expect(live.events.some((e) => e.type === 'skill' && e.id === 'undo' && e.ok)).toBe(true)
  })
})

describe('el test de reproducción ejercita lo que dice', () => {
  const live = playLive('marathon', 2024, 1)
  const skills = live.events.filter((e) => e.type === 'skill')

  it('aplica de verdad todas las habilidades, incluida Deshacer', () => {
    const applied = skills.flatMap((e) => (e.ok ? [e.id] : []))
    expect(SKILLS.map((s) => s.id).filter((id) => !applied.includes(id))).toEqual([])
  })

  it('llega a usar power-ups, que también gastan del flujo aleatorio', () => {
    const names = Object.values(POWER_NAMES)
    expect(live.events.some((e) => e.type === 'popup' && names.includes(e.text))).toBe(true)
  })

  it('una acción distinta cambia el resultado', () => {
    const altered = live.actions.map(([s, a]): RecordedAction => [
      s,
      a === 'moveLeft' ? 'moveRight' : a,
    ])
    const ghost = new Game()
    const step = createReplayer(ghost, {
      version: REPLAY_VERSION,
      seed: 2024,
      mode: 'marathon',
      startLevel: 1,
      score: 0,
      actions: altered,
    })
    for (let i = 0; i < live.steps; i++) {
      if (live.energyAt.has(i)) ghost.energy = MAX_ENERGY
      step()
    }
    expect(ghost.board).not.toEqual(live.game.board)
  })
})

describe('createReplayer', () => {
  it('aplica el nivel inicial grabado aunque el ajuste actual sea otro', () => {
    const ghost = new Game()
    ghost.setStartLevel(9)
    createReplayer(ghost, {
      version: REPLAY_VERSION,
      seed: 1,
      mode: 'marathon',
      startLevel: 4,
      score: 0,
      actions: [],
    })
    expect(ghost.level).toBe(4)
  })

  it('aplica las acciones de un paso antes de su update', () => {
    const ghost = new Game()
    const step = createReplayer(ghost, {
      version: REPLAY_VERSION,
      seed: 1,
      mode: 'marathon',
      startLevel: 1,
      score: 0,
      actions: [
        [0, 'moveLeft'],
        [2, 'moveLeft'],
      ],
    })
    const x = ghost.current.x
    step()
    expect(ghost.current.x).toBe(x - 1)
    expect(ghost.elapsedMs).toBeCloseTo(STEP_MS)
    step()
    expect(ghost.current.x).toBe(x - 1)
    step()
    expect(ghost.current.x).toBe(x - 2)
  })
})

describe('ritmo de caída con pasos fijos', () => {
  it.each([1, 5, 10])('nivel %i: el intervalo nominal con un paso de tolerancia', (level) => {
    const g = new Game()
    g.setStartLevel(level)
    g.reset('marathon', 1)
    const y = g.current.y
    let steps = 0
    while (g.current.y === y) {
      g.update(STEP_MS)
      steps++
    }
    const elapsed = steps * STEP_MS
    expect(elapsed).toBeGreaterThanOrEqual(g.dropInterval - 1e-6)
    expect(elapsed).toBeLessThanOrEqual(g.dropInterval + STEP_MS + 1e-6)
  })
})
