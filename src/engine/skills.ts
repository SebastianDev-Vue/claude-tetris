/** Habilidades que se compran con la barra de energía llena (tecla E). */
export type SkillId = 'peek' | 'swap' | 'slow' | 'undo' | 'hold'

export interface SkillInfo {
  id: SkillId
  name: string
  description: string
  icon: string
  color: string
}

export const MAX_ENERGY = 100
/** Energía por cada línea limpiada. */
export const ENERGY_PER_LINE = 10
/** Energía extra por un fijado difícil (Tetris o T-spin con líneas). */
export const ENERGY_BONUS = 10
/** Piezas de la cola visibles (la siguiente incluida). */
export const QUEUE_SIZE = 5
/** Durante cuántas piezas dura «Ver piezas». */
export const PEEK_PIECES = 10
/** Duración de «Ralentizar» y factor aplicado al intervalo de caída. */
export const SLOW_MS = 10_000
export const SLOW_FACTOR = 2

export const SKILLS: readonly SkillInfo[] = [
  {
    id: 'peek',
    name: 'Ver piezas',
    description: `Muestra las próximas ${QUEUE_SIZE} piezas durante ${PEEK_PIECES} turnos`,
    icon: '👁',
    color: '#4dd0e1',
  },
  {
    id: 'swap',
    name: 'Intercambiar',
    description: 'Cambia la pieza actual por otra estándar distinta',
    icon: '🔄',
    color: '#ba68c8',
  },
  {
    id: 'slow',
    name: 'Ralentizar',
    description: `La caída va a la mitad de velocidad durante ${SLOW_MS / 1000} s`,
    icon: '🐢',
    color: '#81c784',
  },
  {
    id: 'undo',
    name: 'Deshacer',
    description: 'Deshace el último fijado y devuelve esa pieza',
    icon: '↩',
    color: '#ffb74d',
  },
  {
    id: 'hold',
    name: 'Reservar pieza',
    description: 'Guarda la pieza actual en HOLD (o la cambia por la guardada)',
    icon: '📦',
    color: '#90caf9',
  },
]

export const skillInfo = (id: SkillId): SkillInfo | undefined => SKILLS.find((s) => s.id === id)
