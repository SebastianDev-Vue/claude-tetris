<script setup lang="ts">
import { computed } from 'vue'
import { MAX_COMBO_MULTIPLIER } from '../engine/constants'
import { QUEUE_SIZE } from '../engine/skills'
import { useGameContext } from '../composables/useGame'
import { ghostDiffLabel } from '../composables/useGhosts'
import { keyLabel } from '../composables/useSettings'
import PiecePreview from './PiecePreview.vue'

const { game, hud, settings } = useGameContext()

/** El combo se muestra como multiplicador a partir del segundo clear encadenado. */
const comboLabel = computed(() =>
  hud.combo >= 2 ? `x${Math.min(hud.combo, MAX_COMBO_MULTIPLIER)}` : '—',
)

const ghostDiff = computed(() => ghostDiffLabel(hud.ghostDiff))
</script>

<template>
  <aside class="panel">
    <div class="panel-section">
      <span class="label">SCORE</span>
      <span class="value">{{ hud.score.toLocaleString() }}</span>
      <!-- Color, y también signo y flecha: no depende solo del color -->
      <div v-if="hud.hasGhost" class="ghost-diff" :class="`ghost-diff--${ghostDiff.trend}`">
        <span class="ghost-diff-value">{{ ghostDiff.text }}</span>
        <span class="ghost-diff-note">{{ ghostDiff.note }}</span>
      </div>
    </div>
    <div class="panel-row">
      <div class="panel-section">
        <span class="label">LINES</span>
        <span class="value">{{ hud.lines }}</span>
      </div>
      <div class="panel-section">
        <span class="label">LEVEL</span>
        <span class="value">{{ hud.level }}</span>
      </div>
    </div>
    <div class="panel-section">
      <span class="label">COMBO</span>
      <div class="combo-row">
        <!-- :key en el texto: cada cambio de multiplicador relanza la animación "pop" -->
        <Transition name="pop" mode="out-in">
          <span :key="comboLabel" class="value combo" :class="{ active: hud.combo >= 2 }">
            {{ comboLabel }}
          </span>
        </Transition>
        <Transition name="pop">
          <span v-if="hud.b2b" class="badge" title="Back-to-Back listo">B2B</span>
        </Transition>
      </div>
    </div>
    <div class="panel-section">
      <span class="label">ENERGÍA</span>
      <div class="energy-bar" :class="{ full: hud.energyFull }">
        <div class="energy-fill" :style="{ width: `${hud.energy}%` }"></div>
      </div>
      <Transition name="pop">
        <span v-if="hud.energyFull" class="info energy-hint">
          <kbd>{{ keyLabel(settings.values.keys.skills) }}</kbd> habilidades
        </span>
      </Transition>
    </div>
    <div class="panel-section">
      <span class="label">POWER-UP</span>
      <span class="info">{{ hud.powerUpInfo }}</span>
    </div>

    <div class="panel-section">
      <span class="label">NEXT</span>
      <PiecePreview :piece="() => game.next" />
      <!-- «Ver piezas»: el resto de la cola en miniatura -->
      <Transition name="slide">
        <div v-if="hud.peek" class="queue-strip">
          <PiecePreview
            v-for="i in QUEUE_SIZE - 1"
            :key="i"
            :piece="() => game.queue[i] ?? null"
            :cell-size="12"
          />
        </div>
      </Transition>
    </div>
  </aside>
</template>

<style scoped>
/* ---- Diferencia con el fantasma ---- */
.ghost-diff {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ghost-diff-value {
  font-family: var(--font-mono);
  font-size: 15px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.ghost-diff-note {
  font-size: 11px;
  color: var(--muted);
}

.ghost-diff--ahead .ghost-diff-value {
  color: var(--win);
}

.ghost-diff--behind .ghost-diff-value {
  color: var(--danger);
}

.ghost-diff--tied .ghost-diff-value {
  color: var(--muted);
}

/* ---- Combo ---- */
.combo-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 32px;
}

.value.combo {
  display: inline-block;
  color: var(--muted);
  text-shadow: none;
}

.value.combo.active {
  color: var(--combo);
  text-shadow: 0 0 12px var(--combo-glow);
}

.badge {
  display: inline-block;
  padding: 3px 10px;
  border-radius: var(--radius-pill);
  font-family: var(--font-display);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 1.5px;
  color: #1a1000;
  background: linear-gradient(135deg, #ffd27a, var(--b2b));
  box-shadow: 0 0 14px var(--b2b);
}

.energy-bar {
  position: relative;
  height: 12px;
  border-radius: var(--radius-pill);
  background: var(--canvas-bg);
  border: 1px solid var(--canvas-border);
  box-shadow: inset 0 1px 4px rgba(0, 0, 0, 0.35);
  overflow: hidden;
}

.energy-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #ff9f43, var(--energy));
  box-shadow: 0 0 10px color-mix(in srgb, var(--energy) 60%, transparent);
  transition: width 0.35s ease;
}

.energy-bar.full {
  border-color: var(--energy);
  animation: energy-pulse 1s ease-in-out infinite;
}

/* Brillo que recorre la barra llena */
.energy-bar.full .energy-fill {
  background: linear-gradient(90deg, var(--energy), #fff59d, var(--energy));
  background-size: 200% 100%;
  animation: energy-shine 1.4s linear infinite;
}

@keyframes energy-pulse {
  50% {
    box-shadow: 0 0 14px var(--energy);
  }
}

@keyframes energy-shine {
  to {
    background-position: -200% 0;
  }
}

.energy-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--energy);
}

.queue-strip {
  display: flex;
  gap: var(--space-1);
  margin-top: var(--space-1);
}
</style>
