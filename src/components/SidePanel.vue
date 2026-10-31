<script setup lang="ts">
import { computed } from 'vue'
import { MAX_COMBO_MULTIPLIER } from '../engine/constants'
import { useGameContext } from '../composables/useGame'
import PiecePreview from './PiecePreview.vue'

const { game, hud } = useGameContext()

/** El combo se muestra como multiplicador a partir del segundo clear encadenado. */
const comboLabel = computed(() =>
  hud.combo >= 2 ? `x${Math.min(hud.combo, MAX_COMBO_MULTIPLIER)}` : '—',
)
</script>

<template>
  <aside class="panel">
    <div class="panel-section">
      <span class="label">SCORE</span>
      <span class="value">{{ hud.score.toLocaleString() }}</span>
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
      <span class="label">POWER-UP</span>
      <span class="info">{{ hud.powerUpInfo }}</span>
    </div>

    <div class="panel-section">
      <span class="label">NEXT</span>
      <PiecePreview :piece="() => game.next" />
    </div>
  </aside>
</template>
