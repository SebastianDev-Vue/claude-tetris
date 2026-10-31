// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Sfx } from '@/audio/sfx'
import type { GameEvent } from '@/engine/game'

/** AudioContext falso que cuenta los osciladores creados. */
class FakeAudioContext {
  static oscillators = 0
  state = 'running'
  currentTime = 0
  destination = {}
  resume = vi.fn<() => Promise<void>>()
  createGain() {
    const param = { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }
    return { gain: param, connect: (node: unknown) => node }
  }
  createOscillator() {
    FakeAudioContext.oscillators++
    const param = { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }
    return {
      type: 'sine',
      frequency: param,
      connect: (node: unknown) => node,
      start() {},
      stop() {},
    }
  }
}

const tetris: GameEvent = {
  type: 'clear',
  rows: [16, 17, 18, 19],
  lines: 4,
  combo: 1,
  tspin: false,
  b2b: false,
  perfect: false,
  points: 800,
}

afterEach(() => {
  vi.unstubAllGlobals()
  FakeAudioContext.oscillators = 0
})

describe('Sfx', () => {
  it('sin Web Audio no hace nada ni falla', () => {
    vi.stubGlobal('AudioContext', undefined)
    const sfx = new Sfx()
    sfx.unlock()
    expect(() => sfx.handle(tetris)).not.toThrow()
  })

  it('no suena antes de unlock() (el navegador exige un gesto del usuario)', () => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    new Sfx().handle(tetris)
    expect(FakeAudioContext.oscillators).toBe(0)
  })

  it('tras unlock() un Tetris suena y silenciado no', () => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const sfx = new Sfx()
    sfx.unlock()
    sfx.handle(tetris)
    expect(FakeAudioContext.oscillators).toBe(4) // arpegio de 4 notas
    expect(sfx.toggleMute()).toBe(true)
    sfx.handle(tetris)
    expect(FakeAudioContext.oscillators).toBe(4)
  })

  it('los popups no tienen sonido propio', () => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const sfx = new Sfx()
    sfx.unlock()
    sfx.handle({ type: 'popup', text: 'TETRIS', color: '#fff' })
    expect(FakeAudioContext.oscillators).toBe(0)
  })
})
