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
  chalk: 'Pizarra',
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

<style scoped>
/* ==========================================================================
   Barra superior: control segmentado tipo píldora
   Cualquier botón dentro de .toggles hereda este aspecto.
   ========================================================================== */
.toggles {
  position: fixed;
  top: var(--space-4);
  right: var(--space-4);
  z-index: 10;
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1);
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-pill);
  box-shadow: var(--glass-highlight), var(--shadow-md);
  backdrop-filter: blur(14px) saturate(140%);
}

.toggles button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  color: var(--muted);
  border: 1px solid transparent;
  border-radius: var(--radius-pill);
  padding: 7px 16px;
  font-family: var(--font-ui);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.3px;
  cursor: pointer;
  white-space: nowrap;
  transition:
    color var(--dur-fast) ease,
    background var(--dur-fast) ease,
    box-shadow var(--dur-fast) ease,
    transform var(--dur-fast) var(--ease-out);
}

.toggles button:hover:not(:disabled) {
  color: var(--text);
  background: var(--surface-hover);
}

.toggles button:active:not(:disabled) {
  transform: scale(0.96);
}

/* Opción activa del segmento */
.toggles button[aria-pressed='true'],
.toggles button.active {
  color: var(--btn-text);
  background: var(--accent-grad);
  box-shadow: 0 4px 14px var(--btn-glow);
}

.toggles button[aria-pressed='true']:hover:not(:disabled),
.toggles button.active:hover:not(:disabled) {
  color: var(--btn-text);
  background: var(--btn-hover);
}

/* Deshabilitado no se marca como activo aunque conserve aria-pressed */
.toggles button:disabled {
  color: var(--muted);
  background: transparent;
  box-shadow: none;
  opacity: 0.4;
  cursor: not-allowed;
}

.toggles button:focus-visible {
  box-shadow: var(--focus-ring);
}

/* ---- Selector de skin ---- */
.skin-picker {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--label);
}

/* Mismo aspecto que los campos de los overlays, en forma de píldora */
select {
  font: inherit;
  font-size: 13px;
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-pill);
  padding: 6px 14px;
  box-shadow: var(--glass-highlight);
  cursor: pointer;
  transition:
    border-color var(--dur-fast) ease,
    box-shadow var(--dur-fast) ease;
}

select:hover {
  border-color: var(--accent);
}

select:focus-visible {
  outline: none;
  border-color: var(--accent);
  box-shadow: var(--focus-ring);
}

select option {
  background: var(--canvas-bg);
  color: var(--text);
}
</style>
