<script setup lang="ts">
import { onMounted, onUnmounted, useTemplateRef } from 'vue'
import { BLOCK, COLS, ROWS } from '../engine/constants'
import { drawBoard, retroPalette } from '../render/canvas'
import { useGameContext } from '../composables/useGame'
import { useThemeContext } from '../composables/useTheme'

const { game, effects, hud, onFrame } = useGameContext()
const { gridColor, skin, retro } = useThemeContext()
const canvas = useTemplateRef<HTMLCanvasElement>('canvas')

let off: (() => void) | undefined

onMounted(() => {
  const ctx = canvas.value!.getContext('2d')!
  off = onFrame((now) => {
    const style = { gridColor: gridColor.value, skin: skin.value }
    // Limpiar sin transformación y luego desplazar todo el frame según la sacudida
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    const shake = effects.offset(now)
    ctx.setTransform(1, 0, 0, 1, shake.x, shake.y)
    drawBoard(ctx, game, style, now)
    // retro: efectos de un solo color, el primero de la paleta del nivel
    effects.draw(ctx, now, retro.value ? retroPalette(game.level)[0] : null)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
  })
})

onUnmounted(() => off?.())
</script>

<template>
  <!-- En la skin 8-bit el marco lleva bordes en píxeles y líneas de barrido CRT -->
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

<style scoped>
/* ---- Marco del tablero ---- */
.board-frame {
  position: relative;
  display: flex;
}

#board {
  display: block;
  border: 1px solid var(--canvas-border);
  background: var(--canvas-bg);
  border-radius: var(--radius-md);
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.03),
    0 0 60px var(--board-shadow),
    var(--shadow-lg);
  /* Tinte del tablero con efectos de tiempo activos */
  transition:
    box-shadow 0.3s ease,
    border-color 0.3s ease;
}

/* :not(.retro): con scoped empataría con el borde negro de la skin 8-bit (style.css) */
.board-frame:not(.retro) #board.board--slow {
  border-color: #81c784;
}

#board.board--slow {
  box-shadow:
    0 0 32px rgba(129, 199, 132, 0.55),
    var(--shadow-lg);
}

.board-frame:not(.retro) #board.board--frozen {
  border-color: #b3e5fc;
}

#board.board--frozen {
  box-shadow:
    0 0 32px rgba(179, 229, 252, 0.7),
    var(--shadow-lg);
}

/* Líneas de barrido del CRT por encima del tablero */
.board-frame.retro::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: repeating-linear-gradient(
    to bottom,
    rgba(0, 0, 0, 0.25) 0,
    rgba(0, 0, 0, 0.25) 1px,
    transparent 1px,
    transparent 3px
  );
}
</style>
