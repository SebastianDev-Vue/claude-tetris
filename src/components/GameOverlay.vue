<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { MODES } from '../engine/challenges'
import { SKILLS, type SkillId } from '../engine/skills'
import { useGameContext } from '../composables/useGame'
import { NAME_MAX_LENGTH, useRecords } from '../composables/useRecords'
import { keyLabel } from '../composables/useSettings'
import { loadGhost } from '../composables/useGhosts'
import { linesPerMinute } from '../composables/useRunStats'
import RecordsTable from './RecordsTable.vue'
import ScoreCurve from './ScoreCurve.vue'
import SettingsPanel from './SettingsPanel.vue'

const {
  hud,
  settings,
  runStats,
  start,
  restart,
  openMenu,
  togglePause,
  setStartLevel,
  useSkill,
  closeSkillMenu,
} = useGameContext()

/** Lista de teclas desplegada dentro del menú de pausa. */
const showControls = ref(false)
/** Panel de ajustes en lugar del contenido del menú de pausa. */
const showSettings = ref(false)

/** Aplica el nivel elegido y suelta el foco: las flechas no deben seguir cambiándolo. */
function pickLevel(e: Event): void {
  const select = e.target as HTMLSelectElement
  setStartLevel(Number(select.value))
  select.blur()
}

type Screen = 'menu' | 'over' | 'skills' | 'countdown' | 'pause' | null

const screen = computed<Screen>(() => {
  if (hud.menu) return 'menu'
  if (hud.gameOver) return 'over'
  if (hud.skillMenu) return 'skills'
  if (hud.countdown > 0) return 'countdown'
  if (hud.paused) return 'pause'
  return null
})

/** Marca de cada modo contra la que se jugaría; se relee cada vez que se abre el menú. */
const ghostScores = computed(() =>
  hud.menu && settings.values.versusGhost ? MODES.map((m) => loadGhost(m.id)?.score) : [],
)

/** Quita el foco del botón pulsado: si no, Space lo reactivaría al jugar. */
function run(action: () => void, e: MouseEvent): void {
  ;(e.currentTarget as HTMLButtonElement).blur()
  action()
}

/** Habilidades que ahora mismo no harían nada (no gastan energía, pero se atenúan). */
function unavailable(id: SkillId): boolean {
  return (id === 'undo' && !hud.canUndo) || (id === 'hold' && (!hud.holdUsed || !hud.holdFits))
}

const { records, bestCombo, maxLines, bestFor, qualifies, save, clear } = useRecords()
const playerName = ref('')
/** Fila guardada en esta partida (-1 = aún sin guardar). */
const savedIndex = ref(-1)
const canSave = computed(() => savedIndex.value < 0 && qualifies(hud.score))
/** Marca del modo al acabar: se congela para que guardar esta partida no la cambie. */
const previousBest = ref<number | null>(null)

// Cada game over empieza sin guardar
watch(
  () => hud.gameOver,
  (over) => {
    if (!over) return
    savedIndex.value = -1
    previousBest.value = bestFor(hud.mode)
  },
)

const modeName = computed(() => MODES.find((m) => m.id === hud.mode)?.name ?? '')

const comparison = computed(() => {
  if (previousBest.value === null) return 'Primera marca en este modo'
  const diff = hud.score - previousBest.value
  if (diff === 0) return 'Igualas tu mejor marca'
  const amount = Math.abs(diff).toLocaleString()
  return diff > 0 ? `+${amount} sobre tu mejor marca` : `−${amount} bajo tu mejor marca`
})

const reportItems = computed(() => {
  const s = runStats.value
  return [
    { label: 'Tetris', value: s.tetrises },
    { label: 'T-spin', value: s.tspins },
    { label: 'Combo', value: `x${s.bestCombo}` },
    { label: 'Perfect', value: s.perfects },
    { label: 'Piezas', value: s.pieces },
    {
      label: 'Líneas/min',
      value: linesPerMinute(s).toLocaleString(undefined, { maximumFractionDigits: 1 }),
    },
  ]
})

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
    previousBest.value = null
  }
}

/** Enfoca el campo del nombre al aparecer. */
const vFocus = { mounted: (el: HTMLElement) => el.focus() }
</script>

<template>
  <Transition name="fade">
    <div
      v-if="screen"
      class="overlay"
      :class="{ 'overlay--menu': screen === 'menu', 'overlay--countdown': screen === 'countdown' }"
    >
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
                  <span v-if="ghostScores[i] !== undefined" class="mode-ghost">
                    Fantasma: {{ ghostScores[i]!.toLocaleString() }} puntos
                  </span>
                </span>
              </button>
            </li>
          </ul>
        </div>

        <!-- Fin de partida -->
        <div v-else-if="screen === 'over'" key="over" class="overlay-box overlay-box--over">
          <p class="overlay-title" :class="{ 'overlay-title--win': hud.won }">
            {{ hud.won ? '¡OBJETIVO CUMPLIDO!' : 'GAME OVER' }}
          </p>
          <p class="overlay-sub">{{ modeName }}</p>
          <p v-if="hud.endReason && !hud.won" class="overlay-sub">{{ hud.endReason }}</p>
          <div class="report">
            <div class="report-summary">
              <p class="report-score">{{ hud.score.toLocaleString() }}</p>
              <p class="report-line">Tiempo: {{ hud.time }}</p>
              <p class="report-line">{{ comparison }}</p>
              <p class="report-line">
                <template v-if="runStats.bestPlay">
                  Tu mejor jugada: {{ runStats.bestPlay.label }}, +{{
                    runStats.bestPlay.points.toLocaleString()
                  }}
                </template>
                <template v-else>Sin jugadas puntuables</template>
              </p>
              <dl class="report-stats">
                <div v-for="item in reportItems" :key="item.label">
                  <dd>{{ item.value }}</dd>
                  <dt>{{ item.label }}</dt>
                </div>
              </dl>
            </div>
            <ScoreCurve :samples="runStats.samples" :level-ups="runStats.levelUps" />
          </div>
          <div v-if="canSave" class="record-form">
            <p class="record-qualifies">¡Entras en el top 5! Escribe tu nombre:</p>
            <div class="record-row">
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
                Guardar récord
              </button>
            </div>
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

        <!-- Cuenta atrás al reanudar: deja ver el tablero -->
        <div v-else-if="screen === 'countdown'" key="countdown" role="status">
          <!-- :key: cada número relanza la animación -->
          <p :key="hud.countdown" class="countdown">{{ hud.countdown }}</p>
        </div>

        <!-- Ajustes (dentro de la pausa) -->
        <div v-else-if="showSettings" key="settings" class="overlay-box">
          <p class="overlay-title overlay-title--accent">AJUSTES</p>
          <SettingsPanel @close="showSettings = false" />
        </div>

        <!-- Pausa -->
        <div v-else key="pause" class="overlay-box">
          <p class="overlay-title">PAUSA</p>
          <div class="overlay-actions">
            <button class="restart-btn" type="button" @click="run(togglePause, $event)">
              Reanudar
            </button>
            <button class="restart-btn secondary" type="button" @click="run(restart, $event)">
              Reiniciar
            </button>
            <button class="restart-btn secondary" type="button" @click="run(openMenu, $event)">
              Menú
            </button>
          </div>
          <label class="pause-level">
            Nivel inicial
            <select class="restart-btn secondary" :value="hud.startLevel" @change="pickLevel">
              <option v-for="n in 10" :key="n" :value="n">{{ n }}</option>
            </select>
          </label>
          <p class="pause-hint">Se aplica al reiniciar o al empezar otra partida</p>
          <div class="overlay-actions">
            <button
              class="restart-btn secondary"
              type="button"
              :aria-expanded="showControls"
              @click="run(() => (showControls = !showControls), $event)"
            >
              {{ showControls ? 'Ocultar controles' : 'Ver controles' }}
            </button>
            <button
              class="restart-btn secondary"
              type="button"
              @click="run(() => (showSettings = true), $event)"
            >
              Ajustes
            </button>
          </div>
          <ul v-if="showControls" class="pause-controls">
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
            <li><kbd>P</kbd><kbd>Esc</kbd> pausa</li>
            <li><kbd>M</kbd> sonido: {{ hud.muted ? 'off' : 'on' }}</li>
          </ul>
        </div>
      </Transition>
    </div>
  </Transition>

  <!-- Récords en un panel aparte bajo la barra superior: dentro del overlay no caben sin scroll -->
  <Teleport to="body">
    <Transition name="fade">
      <aside v-if="screen === 'menu' || screen === 'over'" class="records-panel">
        <RecordsTable
          :records="records"
          :best-combo="bestCombo"
          :max-lines="maxLines"
          :highlight="screen === 'over' ? savedIndex : -1"
          @clear="clearRecords"
        />
      </aside>
    </Transition>
  </Teleport>
</template>

<style scoped>
.overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  background: var(--overlay-bg);
  backdrop-filter: blur(10px) saturate(130%);
  border-radius: var(--radius-lg);
}

.overlay-box {
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  align-items: center;
  max-width: 100%;
  padding: var(--space-6) var(--space-6) 28px;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--glass-highlight), var(--shadow-lg);
  backdrop-filter: blur(18px) saturate(150%);
}

.overlay-title {
  text-align: center;
  font-family: var(--font-display);
  font-size: 30px;
  font-weight: 900;
  letter-spacing: 5px;
  color: var(--danger);
  text-shadow: 0 0 22px color-mix(in srgb, var(--danger) 55%, transparent);
  margin-bottom: var(--space-1);
}

/* ---- Fin de partida: resumen y curva en paralelo, en una columna si no hay ancho ---- */
.overlay-box--over {
  width: 660px;
  max-height: 100%;
  overflow-y: auto;
  padding: var(--space-4);
  gap: var(--space-2);
}

.overlay-box--over .overlay-title {
  font-size: 26px;
  margin-bottom: 0;
}

.overlay-box--over .restart-btn {
  margin-top: 0;
}

.report {
  width: 100%;
  display: grid;
  grid-template-columns: minmax(0, 5fr) minmax(0, 6fr);
  gap: var(--space-3);
  align-items: start;
}

/* font-size-adjust encoge la letra bitmap, pero sin esto las líneas se pisan */
:root[data-style='retro'] .overlay-box--over {
  line-height: 1.8;
}

.report-summary {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  text-align: left;
}

.report-score {
  font-family: var(--font-mono);
  font-size: 36px;
  font-weight: 800;
  line-height: 1.1;
  color: var(--text);
  overflow-wrap: anywhere;
}

.report-line {
  font-size: 13px;
  color: var(--muted);
}

.report-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.report-stats dd {
  font-family: var(--font-mono);
  font-size: 17px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--text);
}

.report-stats dt {
  font-size: 11px;
  color: var(--label);
}

@media (max-width: 760px) {
  .report {
    grid-template-columns: minmax(0, 1fr);
    justify-items: center;
  }

  .report-summary {
    width: 100%;
  }

  /* El SVG escala con el ancho: sin tope, a 700 px la curva y sus textos quedan enormes */
  .score-curve {
    width: 100%;
    max-width: 440px;
  }
}

.overlay-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
}

.overlay-title--accent {
  color: var(--text);
  text-shadow: 0 0 22px var(--title-glow);
}

.overlay-title--win {
  color: var(--win);
  text-shadow: 0 0 18px var(--win);
  animation: win-pulse 1.2s ease-in-out infinite;
}

@keyframes win-pulse {
  50% {
    transform: scale(1.06);
  }
}

.overlay-sub {
  font-size: 14px;
  color: var(--muted);
}

/* La pantalla de menú tapa más el tablero para que se lea bien */
.overlay--menu {
  background: var(--menu-bg);
}

/* La cuenta atrás deja ver el tablero para volver a situarse */
.overlay--countdown {
  background: transparent;
  backdrop-filter: none;
  pointer-events: none;
}

.countdown {
  font-family: var(--font-display);
  font-size: 96px;
  font-weight: 900;
  line-height: 1;
  color: var(--text);
  text-shadow:
    0 0 6px var(--canvas-bg),
    0 0 18px var(--canvas-bg),
    0 0 28px var(--accent);
  /* con prefers-reduced-motion la regla global de style.css la anula */
  animation: countdown-pop 1s var(--ease-out);
}

@keyframes countdown-pop {
  from {
    transform: scale(1.5);
    opacity: 0.3;
  }
}

/* Campos de formulario del overlay (nombre del récord, selectores).
   :where() mantiene la especificidad de antes para que .restart-btn.secondary siga ganando */
:where(.overlay) input[type='text'],
:where(.overlay) select {
  font: inherit;
  font-size: 14px;
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  padding: 9px 14px;
  box-shadow: var(--glass-highlight);
  transition:
    border-color var(--dur-fast) ease,
    box-shadow var(--dur-fast) ease;
}

:where(.overlay) input[type='text']:hover,
:where(.overlay) select:hover {
  border-color: var(--accent);
}

:where(.overlay) input[type='text']:focus-visible,
:where(.overlay) select:focus-visible {
  outline: none;
  border-color: var(--accent);
  box-shadow: var(--focus-ring);
}

:where(.overlay) select option {
  background: var(--canvas-bg);
  color: var(--text);
}

/* ---- Menú de modos ---- */
.mode-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  width: 340px;
  max-width: 100%;
}

.mode-btn {
  position: relative;
  width: 100%;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: 11px 14px;
  text-align: left;
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  overflow: hidden;
  transition:
    transform var(--dur-fast) var(--ease-out),
    border-color var(--dur-fast) ease,
    background var(--dur-fast) ease,
    box-shadow var(--dur-fast) ease;
}

/* Barra de acento a la izquierda que aparece al seleccionar */
.mode-btn::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--accent-grad);
  transform: scaleY(0);
  transition: transform var(--dur-med) var(--ease-out);
}

.mode-btn:hover,
.mode-btn:focus-visible {
  transform: translateX(4px);
  background: var(--surface-hover);
  border-color: var(--accent);
  box-shadow: 0 6px 22px var(--title-glow);
  outline: none;
}

.mode-btn:hover::before,
.mode-btn:focus-visible::before {
  transform: scaleY(1);
}

.mode-btn:active {
  transform: translateX(4px) scale(0.98);
}

.mode-btn kbd {
  flex-shrink: 0;
}

.mode-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.mode-name {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 13px;
  letter-spacing: 1px;
}

.mode-desc {
  font-size: 12px;
  color: var(--muted);
}

.mode-ghost {
  font-size: 11px;
  color: var(--accent);
}

.overlay-title--energy {
  color: var(--energy);
  text-shadow: 0 0 18px var(--energy);
}

.skill-btn:hover,
.skill-btn:focus-visible {
  border-color: var(--skill);
  box-shadow: 0 6px 22px color-mix(in srgb, var(--skill) 45%, transparent);
}

.skill-btn::before {
  background: var(--skill);
}

.skill-btn.unavailable {
  opacity: 0.45;
}

.skill-icon {
  font-size: 20px;
  width: 24px;
  text-align: center;
}

/* ===== Menú de pausa: nivel inicial y lista de controles ===== */
.pause-level {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  font-size: 14px;
  color: var(--text);
}

.pause-level select {
  margin-top: 0;
  cursor: pointer;
}

.pause-hint {
  font-size: 11px;
  color: var(--muted);
}

.pause-controls {
  list-style: none;
  display: grid;
  grid-template-columns: repeat(2, auto);
  gap: 6px 16px;
  justify-content: center;
  text-align: left;
}

.pause-controls li {
  font-size: 12px;
  color: var(--muted);
  display: flex;
  align-items: center;
  gap: 4px;
}

/* Panel fijo a la derecha, bajo la barra de skin y tema (fuera del overlay del tablero) */
.records-panel {
  position: fixed;
  top: 72px;
  right: var(--space-4);
  z-index: 9;
  width: 280px;
  padding: var(--space-4);
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--glass-highlight), var(--shadow-md);
  backdrop-filter: blur(14px) saturate(140%);
}

/* Sin hueco a la derecha de la pantalla de fin (660 px centrados): va al final de la página */
@media (max-width: 1260px) {
  .records-panel {
    position: static;
    margin: var(--space-4) auto;
  }
}

.record-form {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.record-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: var(--space-2);
}

.record-qualifies,
.record-new-msg {
  font-size: 13px;
  font-weight: 700;
  color: var(--energy);
}

.record-new-msg {
  font-size: 16px;
  animation: win-pulse 1.2s ease-in-out infinite;
}

/* El resto lo da la regla de input[type='text'] */
.record-input {
  width: 160px;
  text-align: center;
}
</style>
