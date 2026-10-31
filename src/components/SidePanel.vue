<script setup lang="ts">
import { useGameContext } from '../composables/useGame'
import PiecePreview from './PiecePreview.vue'

const { game, hud } = useGameContext()
</script>

<template>
  <aside class="panel">
    <div class="panel-section">
      <span class="label">SCORE</span>
      <span class="value">{{ hud.score.toLocaleString() }}</span>
    </div>
    <div class="panel-section">
      <span class="label">LINES</span>
      <span class="value">{{ hud.lines }}</span>
    </div>
    <div class="panel-section">
      <span class="label">LEVEL</span>
      <span class="value">{{ hud.level }}</span>
    </div>
    <div class="panel-section">
      <span class="label">POWER-UP</span>
      <span class="info">{{ hud.powerUpInfo }}</span>
    </div>

    <div class="panel-section">
      <span class="label">NEXT</span>
      <PiecePreview :piece="() => game.next" />
    </div>

    <div class="panel-section controls">
      <span class="label">CONTROLS</span>
      <ul>
        <li><kbd>←</kbd><kbd>→</kbd> mover</li>
        <li><kbd>↑</kbd> rotar</li>
        <li><kbd>↓</kbd> bajar</li>
        <li><kbd>Space</kbd> caída</li>
        <li><kbd>P</kbd> pausa</li>
      </ul>
    </div>
  </aside>
</template>
