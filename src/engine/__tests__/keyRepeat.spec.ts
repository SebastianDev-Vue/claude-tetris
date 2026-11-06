// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest'
import { KeyRepeat, type RepeatDir } from '../keyRepeat'

let repeat: KeyRepeat
let steps: RepeatDir[]

/** Reloj falso: avanza `ms` en frames de 10 ms. */
function advance(ms: number): void {
  for (let t = 0; t < ms; t += 10) repeat.update(10, (d) => steps.push(d))
}

beforeEach(() => {
  repeat = new KeyRepeat({ das: 170, arr: 50 })
  steps = []
})

describe('KeyRepeat', () => {
  it('no repite antes de cumplirse el DAS', () => {
    repeat.press('left')
    advance(160)
    expect(steps).toEqual([])
    advance(10)
    expect(steps).toEqual(['left'])
  })

  it('tras el DAS repite cada ARR', () => {
    repeat.press('right')
    advance(170 + 50 * 3)
    expect(steps).toEqual(['right', 'right', 'right', 'right'])
  })

  it('un frame largo no pierde repeticiones', () => {
    repeat.press('left')
    repeat.update(270, (d) => steps.push(d))
    expect(steps).toEqual(['left', 'left', 'left'])
  })

  it('soltar la tecla detiene la repetición', () => {
    repeat.press('left')
    advance(170)
    repeat.release('left')
    advance(500)
    expect(steps).toEqual(['left'])
  })

  it('con las dos direcciones manda la última pulsada y reinicia el DAS', () => {
    repeat.press('left')
    advance(170)
    steps = []
    repeat.press('right')
    advance(160)
    expect(steps).toEqual([])
    advance(10)
    expect(steps).toEqual(['right'])
  })

  it('al soltar la que manda, la otra sigue tras un DAS completo y sin paso inmediato', () => {
    repeat.press('left')
    repeat.press('right')
    advance(100)
    repeat.release('right')
    advance(160)
    expect(steps).toEqual([])
    advance(10)
    expect(steps).toEqual(['left'])
  })

  it('soltar la que no manda no altera a la activa', () => {
    repeat.press('left')
    repeat.press('right')
    advance(100)
    repeat.release('left')
    advance(70)
    expect(steps).toEqual(['right'])
  })

  it('bajar es independiente de la dirección', () => {
    repeat.press('left')
    advance(100)
    repeat.press('down')
    advance(70)
    expect(steps).toEqual(['left'])
    advance(100)
    expect(steps).toEqual(['left', 'left', 'left', 'down'])
  })

  it('clear() olvida las teclas mantenidas y un keyup posterior no molesta', () => {
    repeat.press('left')
    repeat.press('down')
    repeat.clear()
    advance(500)
    repeat.release('left')
    advance(500)
    expect(steps).toEqual([])
  })

  it('una pulsación sin keyup previo (keyup perdido) no duplica la tecla', () => {
    repeat.press('left')
    repeat.press('left')
    repeat.release('left')
    advance(500)
    expect(steps).toEqual([])
  })

  it('lee DAS y ARR en vivo', () => {
    const timing = { das: 170, arr: 50 }
    repeat = new KeyRepeat(timing)
    timing.das = 50
    repeat.press('left')
    advance(50)
    expect(steps).toEqual(['left'])
  })
})
