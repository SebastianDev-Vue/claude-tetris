import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick, reactive, shallowRef } from 'vue'
import GameOverlay from '@/components/GameOverlay.vue'
import { GameKey, type GameContext, type Hud } from '@/composables/useGame'
import { RECORDS_KEY, type RecordEntry } from '@/composables/useRecords'
import type { RunStats } from '@/composables/useRunStats'

const noRun: RunStats = {
  tetrises: 0,
  tspins: 0,
  bestCombo: 0,
  perfects: 0,
  pieces: 0,
  lines: 0,
  bestPlay: null,
  level: 1,
  samples: [{ ms: 0, score: 0 }],
  levelUps: [],
}

const saved = (score: number, mode: RecordEntry['mode']): RecordEntry => ({
  name: 'Ana',
  score,
  lines: 1,
  maxCombo: 1,
  mode,
  date: '2026-01-01T00:00:00.000Z',
})

/** Monta el overlay en juego y pasa a fin de partida con el estado indicado. */
async function finish(
  hudOver: Partial<Hud>,
  stats: Partial<RunStats> = {},
  records = [saved(1000, 'marathon')],
) {
  localStorage.setItem(RECORDS_KEY, JSON.stringify(records))
  const hud = reactive({
    menu: false,
    gameOver: false,
    paused: false,
    skillMenu: false,
    mode: 'marathon',
    score: 0,
    lines: 0,
    maxCombo: 0,
    won: false,
    endReason: '',
    time: '0:00',
  }) as Hud
  const ctx = { hud, runStats: shallowRef({ ...noRun, ...stats }) } as unknown as GameContext
  const wrapper = mount(GameOverlay, {
    attachTo: document.body,
    global: { provide: { [GameKey as symbol]: ctx }, stubs: { teleport: true } },
  })
  Object.assign(hud, hudOver, { gameOver: true })
  await nextTick()
  await nextTick()
  return wrapper
}

afterEach(() => {
  localStorage.clear()
  document.body.innerHTML = ''
})

describe('pantalla de fin de partida', () => {
  it('compara con la mejor marca del mismo modo', async () => {
    const records = [saved(9000, 'sprint'), saved(1000, 'marathon')]
    expect((await finish({ score: 1500 }, {}, records)).text()).toContain(
      '+500 sobre tu mejor marca',
    )
    expect((await finish({ score: 400 }, {}, records)).text()).toContain('−600 bajo tu mejor marca')
    expect((await finish({ score: 1000 }, {}, records)).text()).toContain('Igualas tu mejor marca')
  })

  it('sin marca previa en el modo lo indica y no muestra diferencia', async () => {
    const text = (await finish({ score: 500, mode: 'garbage' })).text()
    expect(text).toContain('Primera marca en este modo')
    expect(text).not.toContain('sobre tu mejor marca')
  })

  it('guardar el récord no cambia la comparación', async () => {
    const wrapper = await finish({ score: 1500 })
    await wrapper.find('.record-row button').trigger('click')
    expect(wrapper.text()).toContain('+500 sobre tu mejor marca')
    expect(wrapper.text()).toContain('¡Nuevo récord!')
  })

  it('una partida sin líneas se muestra sin NaN ni huecos', async () => {
    const wrapper = await finish({ score: 0, endReason: 'No queda espacio para la nueva pieza' })
    expect(wrapper.text()).toContain('Sin jugadas puntuables')
    expect(wrapper.html()).not.toMatch(/NaN|undefined|Infinity/)
    expect(wrapper.find('.record-input').exists()).toBe(false)
  })

  it('una partida de duración cero no rompe la curva', async () => {
    const wrapper = await finish({ score: 10 }, { samples: [{ ms: 0, score: 10 }], pieces: 1 })
    expect(wrapper.html()).not.toMatch(/NaN|Infinity/)
  })

  it('un desafío perdido muestra su nombre y motivo; ganado, no hay motivo', async () => {
    const lost = (await finish({ mode: 'sprint', endReason: 'Se acabó el tiempo' })).text()
    expect(lost).toContain('Sprint')
    expect(lost).toContain('Se acabó el tiempo')
    const won = (await finish({ mode: 'sprint', won: true, endReason: 'Motivo oculto' })).text()
    expect(won).toContain('¡OBJETIVO CUMPLIDO!')
    expect(won).not.toContain('Motivo oculto')
  })

  it('enfoca el campo del nombre y mantiene reiniciar y menú', async () => {
    const wrapper = await finish({ score: 1500 })
    expect(document.activeElement).toBe(wrapper.find('.record-input').element)
    expect(wrapper.text()).toContain('Guardar récord')
    expect(wrapper.text()).toContain('Reiniciar')
    expect(wrapper.text()).toContain('Menú')
  })

  it('los datos aparecen como texto y la curva lleva un resumen en aria-label', async () => {
    const wrapper = await finish(
      { score: 4800, time: '1:00' },
      {
        tetrises: 4,
        tspins: 2,
        bestCombo: 6,
        lines: 41,
        pieces: 80,
        bestPlay: { label: 'Tetris B2B', points: 4800 },
        samples: [
          { ms: 0, score: 0 },
          { ms: 60_000, score: 4800 },
        ],
        levelUps: [{ ms: 30_000, level: 2 }],
      },
    )
    const text = wrapper.text()
    for (const part of ['Tu mejor jugada: Tetris B2B', 'x6', 'Piezas', '41'])
      expect(text).toContain(part)
    const label = wrapper.find('svg').attributes('aria-label')
    expect(label).toContain('1:00')
    expect(label).toContain('1 subida de nivel')
  })
})
