<script setup lang="ts">
import { useGameContext } from '../composables/useGame'

const { hud, restart } = useGameContext()
</script>

<template>
  <Transition name="fade">
    <div v-if="hud.paused || hud.gameOver" class="overlay">
      <div class="overlay-box">
        <p class="overlay-title">{{ hud.gameOver ? 'GAME OVER' : 'PAUSA' }}</p>
        <p v-if="hud.gameOver" class="overlay-score">
          Puntuación: {{ hud.score.toLocaleString() }}
        </p>
        <button class="restart-btn" type="button" @click="restart">Reiniciar</button>
      </div>
    </div>
  </Transition>
</template>
