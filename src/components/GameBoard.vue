<script setup lang="ts">
import { onMounted, onUnmounted, useTemplateRef } from 'vue'
import { BLOCK, COLS, ROWS } from '../engine/constants'
import { drawBoard, retroPalette } from '../render/canvas'
import { useGameContext } from '../composables/useGame'
import { useThemeContext } from '../composables/useTheme'

const { game, effects, hud, onFrame } = useGameContext()
const { gridColor, retro } = useThemeContext()
const canvas = useTemplateRef<HTMLCanvasElement>('canvas')

let off: (() => void) | undefined

onMounted(() => {
  const ctx = canvas.value!.getContext('2d')!
  off = onFrame((now) => {
    const style = { gridColor: gridColor.value, retro: retro.value }
    // Limpiar sin transformación y luego desplazar todo el frame según la sacudida
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    const shake = effects.offset(now)
    ctx.setTransform(1, 0, 0, 1, shake.x, shake.y)
    drawBoard(ctx, game, style, now)
    // retro: efectos de un solo color, el primero de la paleta del nivel
    effects.draw(ctx, now, style.retro ? retroPalette(game.level)[0] : null)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
  })
})

onUnmounted(() => off?.())
</script>

<template>
  <!-- En retro el marco lleva bordes en píxeles y líneas de barrido CRT (style.css) -->
  <div class="board-frame" :class="{ retro }">
    <!-- El tamaño se deriva de las constantes del motor -->
    <!-- Ralentizar / Congelar tiñen el borde del tablero mientras duran -->
    <canvas
      id="board"
      ref="canvas"
      :class="{ 'board--slow': hud.slowed, 'board--frozen': hud.frozen }"
      :width="COLS * BLOCK"
      :height="ROWS * BLOCK"
    ></canvas>
  </div>
</template>
