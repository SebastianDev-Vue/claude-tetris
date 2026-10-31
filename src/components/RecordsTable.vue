<script setup lang="ts">
import { MODES } from '../engine/challenges'
import type { RecordEntry } from '../composables/useRecords'

defineProps<{
  records: RecordEntry[]
  bestCombo: number
  maxLines: number
  /** Fila recién guardada (-1 = ninguna). */
  highlight: number
}>()
defineEmits<{ clear: [] }>()

const modeName = (id: string) => MODES.find((m) => m.id === id)?.name ?? id
const formatDate = (iso: string) => new Date(iso).toLocaleDateString()
</script>

<template>
  <section class="records">
    <p class="records-title">RÉCORDS</p>
    <p v-if="!records.length" class="records-empty">Aún no hay récords</p>
    <template v-else>
      <table class="records-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Nombre</th>
            <th>Puntos</th>
            <th>Líneas</th>
            <th>Combo</th>
          </tr>
        </thead>
        <tbody>
          <!-- El tablero mide 300 px: modo y fecha van en el tooltip de la fila -->
          <tr
            v-for="(r, i) in records"
            :key="r.date + r.name + i"
            :class="{ 'records-new': i === highlight }"
            :title="`${modeName(r.mode)} · ${formatDate(r.date)}`"
          >
            <td>{{ i + 1 }}</td>
            <td class="records-name">{{ r.name }}</td>
            <td>{{ r.score.toLocaleString() }}</td>
            <td>{{ r.lines }}</td>
            <td>x{{ r.maxCombo }}</td>
          </tr>
        </tbody>
      </table>
      <p class="records-best">Mejor combo: x{{ bestCombo }} · Máx. líneas: {{ maxLines }}</p>
      <button class="restart-btn secondary" type="button" @click="$emit('clear')">
        Borrar récords
      </button>
    </template>
  </section>
</template>
