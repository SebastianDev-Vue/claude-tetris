<script setup lang="ts">
import { useGameContext } from '../composables/useGame'

const { hud } = useGameContext()
</script>

<template>
  <aside class="panel panel--left">
    <Transition name="pop">
      <div v-if="hud.challengeName" class="panel-section objective">
        <span class="label">OBJETIVO</span>
        <span class="objective-name">{{ hud.challengeName }}</span>
        <span class="info">{{ hud.objective }}</span>
      </div>
    </Transition>

    <div class="panel-section">
      <span class="label">TIEMPO</span>
      <span class="info">{{ hud.time }}</span>
    </div>

    <div class="panel-section controls">
      <span class="label">CONTROLS</span>
      <ul>
        <li><kbd>←</kbd><kbd>→</kbd> mover</li>
        <li><kbd>↑</kbd> rotar</li>
        <li><kbd>↓</kbd> bajar</li>
        <li><kbd>Space</kbd> caída</li>
        <li><kbd>P</kbd> pausa</li>
        <li><kbd>M</kbd> sonido: {{ hud.muted ? 'off' : 'on' }}</li>
      </ul>
    </div>
  </aside>
</template>
