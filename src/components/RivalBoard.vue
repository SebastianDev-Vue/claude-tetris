<script setup lang="ts">
import { computed, onMounted, onUnmounted, useTemplateRef } from 'vue'
import { BLOCK, COLS, ROWS } from '../engine/constants'
import { drawBoard } from '../render/canvas'
import { useGameContext } from '../composables/useGame'
import { ghostDiffLabel } from '../composables/useGhosts'
import { useThemeContext } from '../composables/useTheme'

const { ghost, hud, onFrame } = useGameContext()
const { gridColor, skin } = useThemeContext()
const canvas = useTemplateRef<HTMLCanvasElement>('canvas')
const diff = computed(() => ghostDiffLabel(hud.ghostDiff))

let off: (() => void) | undefined

onMounted(() => {
  const ctx = canvas.value!.getContext('2d')!
  // Mismo tamaño que el tablero del jugador: si no cabe, lo reduce el CSS, no el dibujo
  off = onFrame((now) =>
    drawBoard(ctx, ghost, { gridColor: gridColor.value, skin: skin.value }, now),
  )
})

onUnmounted(() => off?.())
</script>

<template>
  <!-- Franja VS: color, y también signo y flecha, para no depender solo del color -->
  <div class="versus" :class="`versus--${diff.trend}`">
    <span class="versus-mark" aria-hidden="true">VS</span>
    <span class="versus-value">{{ diff.text }}</span>
    <span class="versus-note">{{ diff.note }}</span>
  </div>

  <figure class="rival">
    <div class="rival-frame">
      <canvas
        ref="canvas"
        class="rival-board"
        role="img"
        aria-label="Tablero de tu mejor partida"
        :width="COLS * BLOCK"
        :height="ROWS * BLOCK"
      ></canvas>
      <Transition name="pop">
        <p v-if="hud.ghostFinished" class="rival-final">
          Final: {{ hud.ghostScore.toLocaleString() }} puntos
        </p>
      </Transition>
    </div>
    <figcaption class="label rival-caption">Tu récord</figcaption>
  </figure>
</template>

<style scoped>
/* ---- Franja VS entre los dos tableros ---- */
.versus {
  --trend: var(--muted);
  align-self: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  min-width: 72px;
  text-align: center;
}

.versus--ahead {
  --trend: var(--win);
}

.versus--behind {
  --trend: var(--danger);
}

.versus-mark {
  font-family: var(--font-display);
  font-size: 28px;
  font-weight: 900;
  letter-spacing: 2px;
  color: var(--trend);
  text-shadow: 0 0 18px var(--trend);
  transition:
    color 0.4s ease,
    text-shadow 0.4s ease;
}

.versus-value {
  font-family: var(--font-mono);
  font-size: 15px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--trend);
  transition: color 0.4s ease;
}

.versus-note {
  font-size: 11px;
  color: var(--muted);
}

/* ---- Tablero rival: atenuado para que la vista se quede en el propio ---- */
.rival {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}

.rival-frame {
  position: relative;
}

.rival-board {
  display: block;
  max-width: 100%;
  height: auto;
  border: 1px solid var(--canvas-border);
  border-radius: var(--radius-md);
  background: var(--canvas-bg);
  opacity: 0.55;
  filter: saturate(0.5);
}

.rival-final {
  position: absolute;
  inset: 45% 0 auto;
  padding: var(--space-2);
  text-align: center;
  font-family: var(--font-display);
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
  background: var(--overlay-bg);
}
</style>
