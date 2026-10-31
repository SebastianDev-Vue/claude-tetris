import { afterEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_NAME,
  MAX_RECORDS,
  RECORDS_KEY,
  insertRecord,
  loadRecords,
  qualifies,
  useRecords,
  type RecordEntry,
} from '@/composables/useRecords'

const entry = (score: number, name = 'Ana', extra: Partial<RecordEntry> = {}): RecordEntry => ({
  name,
  score,
  lines: 0,
  maxCombo: 0,
  mode: 'marathon',
  date: '2026-01-01T00:00:00.000Z',
  ...extra,
})

const full = () => [500, 400, 300, 200, 100].map((s) => entry(s))

afterEach(() => localStorage.clear())

describe('récords: lógica pura', () => {
  it('qualifies: > 0 y hueco libre o superar al último', () => {
    expect(qualifies([], 0)).toBe(false)
    expect(qualifies([], 1)).toBe(true)
    expect(qualifies(full(), 100)).toBe(false) // empatar con el último no basta
    expect(qualifies(full(), 101)).toBe(true)
  })

  it('insertRecord ordena, recorta al top y devuelve la posición', () => {
    const { list, index } = insertRecord(full(), entry(350, 'Bea'))
    expect(list.map((r) => r.score)).toEqual([500, 400, 350, 300, 200])
    expect(index).toBe(2)
    expect(list).toHaveLength(MAX_RECORDS)
    expect(insertRecord(full(), entry(50)).index).toBe(-1)
  })

  it('insertRecord recorta el nombre y usa uno por defecto si queda vacío', () => {
    expect(insertRecord([], entry(10, '   ')).list[0]?.name).toBe(DEFAULT_NAME)
    expect(insertRecord([], entry(10, '  abcdefghijklmnop ')).list[0]?.name).toBe('abcdefghijkl')
  })

  it('loadRecords nunca lanza con datos inválidos', () => {
    localStorage.setItem(RECORDS_KEY, '{no es json')
    expect(loadRecords()).toEqual([])
    localStorage.setItem(RECORDS_KEY, '{"a":1}')
    expect(loadRecords()).toEqual([])
    localStorage.setItem(RECORDS_KEY, JSON.stringify([entry(5), { score: 'x' }, null]))
    expect(loadRecords()).toEqual([entry(5)])
  })
})

describe('useRecords', () => {
  it('guarda en localStorage, calcula mejores marcas y borra', () => {
    const r = useRecords()
    r.save(entry(100, 'Ana', { lines: 12, maxCombo: 3 }))
    r.save(entry(300, 'Bea', { lines: 8, maxCombo: 5 }))
    expect(useRecords().records.value.map((e) => e.name)).toEqual(['Bea', 'Ana']) // persistido
    expect([r.bestCombo.value, r.maxLines.value]).toEqual([5, 12])
    r.clear()
    expect(r.records.value).toEqual([])
    expect(localStorage.getItem(RECORDS_KEY)).toBeNull()
    expect([r.bestCombo.value, r.maxLines.value]).toEqual([0, 0])
  })
})
