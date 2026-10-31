<script setup lang="ts">
import { onMounted, onUnmounted, useTemplateRef } from 'vue';
import { BLOCK, COLS, ROWS } from '../engine/constants';
import { drawBoard } from '../render/canvas';
import { useGameContext } from '../composables/useGame';

const props = defineProps<{ gridColor: string }>();
const { game, popups, onFrame } = useGameContext();
const canvas = useTemplateRef<HTMLCanvasElement>('canvas');

let off: (() => void) | undefined;

onMounted(() => {
  const ctx = canvas.value!.getContext('2d')!;
  off = onFrame(now => {
    drawBoard(ctx, game, props.gridColor);
    popups.draw(ctx, now);
  });
});

onUnmounted(() => off?.());
</script>

<template>
  <!-- El tamaño se deriva de las constantes del motor -->
  <canvas id="board" ref="canvas" :width="COLS * BLOCK" :height="ROWS * BLOCK"></canvas>
</template>
