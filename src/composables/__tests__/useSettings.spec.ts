import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  SETTINGS_KEY,
  actionForKey,
  defaultSettings,
  keyLabel,
  parseSettings,
  rejectKey,
  useSettings,
} from '@/composables/useSettings'

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('useSettings: guardar y recuperar', () => {
  it('sin nada guardado usa los valores por defecto', () => {
    expect(useSettings().values).toEqual(defaultSettings())
  })

  it('guarda tiempos y teclas y los recupera en la siguiente sesión', () => {
    const first = useSettings()
    first.setTiming('das', 120)
    first.setTiming('arr', 30)
    expect(first.assignKey('hold', 'KeyZ')).toBeNull()
    const second = useSettings().values
    expect(second.das).toBe(120)
    expect(second.arr).toBe(30)
    expect(second.keys.hold).toBe('KeyZ')
  })

  it('setTiming limita al rango del slider', () => {
    const { values, setTiming } = useSettings()
    setTiming('arr', 0)
    expect(values.arr).toBe(10)
    setTiming('das', 9999)
    expect(values.das).toBe(300)
  })

  it('restaurar vuelve a los valores por defecto y lo guarda', () => {
    const first = useSettings()
    first.setTiming('das', 120)
    first.assignKey('hold', 'KeyZ')
    first.restoreDefaults()
    expect(first.values).toEqual(defaultSettings())
    expect(useSettings().values).toEqual(defaultSettings())
  })

  it('sin almacenamiento sigue funcionando durante la sesión', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    const { values, setTiming } = useSettings()
    expect(values).toEqual(defaultSettings())
    setTiming('das', 100)
    expect(values.das).toBe(100)
  })
})

describe('parseSettings: datos inválidos', () => {
  const defaults = defaultSettings()

  it.each(['no es json', 'null', '5', '"texto"', '[]', '{}'])('%s vuelve a los defectos', (raw) => {
    expect(parseSettings(raw)).toEqual(defaults)
  })

  it('versusGhost viene activado y se conserva si es booleano', () => {
    expect(defaults.versusGhost).toBe(true)
    expect(parseSettings(JSON.stringify({ versusGhost: false })).versusGhost).toBe(false)
  })

  it.each([['"no"'], ['0'], ['null']])('versusGhost %s vuelve al defecto', (raw) => {
    expect(parseSettings(`{"versusGhost":${raw}}`).versusGhost).toBe(true)
  })

  it('setVersusGhost se guarda para la siguiente sesión', () => {
    useSettings().setVersusGhost(false)
    expect(useSettings().values.versusGhost).toBe(false)
  })

  it('un tiempo no numérico se sustituye y el resto se conserva', () => {
    const s = parseSettings(JSON.stringify({ das: 'rápido', arr: 30 }))
    expect(s.das).toBe(defaults.das)
    expect(s.arr).toBe(30)
  })

  it('un ARR guardado de 0 o negativo no llega a la repetición', () => {
    expect(parseSettings(JSON.stringify({ arr: 0 })).arr).toBe(10)
    expect(parseSettings(JSON.stringify({ arr: -5 })).arr).toBe(10)
  })

  it.each([
    ['tecla reservada', { hold: 'KeyR' }],
    ['Shift', { hold: 'ShiftLeft' }],
    ['tecla duplicada', { hold: 'KeyX' }],
    ['tipo erróneo', { hold: 5 }],
    ['tecla vacía', { hold: '' }],
  ])('con %s restaura todas las teclas sin duplicar', (_name, patch) => {
    const keys = { ...defaults.keys, left: 'KeyC', ...patch }
    expect(parseSettings(JSON.stringify({ keys })).keys).toEqual(defaults.keys)
  })

  it('un mapa de teclas incompleto vuelve a los defectos', () => {
    expect(parseSettings(JSON.stringify({ keys: { left: 'KeyA' } })).keys).toEqual(defaults.keys)
  })

  it('un mapa de teclas válido se conserva', () => {
    const keys = { ...defaults.keys, left: 'KeyA', right: 'KeyD' }
    expect(parseSettings(JSON.stringify({ keys })).keys).toEqual(keys)
  })

  it('al cargar desde localStorage también se valida', () => {
    localStorage.setItem(SETTINGS_KEY, '{roto')
    expect(useSettings().values).toEqual(defaults)
  })
})

describe('rejectKey: teclas rechazadas', () => {
  const { keys } = defaultSettings()

  it.each([
    ['KeyR', /skin/],
    ['KeyM', /sonido/],
    ['KeyP', /pausa/],
    ['Escape', /pausa/],
    ['Digit1', /números/],
    ['Numpad7', /números/],
    ['ShiftLeft', /Teclas especiales/],
    ['ShiftRight', /Teclas especiales/],
    ['AltLeft', /foco/],
    ['MetaLeft', /foco/],
  ])('%s se rechaza indicando el motivo', (code, reason) => {
    expect(rejectKey(keys, 'hold', code)).toMatch(reason)
  })

  it('una tecla de otra acción se rechaza nombrando esa acción', () => {
    expect(rejectKey(keys, 'hold', 'KeyX')).toBe('X ya está asignada a «rotar (alt.)»')
  })

  it('una tecla libre o la propia acción se aceptan', () => {
    expect(rejectKey(keys, 'hold', 'KeyZ')).toBeNull()
    expect(rejectKey(keys, 'hold', 'KeyC')).toBeNull()
  })

  it('assignKey rechazada no cambia ni guarda nada', () => {
    const { values, assignKey } = useSettings()
    expect(assignKey('hold', 'KeyR')).toMatch(/skin/)
    expect(values.keys.hold).toBe('KeyC')
    expect(localStorage.getItem(SETTINGS_KEY)).toBeNull()
  })
})

describe('utilidades de teclas', () => {
  it('keyLabel muestra flechas y letras de forma legible', () => {
    expect(keyLabel('ArrowLeft')).toBe('←')
    expect(keyLabel('KeyC')).toBe('C')
    expect(keyLabel('Space')).toBe('Space')
  })

  it('actionForKey encuentra la acción de una tecla', () => {
    const { keys } = defaultSettings()
    expect(actionForKey(keys, 'KeyX')).toBe('rotateAlt')
    expect(actionForKey(keys, 'KeyQ')).toBeUndefined()
  })
})
