export type RepeatDir = 'left' | 'right' | 'down'

export interface RepeatTiming {
  /** Retardo antes de empezar a repetir (ms). */
  das: number
  /** Intervalo entre repeticiones (ms); debe ser > 0. */
  arr: number
}

interface Channel {
  /** Teclas mantenidas en orden de pulsación: manda la última. */
  held: RepeatDir[]
  /** Tiempo hasta el próximo paso (ms). */
  ms: number
}

/**
 * Repetición propia de mover y bajar, independiente del teclado del sistema. Sin DOM ni
 * temporizadores: se avanza con update(dt) en cada frame. Bajar va en su propio canal para
 * poder mantenerla a la vez que una dirección. `timing` se lee en vivo (ajustes).
 */
export class KeyRepeat {
  private side: Channel = { held: [], ms: 0 }
  private fall: Channel = { held: [], ms: 0 }

  constructor(private timing: RepeatTiming) {}

  private channel(dir: RepeatDir): Channel {
    return dir === 'down' ? this.fall : this.side
  }

  /** El paso inicial lo da quien llama: aquí solo empieza a contar el DAS. */
  press(dir: RepeatDir): void {
    const c = this.channel(dir)
    c.held = [...c.held.filter((d) => d !== dir), dir]
    c.ms = this.timing.das
  }

  /** Si manda la otra dirección aún mantenida, espera un DAS completo sin dar un paso al soltar. */
  release(dir: RepeatDir): void {
    const c = this.channel(dir)
    if (c.held[c.held.length - 1] === dir) c.ms = this.timing.das
    c.held = c.held.filter((d) => d !== dir)
  }

  /** Olvida las teclas mantenidas (blur, pausa, menús): hace falta una pulsación nueva. */
  clear(): void {
    this.side.held = []
    this.fall.held = []
  }

  update(dt: number, step: (dir: RepeatDir) => void): void {
    for (const c of [this.side, this.fall]) {
      const dir = c.held[c.held.length - 1]
      if (!dir) continue
      c.ms -= dt
      while (c.ms <= 0) {
        step(dir)
        c.ms += this.timing.arr
      }
    }
  }
}
