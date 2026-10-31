<script setup lang="ts">
import { onMounted, onUnmounted, useTemplateRef } from 'vue'
import { BLOCK, COLS, ROWS } from '../engine/constants'
import { drawBoard } from '../render/canvas'
import { useGameContext } from '../composables/useGame'

const props = defineProps<{ gridColor: string }>()
const { game, effects, onFrame } = useGameContext()
const canvas = useTemplateRef<HTMLCanvasElement>('canvas')

let off: (() => void) | undefined

onMounted(() => {
  const ctx = canvas.value!.getContext('2d')!
  off = onFrame((now) => {
    // Limpiar sin transformación y luego desplazar todo el frame según la sacudida
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    const shake = effects.offset(now)
    ctx.setTransform(1, 0, 0, 1, shake.x, shake.y)
    drawBoard(ctx, game, props.gridColor, now)
    effects.draw(ctx, now)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
  })
})

onUnmounted(() => off?.())
</script>

<template>
  <!-- El tamaño se deriva de las constantes del motor -->
  <canvas id="board" ref="canvas" :width="COLS * BLOCK" :height="ROWS * BLOCK"></canvas>
</template>
