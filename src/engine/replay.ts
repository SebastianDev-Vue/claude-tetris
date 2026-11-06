import type { GameMode } from './challenges'
import type { Game } from './game'
import type { SkillId } from './skills'

/** Paso fijo de la simulación: la partida es función de semilla, modo, nivel inicial y acciones. */
export const STEP_MS = 1000 / 120
/** Subir al cambiar las reglas: las grabaciones de otra versión ya no se reproducirían igual. */
export const REPLAY_VERSION = 1

export type ReplayAction =
  | 'moveLeft'
  | 'moveRight'
  | 'softDrop'
  | 'rotate'
  | 'hardDrop'
  | 'holdPiece'
  | `useSkill:${SkillId}`

/** [paso, acción]: la acción se aplica antes del update() de ese paso. */
export type RecordedAction = [step: number, action: ReplayAction]

export interface Replay {
  version: number
  seed: number
  mode: GameMode
  startLevel: number
  score: number
  actions: RecordedAction[]
}

/** Único punto que traduce una acción grabada a un método del motor. */
export function applyAction(game: Game, action: ReplayAction): void {
  if (action.startsWith('useSkill:')) {
    game.useSkill(action.slice('useSkill:'.length) as SkillId)
    return
  }
  game[action as Exclude<ReplayAction, `useSkill:${SkillId}`>]()
}

/** Prepara `game` para reproducir la partida y devuelve la función que avanza un paso. */
export function createReplayer(game: Game, replay: Replay): () => void {
  game.setStartLevel(replay.startLevel)
  game.reset(replay.mode, replay.seed)
  let step = 0
  let next = 0
  return () => {
    for (
      let entry = replay.actions[next];
      entry && entry[0] <= step;
      entry = replay.actions[next]
    ) {
      applyAction(game, entry[1])
      next++
    }
    game.update(STEP_MS)
    step++
  }
}
