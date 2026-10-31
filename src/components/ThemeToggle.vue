<script setup lang="ts">
import { computed } from 'vue'
import type { Theme } from '../composables/useTheme'

const props = defineProps<{ theme: Theme }>()
const emit = defineEmits<{ toggle: [] }>()
const light = computed(() => props.theme === 'light')

function onClick(e: MouseEvent): void {
  emit('toggle')
  ;(e.currentTarget as HTMLButtonElement).blur() // evita que Space reactive el botón
}
</script>

<template>
  <button
    id="theme-toggle"
    type="button"
    :aria-pressed="light"
    :aria-label="light ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'"
    @click="onClick"
  >
    {{ light ? 'Modo oscuro' : 'Modo claro' }}
  </button>
</template>
