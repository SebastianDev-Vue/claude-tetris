<script setup lang="ts">
import { computed } from 'vue'
import { useThemeContext } from '../composables/useTheme'
import type { Skin } from '../render/canvas'

const { theme, skin, themeLocked, toggleTheme, setSkin } = useThemeContext()
const light = computed(() => theme.value === 'light')

const SKIN_LABELS: Record<Skin, string> = {
  retro: 'Retro',
  neon: 'Neón',
  pastel: 'Pastel',
  pixel: 'Pixel art',
  '8bit': '8-bit',
}

/** Quita el foco del botón: si no, Space lo reactivaría al jugar. */
function run(action: () => void, e: MouseEvent): void {
  action()
  ;(e.currentTarget as HTMLButtonElement).blur()
}

/** Igual con el selector: si conserva el foco, las flechas del juego cambiarían la skin. */
function onSkinChange(e: Event): void {
  const select = e.currentTarget as HTMLSelectElement
  setSkin(select.value as Skin)
  select.blur()
}
</script>

<template>
  <div class="toggles">
    <label class="skin-picker" title="Tecla R">
      <span>Skin</span>
      <select
        id="skin-select"
        :value="skin"
        aria-label="Skin de los bloques"
        @change="onSkinChange"
      >
        <option v-for="(label, id) in SKIN_LABELS" :key="id" :value="id">{{ label }}</option>
      </select>
    </label>
    <!-- Con las skins 8-bit y neón el tema claro/oscuro no aplica -->
    <button
      id="theme-toggle"
      type="button"
      :disabled="themeLocked"
      :aria-pressed="light"
      :aria-label="light ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'"
      @click="run(toggleTheme, $event)"
    >
      {{ light ? 'Modo oscuro' : 'Modo claro' }}
    </button>
  </div>
</template>
