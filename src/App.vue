<script setup lang="ts">
import { provide } from 'vue'
import { GameKey, useGame } from './composables/useGame'
import { ThemeKey, useTheme } from './composables/useTheme'
import GameBoard from './components/GameBoard.vue'
import SidePanel from './components/SidePanel.vue'
import LeftPanel from './components/LeftPanel.vue'
import GameOverlay from './components/GameOverlay.vue'
import ThemeToggle from './components/ThemeToggle.vue'

provide(GameKey, useGame())
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
      </div>
      <GameOverlay />
    </div>
  </div>
</template>
