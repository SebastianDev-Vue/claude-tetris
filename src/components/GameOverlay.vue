<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { MODES } from '../engine/challenges'
import { SKILLS, type SkillId } from '../engine/skills'
import { useGameContext } from '../composables/useGame'
import { NAME_MAX_LENGTH, useRecords } from '../composables/useRecords'
import RecordsTable from './RecordsTable.vue'

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
  return (id === 'undo' && !hud.canUndo) || (id === 'hold' && (!hud.holdUsed || !hud.holdFits))
}

const { records, bestCombo, maxLines, qualifies, save, clear } = useRecords()
const playerName = ref('')
/** Fila guardada en esta partida (-1 = aún sin guardar). */
const savedIndex = ref(-1)
const canSave = computed(() => savedIndex.value < 0 && qualifies(hud.score))

// Cada game over empieza sin guardar
watch(
  () => hud.gameOver,
  (over) => {
    if (over) savedIndex.value = -1
  },
)

function saveRecord(): void {
  if (!canSave.value) return
  savedIndex.value = save({
    name: playerName.value,
    score: hud.score,
    lines: hud.lines,
    maxCombo: hud.maxCombo,
    mode: hud.mode,
    date: new Date().toISOString(),
  })
}

function clearRecords(): void {
  ;(document.activeElement as HTMLElement | null)?.blur() // que Space no lo repita al jugar
  if (confirm('¿Borrar todos los récords?')) {
    clear()
    savedIndex.value = -1
  }
}

/** Enfoca el campo del nombre al aparecer. */
const vFocus = { mounted: (el: HTMLElement) => el.focus() }
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
          <RecordsTable
            :records="records"
            :best-combo="bestCombo"
            :max-lines="maxLines"
            :highlight="-1"
            @clear="clearRecords"
          />
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
          <div v-if="canSave" class="record-form">
            <p class="record-qualifies">¡Entras en el top 5! Escribe tu nombre:</p>
            <input
              v-model="playerName"
              v-focus
              class="record-input"
              type="text"
              :maxlength="NAME_MAX_LENGTH"
              placeholder="Jugador"
              aria-label="Nombre del jugador"
              @keydown.enter="saveRecord"
            />
            <button class="restart-btn" type="button" @click="run(saveRecord, $event)">
              Guardar
            </button>
          </div>
          <p v-else-if="savedIndex >= 0" class="record-new-msg">¡Nuevo récord!</p>
          <div class="overlay-actions">
            <button class="restart-btn" type="button" @click="run(restart, $event)">
              Reiniciar
            </button>
            <button class="restart-btn secondary" type="button" @click="run(openMenu, $event)">
              Menú
            </button>
          </div>
          <RecordsTable
            :records="records"
            :best-combo="bestCombo"
            :max-lines="maxLines"
            :highlight="savedIndex"
            @clear="clearRecords"
          />
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
