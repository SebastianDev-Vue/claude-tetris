<script setup lang="ts">
import { computed, ref } from 'vue'
import { formatTime } from '../engine/challenges'
import type { LevelUp, ScoreSample } from '../composables/useRunStats'

const props = defineProps<{ samples: ScoreSample[]; levelUps: LevelUp[] }>()

const WIDTH = 400
const HEIGHT = 150
const LEFT = 38 // eje Y
const RIGHT = WIDTH - 8
const TOP = 18 // banda de las etiquetas de nivel, por encima de la curva
const BOTTOM = HEIGHT - 4
const LABEL_GAP = 26

const compact = new Intl.NumberFormat(undefined, { notation: 'compact' })

const end = computed(() => props.samples[props.samples.length - 1])
const peak = computed(() => Math.max(0, ...props.samples.map((s) => s.score)))

// Máximos de al menos 1: una partida sin tiempo o sin puntos dibuja una línea plana, no NaN
const xOf = (ms: number) => LEFT + (ms / Math.max(1, end.value?.ms ?? 0)) * (RIGHT - LEFT)
const yOf = (score: number) => BOTTOM - (score / Math.max(1, peak.value)) * (BOTTOM - TOP)

const points = computed(() => props.samples.map((s) => `${xOf(s.ms)},${yOf(s.score)}`).join(' '))
const areaPoints = computed(() => `${LEFT},${BOTTOM} ${points.value} ${RIGHT},${BOTTOM}`)

/** Todas las subidas llevan línea; la etiqueta se omite si pisaría a la anterior. */
const marks = computed(() => {
  let lastLabelX = -Infinity
  return props.levelUps.map(({ ms, level }) => {
    const x = xOf(ms)
    const labeled = x - lastLabelX >= LABEL_GAP
    if (labeled) lastLabelX = x
    return { x, level, labeled, labelX: Math.min(x, WIDTH - 14) }
  })
})

const summary = computed(() => {
  const ups = props.levelUps.length
  const levels = ups === 1 ? '1 subida de nivel' : `${ups} subidas de nivel`
  return `Curva de puntuación: ${(end.value?.score ?? 0).toLocaleString()} puntos en ${formatTime(end.value?.ms ?? 0)}, con ${levels}.`
})

const hovered = ref<ScoreSample | null>(null)

function onPointerMove(e: PointerEvent): void {
  const box = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
  const x = ((e.clientX - box.left) / box.width) * WIDTH
  const distance = (s: ScoreSample) => Math.abs(xOf(s.ms) - x)
  hovered.value = props.samples.reduce<ScoreSample | null>(
    (best, s) => (!best || distance(s) < distance(best) ? s : best),
    null,
  )
}
</script>

<template>
  <figure class="score-curve">
    <figcaption class="curve-caption">Puntos en el tiempo · │ subida de nivel</figcaption>
    <svg
      class="curve-plot"
      :viewBox="`0 0 ${WIDTH} ${HEIGHT}`"
      role="img"
      :aria-label="summary"
      @pointermove="onPointerMove"
      @pointerleave="hovered = null"
    >
      <line class="curve-grid" :x1="LEFT" :x2="RIGHT" :y1="BOTTOM" :y2="BOTTOM" />
      <line v-if="peak > 0" class="curve-grid" :x1="LEFT" :x2="RIGHT" :y1="TOP" :y2="TOP" />
      <text class="curve-text" :x="LEFT - 5" :y="BOTTOM" text-anchor="end">0</text>
      <text v-if="peak > 0" class="curve-text" :x="LEFT - 5" :y="TOP + 4" text-anchor="end">
        {{ compact.format(peak) }}
      </text>

      <g v-for="mark in marks" :key="mark.level">
        <line class="curve-level" :x1="mark.x" :x2="mark.x" :y1="TOP - 3" :y2="BOTTOM" />
        <text
          v-if="mark.labeled"
          class="curve-text"
          :x="mark.labelX"
          :y="TOP - 6"
          text-anchor="middle"
        >
          N{{ mark.level }}
        </text>
      </g>

      <polygon class="curve-area" :points="areaPoints" />
      <polyline class="curve-line" :points="points" pathLength="1" />
      <line
        v-if="hovered"
        class="curve-crosshair"
        :x1="xOf(hovered.ms)"
        :x2="xOf(hovered.ms)"
        :y1="TOP"
        :y2="BOTTOM"
      />
      <!-- rect y no circle: la skin 8-bit lo cuadra con rx desde CSS -->
      <rect
        v-if="end"
        class="curve-dot"
        :x="xOf(end.ms) - 5"
        :y="yOf(end.score) - 5"
        width="10"
        height="10"
      />
    </svg>
    <div class="curve-axis">
      <span>0:00</span>
      <span v-if="hovered">
        {{ formatTime(hovered.ms) }} · {{ hovered.score.toLocaleString() }} pts
      </span>
      <span>{{ formatTime(end?.ms ?? 0) }}</span>
    </div>
  </figure>
</template>

<style scoped>
.score-curve {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-2);
  background: var(--canvas-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
}

.curve-caption,
.curve-axis {
  font-size: 11px;
  color: var(--muted);
}

.curve-caption {
  text-align: left;
}

.curve-plot {
  display: block;
  width: 100%;
  height: auto;
  touch-action: none;
}

.curve-axis {
  display: flex;
  justify-content: space-between;
  gap: var(--space-2);
  padding-left: 9.5%; /* LEFT / WIDTH: alinea 0:00 con el inicio de la curva */
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

.curve-text {
  font-family: var(--font-mono);
  font-size: 11px;
  fill: var(--muted);
}

.curve-grid {
  stroke: var(--glass-border);
  stroke-width: 1;
}

.curve-level {
  stroke: var(--label);
  stroke-width: 1;
  opacity: 0.55;
}

.curve-crosshair {
  stroke: var(--text);
  stroke-width: 1;
}

.curve-line {
  fill: none;
  stroke: var(--accent);
  stroke-width: 2;
  stroke-linejoin: round;
  stroke-linecap: round;
}

.curve-area {
  fill: var(--accent);
  opacity: 0.1;
}

.curve-dot {
  rx: 5px;
  fill: var(--accent);
  stroke: var(--canvas-bg);
  stroke-width: 2;
}

/* Sin regla para reduced motion: la curva aparece ya dibujada */
@media (prefers-reduced-motion: no-preference) {
  .curve-line {
    stroke-dasharray: 1;
    animation: curve-draw 0.9s var(--ease-out) both;
  }

  .curve-area,
  .curve-dot {
    animation: curve-fade var(--dur-med) ease 0.7s both;
  }
}

@keyframes curve-draw {
  from {
    stroke-dashoffset: 1;
  }
  to {
    stroke-dashoffset: 0;
  }
}

@keyframes curve-fade {
  from {
    opacity: 0;
  }
}

/* A esa anchura el viewBox se reduce: se compensa para que los textos sigan legibles */
@media (max-width: 760px) {
  .curve-text {
    font-size: 14px;
  }
}

/* 8-bit: el * { border-radius: 0 } de style.css no afecta al SVG */
:root[data-style='retro'] .curve-dot {
  rx: 0;
}

/* font-size-adjust reduce la letra bitmap: sin esto las etiquetas quedan ilegibles */
:root[data-style='retro'] .curve-text {
  font-size: 18px;
}

:root[data-style='retro'] .curve-line {
  stroke-linejoin: miter;
  stroke-linecap: butt;
}

:root[data-style='retro'] .curve-grid {
  stroke: var(--label);
}

:root[data-style='retro'] .curve-plot line,
:root[data-style='retro'] .curve-plot polyline {
  shape-rendering: crispEdges;
}
</style>
