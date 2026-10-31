<script setup lang="ts">
import { computed } from 'vue'
import { MODES } from '../engine/challenges'
import { SKILLS, type SkillId } from '../engine/skills'
import { useGameContext } from '../composables/useGame'

const { hud, start, restart, openMenu, togglePause, useSkill, closeSkillMenu } = useGameContext()

type Screen = 'menu' | 'over' | 'skills' | 'pause' | null

const screen = computed<Screen>(() => {
  if (hud.menu) return 'menu'
  if (hud.gameOver) return 'over'
  if (hud.skillMenu) return 'skills'
  if (hud.paused) return 'pause'
  return null
})

/** Quita el foco del botón pulsado: si no, Space lo reactivaría al jugar. */
function run(action: () => void, e: MouseEvent): void {
  ;(e.currentTarget as HTMLButtonElement).blur()
  action()
}

/** Habilidades que ahora mismo no harían nada (no gastan energía, pero se atenúan). */
function unavailable(id: SkillId): boolean {
  return id === 'undo' && !hud.canUndo
}
</script>

<template>
  <Transition name="fade">
    <div v-if="screen" class="overlay" :class="{ 'overlay--menu': screen === 'menu' }">
      <Transition name="slide" mode="out-in">
        <!-- Selección de modo -->
        <div v-if="screen === 'menu'" key="menu" class="overlay-box">
          <p class="overlay-title overlay-title--accent">ELIGE MODO</p>
          <ul class="mode-list">
            <li v-for="(mode, i) in MODES" :key="mode.id">
              <button class="mode-btn" type="button" @click="run(() => start(mode.id), $event)">
                <kbd>{{ i + 1 }}</kbd>
                <span class="mode-text">
                  <span class="mode-name">{{ mode.name }}</span>
                  <span class="mode-desc">{{ mode.description }}</span>
                </span>
              </button>
            </li>
          </ul>
        </div>

        <!-- Fin de partida -->
        <div v-else-if="screen === 'over'" key="over" class="overlay-box">
          <p class="overlay-title" :class="{ 'overlay-title--win': hud.won }">
            {{ hud.won ? '¡OBJETIVO CUMPLIDO!' : 'GAME OVER' }}
          </p>
          <p v-if="hud.challengeName" class="overlay-sub">{{ hud.challengeName }}</p>
          <p v-if="hud.endReason && !hud.won" class="overlay-sub">{{ hud.endReason }}</p>
          <p class="overlay-score">
            Puntuación: {{ hud.score.toLocaleString() }} · Tiempo: {{ hud.time }}
          </p>
          <div class="overlay-actions">
            <button class="restart-btn" type="button" @click="run(restart, $event)">
              Reiniciar
            </button>
            <button class="restart-btn secondary" type="button" @click="run(openMenu, $event)">
              Menú
            </button>
          </div>
        </div>

        <!-- Habilidades (barra de energía llena) -->
        <div v-else-if="screen === 'skills'" key="skills" class="overlay-box">
          <p class="overlay-title overlay-title--energy">HABILIDADES</p>
          <ul class="mode-list">
            <li v-for="(skill, i) in SKILLS" :key="skill.id">
              <button
                class="mode-btn skill-btn"
                :class="{ unavailable: unavailable(skill.id) }"
                :style="{ '--skill': skill.color }"
                type="button"
                @click="run(() => useSkill(skill.id), $event)"
              >
                <kbd>{{ i + 1 }}</kbd>
                <span class="skill-icon">{{ skill.icon }}</span>
                <span class="mode-text">
                  <span class="mode-name">{{ skill.name }}</span>
                  <span class="mode-desc">{{ skill.description }}</span>
                </span>
              </button>
            </li>
          </ul>
          <button class="restart-btn secondary" type="button" @click="run(closeSkillMenu, $event)">
            Cancelar (Esc)
          </button>
        </div>

        <!-- Pausa -->
        <div v-else key="pause" class="overlay-box">
          <p class="overlay-title">PAUSA</p>
          <div class="overlay-actions">
            <button class="restart-btn" type="button" @click="run(togglePause, $event)">
              Continuar
            </button>
            <button class="restart-btn secondary" type="button" @click="run(restart, $event)">
              Reiniciar
            </button>
            <button class="restart-btn secondary" type="button" @click="run(openMenu, $event)">
              Menú
            </button>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>
</template>
