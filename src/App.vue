<script setup lang="ts">
import { provide } from 'vue';
import { GameKey, useGame } from './composables/useGame';
import { useTheme } from './composables/useTheme';
import GameBoard from './components/GameBoard.vue';
import SidePanel from './components/SidePanel.vue';
import GameOverlay from './components/GameOverlay.vue';
import ThemeToggle from './components/ThemeToggle.vue';

provide(GameKey, useGame());
const { theme, gridColor, toggleTheme } = useTheme();
</script>

<template>
  <ThemeToggle :theme="theme" @toggle="toggleTheme" />

  <div class="wrapper">
    <h1 class="title">TETRIS</h1>

    <!-- El overlay cubre solo el área de juego, no el título -->
    <div class="game-area">
      <div class="game-container">
        <GameBoard :grid-color="gridColor" />
        <SidePanel />
      </div>
      <GameOverlay />
    </div>
  </div>
</template>
