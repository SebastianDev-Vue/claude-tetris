<script setup lang="ts">
import { onMounted, onUnmounted, useTemplateRef } from 'vue'
import type { Piece } from '../engine/game'
import { drawPreview } from '../render/canvas'
import { useGameContext } from '../composables/useGame'
import { useThemeContext } from '../composables/useTheme'

const props = withDefaults(
  defineProps<{
    /** Pieza a mostrar; se lee en cada frame. */
    piece: () => Piece | null
    cellSize?: number
    cells?: number
  }>(),
  { cellSize: 30, cells: 4 },
)

const { hud, onFrame } = useGameContext()
const { skin } = useThemeContext()
const canvas = useTemplateRef<HTMLCanvasElement>('canvas')
let off: (() => void) | undefined

onMounted(() => {
  const ctx = canvas.value!.getContext('2d')!
  off = onFrame((now) =>
    drawPreview(ctx, props.piece(), props.cellSize, props.cells, now, skin.value, hud.level),
  )
})

onUnmounted(() => off?.())
</script>

<template>
  <canvas
    class="preview"
    ref="canvas"
    :width="cells * cellSize"
    :height="cells * cellSize"
  ></canvas>
</template>
