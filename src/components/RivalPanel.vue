<script setup lang="ts">
import { useGameContext } from '../composables/useGame'
import PiecePreview from './PiecePreview.vue'

const { ghost, hud } = useGameContext()
</script>

<template>
  <aside class="panel panel--rival" aria-label="Tu récord">
    <div class="panel-section">
      <span class="label">NEXT</span>
      <PiecePreview :piece="() => ghost.next" />
    </div>
    <div class="panel-section">
      <span class="label">SCORE</span>
      <span class="value">{{ hud.ghostScore.toLocaleString() }}</span>
    </div>
    <div class="panel-row">
      <div class="panel-section">
        <span class="label">LINES</span>
        <span class="value">{{ hud.ghostLines }}</span>
      </div>
      <div class="panel-section">
        <span class="label">LEVEL</span>
        <span class="value">{{ hud.ghostLevel }}</span>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.panel--rival {
  width: 150px;
  opacity: 0.8;
}
</style>
