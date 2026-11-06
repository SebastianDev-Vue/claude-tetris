import { afterEach, describe, expect, it, vi } from 'vitest'
import { GHOSTS_KEY, ghostDiffLabel, loadGhost, saveGhost } from '@/composables/useGhosts'
import { REPLAY_VERSION, type Replay } from '@/engine/replay'

const replay = (over: Partial<Replay> = {}): Replay => ({
  version: REPLAY_VERSION,
  seed: 42,
  mode: 'marathon',
  startLevel: 1,
  score: 1000,
  actions: [
    [0, 'moveLeft'],
    [0, 'rotate'],
    [12, 'useSkill:undo'],
  ],
  ...over,
})

const store = (data: unknown) => localStorage.setItem(GHOSTS_KEY, JSON.stringify(data))

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('saveGhost', () => {
  it('guarda la primera partida con puntos y la recupera tal cual', () => {
    expect(saveGhost(replay())).toBe(true)
    expect(loadGhost('marathon')).toEqual(replay())
  })

  it('no guarda una partida con 0 puntos', () => {
    expect(saveGhost(replay({ score: 0 }))).toBe(false)
    expect(loadGhost('marathon')).toBeNull()
  })

  it('solo sustituye al guardado si lo supera', () => {
    saveGhost(replay({ score: 1000, seed: 1 }))
    expect(saveGhost(replay({ score: 1000, seed: 2 }))).toBe(false)
    expect(saveGhost(replay({ score: 900, seed: 3 }))).toBe(false)
    expect(loadGhost('marathon')?.seed).toBe(1)
    expect(saveGhost(replay({ score: 1001, seed: 4 }))).toBe(true)
    expect(loadGhost('marathon')?.seed).toBe(4)
  })

  it('guarda un fantasma por modo, sin competir entre modos', () => {
    saveGhost(replay({ score: 5000 }))
    expect(saveGhost(replay({ mode: 'sprint', score: 10 }))).toBe(true)
    expect(loadGhost('marathon')?.score).toBe(5000)
    expect(loadGhost('sprint')?.score).toBe(10)
  })

  it('con la cuota llena no lanza error y conserva el fantasma anterior', () => {
    saveGhost(replay({ score: 1000 }))
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('llena', 'QuotaExceededError')
    })
    expect(saveGhost(replay({ score: 2000 }))).toBe(false)
    vi.restoreAllMocks()
    expect(loadGhost('marathon')?.score).toBe(1000)
  })

  it('sobrescribe datos corruptos en lugar de quedarse bloqueado', () => {
    localStorage.setItem(GHOSTS_KEY, '{no es json')
    expect(saveGhost(replay())).toBe(true)
    expect(loadGhost('marathon')).toEqual(replay())
  })
})

describe('loadGhost', () => {
  it('sin nada guardado devuelve null', () => {
    expect(loadGhost('marathon')).toBeNull()
  })

  it.each(['{no es json', '[]', 'null', '42'])('ignora datos corruptos: %s', (raw) => {
    localStorage.setItem(GHOSTS_KEY, raw)
    expect(loadGhost('marathon')).toBeNull()
  })

  it('sin localStorage disponible devuelve null', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    expect(loadGhost('marathon')).toBeNull()
  })

  it('descarta una grabación de otra versión', () => {
    store({ marathon: replay({ version: REPLAY_VERSION + 1 }) })
    expect(loadGhost('marathon')).toBeNull()
  })

  it.each<[string, unknown]>([
    ['modo distinto de su clave', { mode: 'sprint' }],
    ['semilla no entera', { seed: 1.5 }],
    ['semilla de texto', { seed: '42' }],
    ['nivel fuera de rango', { startLevel: 11 }],
    ['nivel no entero', { startLevel: 2.5 }],
    ['puntuación no numérica', { score: 'mucha' }],
    ['puntuación negativa', { score: -1 }],
    ['acciones que no son lista', { actions: {} }],
    ['acción desconocida', { actions: [[0, 'teletransportar']] }],
    ['habilidad desconocida', { actions: [[0, 'useSkill:ganar']] }],
    ['acción heredada del prototipo', { actions: [[0, 'constructor']] }],
    ['paso negativo', { actions: [[-1, 'rotate']] }],
    ['paso no entero', { actions: [[0.5, 'rotate']] }],
    [
      'pasos decrecientes',
      {
        actions: [
          [5, 'rotate'],
          [4, 'rotate'],
        ],
      },
    ],
    ['entrada sin forma de par', { actions: [['rotate']] }],
  ])('descarta una grabación con %s', (_name, over) => {
    store({ marathon: { ...replay(), ...(over as object) } })
    expect(loadGhost('marathon')).toBeNull()
  })

  it('una entrada inválida no afecta a las demás', () => {
    store({ marathon: { basura: true }, sprint: replay({ mode: 'sprint' }) })
    expect(loadGhost('marathon')).toBeNull()
    expect(loadGhost('sprint')?.mode).toBe('sprint')
  })
})

describe('ghostDiffLabel', () => {
  it('por delante: signo más, flecha arriba', () => {
    const label = ghostDiffLabel(1240)
    expect(label.trend).toBe('ahead')
    expect(label.text).toMatch(/^\+1[.,\s]?240 ▲$/)
    expect(label.note).toBe('sobre el fantasma')
  })

  it('por detrás: signo menos, flecha abajo', () => {
    const label = ghostDiffLabel(-300)
    expect(label.trend).toBe('behind')
    expect(label.text).toBe('−300 ▼')
    expect(label.note).toBe('bajo el fantasma')
  })

  it('empate: igual, sin flecha', () => {
    expect(ghostDiffLabel(0)).toEqual({ text: '=', note: 'igual que el fantasma', trend: 'tied' })
  })
})
