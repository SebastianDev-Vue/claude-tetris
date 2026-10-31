import { computed, ref } from 'vue'
import type { GameMode } from '../engine/challenges'

export interface RecordEntry {
  name: string
  score: number
  lines: number
  maxCombo: number
  mode: GameMode
  /** Fecha ISO de la partida. */
  date: string
}

export const RECORDS_KEY = 'tetris-records'
export const MAX_RECORDS = 5
export const NAME_MAX_LENGTH = 12
export const DEFAULT_NAME = 'Jugador'

/** Una puntuación entra en la tabla si es > 0 y hay hueco o supera al último. */
export function qualifies(list: RecordEntry[], score: number): boolean {
  const last = list[MAX_RECORDS - 1]
  return score > 0 && (!last || score > last.score)
}

/**
 * Inserta ordenando por puntuación (a igualdad, el antiguo queda delante) y recorta al top.
 * Devuelve la lista nueva y la posición de la entrada (-1 si no entró).
 */
export function insertRecord(
  list: RecordEntry[],
  entry: RecordEntry,
): { list: RecordEntry[]; index: number } {
  const name = entry.name.trim().slice(0, NAME_MAX_LENGTH) || DEFAULT_NAME
  const added = { ...entry, name }
  const sorted = [...list, added].sort((a, b) => b.score - a.score).slice(0, MAX_RECORDS)
  return { list: sorted, index: sorted.indexOf(added) }
}

const isEntry = (e: unknown): e is RecordEntry =>
  typeof e === 'object' &&
  e !== null &&
  typeof (e as RecordEntry).name === 'string' &&
  typeof (e as RecordEntry).score === 'number' &&
  typeof (e as RecordEntry).lines === 'number' &&
  typeof (e as RecordEntry).maxCombo === 'number'

/** Lee los récords; con JSON inválido o sin localStorage devuelve una lista vacía. */
export function loadRecords(): RecordEntry[] {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(RECORDS_KEY) ?? '[]')
    if (!Array.isArray(data)) return []
    return data
      .filter(isEntry)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_RECORDS)
  } catch {
    return []
  }
}

function persist(list: RecordEntry[]): void {
  try {
    if (list.length) localStorage.setItem(RECORDS_KEY, JSON.stringify(list))
    else localStorage.removeItem(RECORDS_KEY)
  } catch {
    // sin almacenamiento (modo privado, cuota llena): la tabla vive solo en esta sesión
  }
}

/** Tabla de récords local (top 5) guardada en localStorage. */
export function useRecords() {
  const records = ref<RecordEntry[]>(loadRecords())
  const bestCombo = computed(() => Math.max(0, ...records.value.map((r) => r.maxCombo)))
  const maxLines = computed(() => Math.max(0, ...records.value.map((r) => r.lines)))

  /** Guarda la entrada y devuelve su posición en la tabla (-1 si no entró). */
  function save(entry: RecordEntry): number {
    const { list, index } = insertRecord(records.value, entry)
    records.value = list
    persist(list)
    return index
  }

  function clear(): void {
    records.value = []
    persist([])
  }

  return {
    records,
    bestCombo,
    maxLines,
    qualifies: (score: number) => qualifies(records.value, score),
    save,
    clear,
  }
}
