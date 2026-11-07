<script setup lang="ts">
import { provide } from 'vue'
import { GameKey, useGame } from './composables/useGame'
import { ThemeKey, useTheme } from './composables/useTheme'
import GameBoard from './components/GameBoard.vue'
import SidePanel from './components/SidePanel.vue'
import LeftPanel from './components/LeftPanel.vue'
import GameOverlay from './components/GameOverlay.vue'
import ThemeToggle from './components/ThemeToggle.vue'
import RivalBoard from './components/RivalBoard.vue'
import RivalPanel from './components/RivalPanel.vue'

const game = useGame()
provide(GameKey, game)
provide(ThemeKey, useTheme())
</script>

<template>
  <ThemeToggle />

  <div class="wrapper">
    <h1 class="title">TETRIS</h1>

    <!-- El overlay cubre solo el área de juego, no el título -->
    <div class="game-area">
      <div class="game-container">
        <LeftPanel />
        <GameBoard />
        <SidePanel />
        <!-- Solo contra el fantasma; si no, la pantalla es la de un jugador -->
        <div v-if="game.hud.hasGhost" class="rival-side">
          <RivalBoard />
          <RivalPanel />
        </div>
      </div>
      <GameOverlay />
    </div>
  </div>
</template>

<style scoped>
/* Si los dos tableros no caben en una fila, el rival baja entero debajo del jugador */
.game-container:has(.rival-side) {
  flex-wrap: wrap;
  justify-content: center;
}

.rival-side {
  display: flex;
  align-items: flex-start;
  gap: var(--space-5);
  max-width: 100%;
}

@media (max-width: 760px) {
  .rival-side {
    flex-wrap: wrap;
    justify-content: center;
  }
}
</style>
