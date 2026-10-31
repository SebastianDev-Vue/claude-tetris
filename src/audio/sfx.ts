import type { GameEvent } from '../engine/game'

type Wave = OscillatorType

/** Frecuencia de una nota a `semitones` semitonos de La4 (440 Hz). */
const note = (semitones: number) => 440 * 2 ** (semitones / 12)

const C5 = 3 // semitonos desde La4

/**
 * Efectos de sonido sintetizados con Web Audio (sin archivos). El AudioContext solo puede
 * crearse tras un gesto del usuario, por eso se inicializa en unlock() (primera tecla).
 * Si el navegador no tiene Web Audio, todo es no-op.
 */
export class Sfx {
  muted = false
  private ctx: AudioContext | null = null
  private master: GainNode | null = null

  unlock(): void {
    if (!this.ctx) {
      if (typeof AudioContext === 'undefined') return
      this.ctx = new AudioContext()
      this.master = this.ctx.createGain()
      this.master.gain.value = 0.25
      this.master.connect(this.ctx.destination)
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
  }

  toggleMute(): boolean {
    this.muted = !this.muted
    return this.muted
  }

  /** Reproduce el sonido asociado a un evento del motor (si lo tiene). */
  handle(event: GameEvent): void {
    switch (event.type) {
      case 'clear':
        this.playClear(event)
        break
      case 'special':
        // campanilla ascendente; más brillante para la recompensa
        this.arpeggio(
          event.kind === 'reward' ? [C5 + 12, C5 + 16, C5 + 19] : [C5, C5 + 7],
          0.06,
          'triangle',
        )
        break
    }
  }

  private playClear(event: Extract<GameEvent, { type: 'clear' }>): void {
    // el tono base sube 2 semitonos por cada nivel de combo
    const lift = (Math.min(event.combo, 10) - 1) * 2
    if (event.perfect) {
      this.arpeggio(
        [0, 4, 7, 12, 16, 19, 24, 28].map((s) => C5 + s + lift),
        0.05,
        'triangle',
      )
    } else if (event.tspin) {
      this.sweep(note(-12 + lift), note(12 + lift), 0.25, 'sawtooth')
      if (event.lines) this.arpeggio([C5 + 7 + lift, C5 + 12 + lift], 0.08, 'square', 0.25)
    } else if (event.lines >= 4) {
      this.arpeggio(
        [0, 4, 7, 12].map((s) => C5 + s + lift),
        0.06,
        'square',
      )
    } else {
      this.arpeggio([C5 + lift, C5 + 4 + lift + event.lines], 0.07, 'square')
    }
    if (event.b2b) this.tone(note(C5 + 24 + lift), 0.35, 0.18, 'sine')
  }

  // ---- Primitivas ----

  private tone(freq: number, start: number, duration: number, wave: Wave, volume = 0.5): void {
    if (this.muted || !this.ctx || !this.master) return
    const t0 = this.ctx.currentTime + start
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = wave
    osc.frequency.value = freq
    // envolvente corta: ataque rápido y caída exponencial (evita clics)
    gain.gain.setValueAtTime(0.0001, t0)
    gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
    osc.connect(gain).connect(this.master)
    osc.start(t0)
    osc.stop(t0 + duration + 0.02)
  }

  private arpeggio(semitones: number[], step: number, wave: Wave, delay = 0): void {
    semitones.forEach((s, i) => this.tone(note(s), delay + i * step, step * 2.5, wave))
  }

  private sweep(from: number, to: number, duration: number, wave: Wave): void {
    if (this.muted || !this.ctx || !this.master) return
    const t0 = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = wave
    osc.frequency.setValueAtTime(from, t0)
    osc.frequency.exponentialRampToValueAtTime(to, t0 + duration)
    gain.gain.setValueAtTime(0.0001, t0)
    gain.gain.exponentialRampToValueAtTime(0.35, t0 + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
    osc.connect(gain).connect(this.master)
    osc.start(t0)
    osc.stop(t0 + duration + 0.02)
  }
}
