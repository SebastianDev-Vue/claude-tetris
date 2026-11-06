<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import { useGameContext } from '../composables/useGame'
import { setKeyCapture } from '../composables/useTheme'
import {
  ACTIONS,
  TIMING_LIMITS,
  keyLabel,
  type GameAction,
  type TimingName,
} from '../composables/useSettings'

const emit = defineEmits<{ close: [] }>()

const { settings } = useGameContext()
const { values } = settings

const SLIDERS: { name: TimingName; label: string }[] = [
  { name: 'das', label: 'Retardo inicial (DAS)' },
  { name: 'arr', label: 'Repetición (ARR)' },
]

/** Acción que espera su tecla nueva. */
const capturing = ref<GameAction | null>(null)
/** Motivo del último rechazo. */
const message = ref('')

function stopCapture(): void {
  capturing.value = null
  setKeyCapture(false)
  window.removeEventListener('keydown', onCaptureKey)
}

/** Esc se rechaza como cualquier reservada, pero además es la salida de la captura. */
function onCaptureKey(e: KeyboardEvent): void {
  e.preventDefault()
  if (e.repeat || !capturing.value) return
  const reason = settings.assignKey(capturing.value, e.code)
  message.value = reason ?? ''
  if (!reason || e.code === 'Escape') stopCapture()
}

function toggleCapture(action: GameAction, e: MouseEvent): void {
  ;(e.currentTarget as HTMLButtonElement).blur() // Space no debe volver a pulsar el botón
  message.value = ''
  if (capturing.value === action) return stopCapture()
  capturing.value = action
  setKeyCapture(true)
  // Sin fase de captura: corre tras useGame y useTheme, que aún deben ver la señal activa
  window.addEventListener('keydown', onCaptureKey)
}

function restore(e: MouseEvent): void {
  ;(e.currentTarget as HTMLButtonElement).blur()
  stopCapture()
  message.value = ''
  settings.restoreDefaults()
}

function close(e: MouseEvent): void {
  ;(e.currentTarget as HTMLButtonElement).blur()
  emit('close')
}

onUnmounted(stopCapture)
</script>

<template>
  <div class="settings">
    <label v-for="s in SLIDERS" :key="s.name" class="settings-slider">
      <span class="settings-row">
        {{ s.label }}
        <output>{{ values[s.name] }} ms</output>
      </span>
      <!-- Al soltar se quita el foco: en un input los atajos globales no reaccionan -->
      <input
        type="range"
        :min="TIMING_LIMITS[s.name].min"
        :max="TIMING_LIMITS[s.name].max"
        :step="TIMING_LIMITS[s.name].step"
        :value="values[s.name]"
        @input="settings.setTiming(s.name, Number(($event.target as HTMLInputElement).value))"
        @pointerup="($event.target as HTMLInputElement).blur()"
      />
    </label>

    <ul class="settings-keys">
      <li v-for="action in ACTIONS" :key="action.id" class="settings-row">
        {{ action.label }}
        <button
          class="key-btn"
          :class="{ capturing: capturing === action.id }"
          type="button"
          :aria-label="`Cambiar la tecla de ${action.label}`"
          :aria-pressed="capturing === action.id"
          @click="toggleCapture(action.id, $event)"
        >
          {{ capturing === action.id ? '…' : keyLabel(values.keys[action.id]) }}
        </button>
      </li>
    </ul>

    <p class="settings-message" :class="{ error: message }" role="status">
      {{ message || (capturing ? 'Pulsa una tecla (Esc cancela)' : '') }}
    </p>

    <div class="settings-actions">
      <button
        class="restart-btn secondary"
        type="button"
        aria-label="Restaurar los valores por defecto"
        @click="restore"
      >
        Restaurar
      </button>
      <button class="restart-btn" type="button" @click="close">Volver</button>
    </div>
  </div>
</template>

<style scoped>
.settings {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  width: 230px;
  max-width: 100%;
}

.settings-slider {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.settings-slider input {
  width: 100%;
  accent-color: var(--accent);
  cursor: pointer;
}

.settings-slider output {
  font-variant-numeric: tabular-nums;
  color: var(--accent);
  white-space: nowrap;
}

.settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  font-size: 12px;
  color: var(--muted);
  text-align: left;
}

.settings-keys {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.key-btn {
  min-width: 68px;
  /* altura fija: los glifos de flecha caen en otra fuente y cambiarían la de la fila (8-bit) */
  height: 24px;
  padding: 0 var(--space-2);
  font: inherit;
  color: var(--kbd-text);
  background: var(--kbd-bg);
  border: 1px solid var(--kbd-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.key-btn:hover,
.key-btn:focus-visible,
.key-btn.capturing {
  outline: none;
  border-color: var(--accent);
  box-shadow: var(--focus-ring);
}

/* Altura fija para que el panel no salte al aparecer un mensaje */
.settings-message {
  min-height: 3em;
  font-size: 11px;
  line-height: 1.5;
  color: var(--muted);
}

.settings-message.error {
  color: var(--danger);
}

.settings-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--space-2);
}
</style>
