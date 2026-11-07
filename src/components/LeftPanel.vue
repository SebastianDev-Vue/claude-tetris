<script setup lang="ts">
import { useGameContext } from '../composables/useGame'
import { keyLabel } from '../composables/useSettings'
import PiecePreview from './PiecePreview.vue'

const { game, hud, settings } = useGameContext()
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

    <!-- Atenuado mientras HOLD ya se ha usado en este turno -->
    <div class="panel-section hold-slot" :class="{ locked: hud.holdUsed }">
      <span class="label"
        >HOLD <kbd>{{ keyLabel(settings.values.keys.hold) }}</kbd></span
      >
      <PiecePreview :piece="() => game.hold" />
    </div>

    <div class="panel-section">
      <span class="label">TIEMPO</span>
      <span class="info">{{ hud.time }}</span>
    </div>

    <div class="panel-section controls">
      <span class="label">CONTROLS</span>
      <ul>
        <li>
          <kbd>{{ keyLabel(settings.values.keys.left) }}</kbd>
          <kbd>{{ keyLabel(settings.values.keys.right) }}</kbd> mover
        </li>
        <li>
          <kbd>{{ keyLabel(settings.values.keys.rotate) }}</kbd>
          <kbd>{{ keyLabel(settings.values.keys.rotateAlt) }}</kbd> rotar
        </li>
        <li>
          <kbd>{{ keyLabel(settings.values.keys.down) }}</kbd> bajar
        </li>
        <li>
          <kbd>{{ keyLabel(settings.values.keys.hardDrop) }}</kbd> caída
        </li>
        <li>
          <kbd>{{ keyLabel(settings.values.keys.hold) }}</kbd> hold
        </li>
        <li>
          <kbd>{{ keyLabel(settings.values.keys.skills) }}</kbd> habilidades
        </li>
        <li><kbd>P</kbd> pausa</li>
        <li><kbd>M</kbd> sonido: {{ hud.muted ? 'off' : 'on' }}</li>
      </ul>
      <p v-if="settings.values.versusGhost && !hud.hasGhost" class="ghost-hint">
        Termina una partida para correr contra tu mejor marca
      </p>
    </div>
  </aside>
</template>

<style scoped>
/* ---- Controles ---- */
.controls ul {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.controls li {
  font-size: 12px;
  color: var(--muted);
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.ghost-hint {
  font-size: 12px;
  line-height: 1.4;
  color: var(--muted);
}

/* ---- Panel izquierdo ---- */
.panel--left {
  width: 180px;
}

.objective-name {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 14px;
  letter-spacing: 0.5px;
  color: var(--text);
}

/* ---- HOLD ---- */
.hold-slot .preview {
  transition:
    opacity 0.25s ease,
    filter 0.25s ease;
}

.hold-slot.locked .preview {
  opacity: 0.35;
  filter: grayscale(1);
}
</style>
