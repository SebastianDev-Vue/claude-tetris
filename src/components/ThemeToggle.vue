<script setup lang="ts">
import { computed } from 'vue'
import { useThemeContext } from '../composables/useTheme'

const { theme, retro, toggleTheme, toggleRetro } = useThemeContext()
const light = computed(() => theme.value === 'light')

/** Quita el foco del botón: si no, Space lo reactivaría al jugar. */
function run(action: () => void, e: MouseEvent): void {
  action()
  ;(e.currentTarget as HTMLButtonElement).blur()
}
</script>

<template>
  <div class="toggles">
    <button
      id="retro-toggle"
      type="button"
      :aria-pressed="retro"
      title="Tecla R"
      @click="run(toggleRetro, $event)"
    >
      {{ retro ? 'Salir de retro' : 'Modo retro' }}
    </button>
    <!-- En retro el tema claro/oscuro no aplica -->
    <button
      id="theme-toggle"
      type="button"
      :disabled="retro"
      :aria-pressed="light"
      :aria-label="light ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'"
      @click="run(toggleTheme, $event)"
    >
      {{ light ? 'Modo oscuro' : 'Modo claro' }}
    </button>
  </div>
</template>
