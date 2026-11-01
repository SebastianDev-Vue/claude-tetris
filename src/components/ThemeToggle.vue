<script setup lang="ts">
import { useThemeContext } from '../composables/useTheme'
import type { Skin } from '../render/canvas'

const { skin, setSkin } = useThemeContext()

const SKIN_LABELS: Record<Skin, string> = {
  retro: 'Retro',
  neon: 'Neón',
  pastel: 'Pastel',
  pixel: 'Pixel art',
  '8bit': '8-bit',
}

/** Quita el foco del selector: si lo conserva, las flechas del juego cambiarían la skin. */
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
  </div>
</template>
