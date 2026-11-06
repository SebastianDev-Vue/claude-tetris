<script setup lang="ts">
import { onMounted, onUnmounted, useTemplateRef } from 'vue'
import { BLOCK, COLS, ROWS } from '../engine/constants'
import { drawBoard } from '../render/canvas'
import { useGameContext } from '../composables/useGame'
import { useThemeContext } from '../composables/useTheme'

/** Lado de cada celda: con 12 px el panel supera al tablero cuando hay OBJETIVO. */
const CELL = 10

const { ghost, hud, onFrame } = useGameContext()
const { gridColor, skin } = useThemeContext()
const canvas = useTemplateRef<HTMLCanvasElement>('canvas')

let off: (() => void) | undefined

onMounted(() => {
  const ctx = canvas.value!.getContext('2d')!
  const scale = CELL / BLOCK
  off = onFrame((now) => {
    // Limpiar antes de escalar: el clearRect de drawBoard usa coordenadas ya transformadas
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    ctx.scale(scale, scale)
    drawBoard(ctx, ghost, { gridColor: gridColor.value, skin: skin.value }, now)
  })
})

onUnmounted(() => off?.())
</script>

<template>
  <div class="panel-section">
    <span class="label">FANTASMA</span>
    <canvas
      ref="canvas"
      class="ghost-board"
      role="img"
      aria-label="Tablero de tu mejor partida"
      :width="COLS * CELL"
      :height="ROWS * CELL"
    ></canvas>
    <span class="ghost-score">
      {{ hud.ghostFinished ? 'Final' : 'Tu récord' }}: {{ hud.ghostScore.toLocaleString() }}
    </span>
  </div>
</template>

<style scoped>
.ghost-board {
  display: block;
  align-self: center;
  border: 1px solid var(--canvas-border);
  border-radius: var(--radius-sm);
  background: var(--canvas-bg);
}

.ghost-score {
  font-size: 12px;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}
</style>
