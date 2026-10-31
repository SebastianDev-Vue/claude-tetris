<script setup lang="ts">
import { onMounted, onUnmounted, useTemplateRef } from 'vue'
import { BLOCK, COLS, ROWS } from '../engine/constants'
import { RETRO_GREEN, drawBoard } from '../render/canvas'
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
    effects.draw(ctx, now, style.retro ? RETRO_GREEN : null) // retro: efectos monocromos
    ctx.setTransform(1, 0, 0, 1, 0, 0)
  })
})

onUnmounted(() => off?.())
</script>

<template>
  <!-- --block: el pozo de texto del modo retro alinea cada línea con una fila del tablero -->
  <div class="board-frame" :class="{ retro }" :style="{ '--block': `${BLOCK}px` }">
    <!-- Paredes del pozo como en los terminales de 1984: <! … !> y base ===== / \/\/\/ -->
    <div v-if="retro" class="well-wall" aria-hidden="true">
      <span v-for="r in ROWS + 1" :key="r">&lt;!</span>
    </div>
    <div class="board-column">
      <!-- El tamaño se deriva de las constantes del motor -->
      <!-- Ralentizar / Congelar tiñen el borde del tablero mientras duran -->
      <canvas
        id="board"
        ref="canvas"
        :class="{ 'board--slow': hud.slowed, 'board--frozen': hud.frozen }"
        :width="COLS * BLOCK"
        :height="ROWS * BLOCK"
      ></canvas>
      <template v-if="retro">
        <div class="well-floor" aria-hidden="true">{{ '='.repeat(COLS * 3) }}</div>
        <div class="well-floor" aria-hidden="true">{{ '\\/'.repeat(COLS * 2) }}</div>
      </template>
    </div>
    <div v-if="retro" class="well-wall" aria-hidden="true">
      <span v-for="r in ROWS + 1" :key="r">!&gt;</span>
    </div>
  </div>
</template>
