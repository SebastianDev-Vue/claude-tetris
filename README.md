# Tetris

Implementación de **Tetris** con **Vue 3 + TypeScript**, renderizado en HTML5 Canvas y empaquetado con **Vite**. El motor del juego es TypeScript puro (sin DOM) y está cubierto por tests con **Vitest**.

![Tech](https://img.shields.io/badge/Vue-3-42b883)
![Tech](https://img.shields.io/badge/TypeScript-blue)
![Tech](https://img.shields.io/badge/Vite-646cff)
![Tech](https://img.shields.io/badge/Bun-black)
![Tech](https://img.shields.io/badge/HTML5-Canvas-orange)

---

## Tabla de contenidos

- [Qué hace el proyecto](#qué-hace-el-proyecto)
  - [Power-ups](#power-ups)
  - [Piezas no estándar](#piezas-no-estándar)
  - [Combos y bonificaciones](#combos-y-bonificaciones)
- [Cómo ejecutar el juego](#cómo-ejecutar-el-juego)
- [Controles](#controles)
- [Cómo funciona](#cómo-funciona)
  - [Arquitectura](#arquitectura)
  - [Flujo del juego](#flujo-del-juego)
- [Tests y calidad de código](#tests-y-calidad-de-código)
- [Tecnologías](#tecnologías)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Personalización](#personalización)
- [Licencia](#licencia)

---

## Qué hace el proyecto

Es una versión jugable de Tetris con todas las mecánicas que esperarías:

- Tablero de **10 × 20** celdas.
- Las **7 piezas estándar** (I, O, T, S, Z, J, L) con colores diferenciados.
- **Rotación** con _wall kicks_ básicos (pequeños desplazamientos para que la pieza pueda rotar pegada a la pared).
- **Soft drop** (bajada acelerada) y **hard drop** (caída instantánea).
- **Pieza fantasma** (_ghost piece_): muestra dónde aterrizará la pieza actual.
- **Vista previa** de la siguiente pieza.
- **Sistema de puntuación** clásico (100 / 300 / 500 / 800 multiplicado por nivel) con **combos, T-spin, Back-to-Back y perfect clear** (ver abajo).
- **Niveles** que aumentan cada 10 líneas y aceleran la caída.
- **Pausa** y **Game Over** con opción de reinicio.
- **Tema claro / oscuro**.
- **Power-ups**: cada 8 líneas aparece una pieza especial de 1 bloque (ver abajo).
- **Piezas no estándar**: pentominós, piezas de reto y recompensas (ver abajo), con halo pulsante y animaciones al entrar en juego.

### Power-ups

| Pieza | Efecto al fijarse |
| ----- | ----------------- |
| 💣 Bomba | Destruye el área 3×3 alrededor del bloque |
| ⚡ Rayo | Limpia la fila y la columna completas del bloque |
| 🎨 Tinte | Convierte en comodines (★) todos los bloques del color sobre el que cae (o del más abundante). Los comodines desaparecen con la siguiente limpieza de líneas y dan 50 puntos × nivel cada uno |
| ⬇ Gravedad | Compacta el tablero: cada columna cae hasta rellenar los huecos |
| ❄ Congelar | Detiene la caída automática durante 5 segundos |

El panel lateral muestra cuántas líneas faltan para el siguiente power-up y el tiempo restante de Congelar.

### Piezas no estándar

| Pieza | Bloques | Cuándo aparece |
| ----- | ------- | -------------- |
| Pentominó **+** | 5 | Ocasionalmente (10 % entre +, U e Y) |
| Pentominó **U** | 5 | Ocasionalmente |
| Pentominó **Y** | 5 | Ocasionalmente |
| **Single** 1×1 (dorada) | 1 | Como **recompensa** justo después de un Tetris |
| **Hueca 3×3** | 8 | Como **reto** (4 %): deja un hueco en el centro que solo el single puede tapar limpiamente |

Las piezas especiales brillan con un halo pulsante (también en la vista previa NEXT) y al entrar en juego lanzan chispas; la recompensa suelta estrellas doradas y el reto, ondas de aviso.

### Combos y bonificaciones

Cada jugada que limpia líneas se puntúa así:

```
puntos = base × nivel × combo × B2B  (+ perfect clear)
```

| Concepto | Regla |
| -------- | ----- |
| **Base** | 100 / 300 / 500 / 800 por 1–4 líneas. Un **T-spin** usa su propia tabla: 400 / 800 / 1200 / 1600 por 0–3 líneas |
| **Combo** | Limpiar líneas en fijados consecutivos multiplica: x2, x3, x4… (tope x10). Fijar sin limpiar lo reinicia |
| **T-spin** | Pieza T fijada justo después de rotarla, con al menos 3 de las 4 esquinas de su caja 3×3 ocupadas. Moverse o el soft drop tras rotar lo anulan; la caída normal y el hard drop no. Un T-spin sin líneas también puntúa |
| **Back-to-Back** | Un Tetris o T-spin con líneas justo después de otro vale **×1,5**. Un clear "fácil" (1–3 líneas sin T-spin) rompe la cadena |
| **Perfect clear** | Dejar el tablero completamente vacío: **+3000 × nivel** |

Efectos: destello en las filas limpiadas, barrido de chispas, sacudida del tablero (más fuerte en Tetris, T-spin y perfect clear), ondas para el B2B, lluvia de estrellas en el perfect clear y textos flotantes. Cada jugada tiene su **sonido** sintetizado y el tono sube con el combo (`M` para silenciar). El panel muestra el multiplicador de combo con una animación y la insignia **B2B** cuando el siguiente Tetris o T-spin recibirá la bonificación.

---

## Cómo ejecutar el juego

Requiere [Bun](https://bun.sh). El proyecto se generó con el creador oficial de Vue, `bun create vue@latest` (TypeScript, Vitest, Oxfmt y Oxlint).

```bash
bun install        # instala dependencias
bun run dev        # servidor de desarrollo en http://localhost:5173
```

Para generar la versión de producción:

```bash
bun run build      # chequeo de tipos + build en dist/
bun run preview    # sirve dist/ localmente
```

> Ya no se puede abrir `index.html` con doble clic: el navegador bloquea los módulos ES sobre `file://`. Usa siempre `bun run dev` o sirve la carpeta `dist/`.

---

## Controles

| Tecla     | Acción                            |
| --------- | --------------------------------- |
| `←` / `→` | Mover la pieza horizontalmente    |
| `↑` o `X` | Rotar la pieza en sentido horario |
| `↓`       | Soft drop (bajar más rápido)      |
| `Espacio` | Hard drop (caída instantánea)     |
| `P`       | Pausar / reanudar                 |
| `M`       | Activar / silenciar el sonido     |

---

## Cómo funciona

### Arquitectura

El código se divide en tres capas que no se mezclan:

1. **Motor** (`src/engine/`): TypeScript puro, sin DOM ni Vue.
   - `constants.ts`: tamaño del tablero, colores, formas de las piezas, puntuaciones y power-ups.
   - `game.ts`: la clase `Game` con todo el estado (tablero, pieza actual y siguiente, puntuación, nivel…) y las reglas: colisiones, rotación con _wall kicks_, caída, limpieza de líneas y power-ups. Se maneja con `update(dt)` en cada frame y con métodos de input (`moveLeft`, `rotate`, `hardDrop`…). Comunica los efectos visuales mediante eventos (`onEvent`).
2. **Render** (`src/render/`): `canvas.ts` dibuja el tablero, la pieza fantasma y las vistas previas; `effects.ts` gestiona los efectos pasajeros (textos flotantes, partículas y ondas) a partir de los eventos del motor.
3. **Interfaz Vue** (`src/composables/`, `src/components/`):
   - `useGame()` crea el motor, el único bucle `requestAnimationFrame`, los atajos de teclado y una copia reactiva (`hud`) de los datos que muestra el panel.
   - `useTheme()` gestiona el tema claro/oscuro.
   - Componentes: `GameBoard` (canvas del tablero), `SidePanel`, `PiecePreview`, `GameOverlay` (pausa / game over con transición) y `ThemeToggle`.

Algunas decisiones de diseño:

- **El tablero no es reactivo.** El motor se marca con `markRaw` para que Vue no lo envuelva en proxies; el canvas lo lee directamente en cada frame.
- **El bucle corre siempre** mientras la app está montada; el motor ignora `update()` en pausa o tras game over. Así reanudar nunca hace caer la pieza de golpe y no puede quedar un bucle vivo tras perder.
- **El tipo de pieza es también su índice de color**: las formas se rellenan con su propio número (1–18) y esos valores se copian al tablero tal cual.

### Flujo del juego

```
useGame()
  ├─ new Game()                      → reset(): tablero vacío, pieza actual y siguiente
  └─ onMounted → requestAnimationFrame(frame)
        ↓
   frame(now)
     ├─ game.update(dt)               → baja la pieza o llama a lockPiece()
     ├─ sincroniza hud (score, lines, level…)
     ├─ GameBoard / PiecePreview dibujan en sus canvas
     └─ requestAnimationFrame(frame)

   lockPiece(): isTSpin → merge → resolvePowerUp → clearLines (puntuación) → spawn
   keydown → mover / rotar / soft-drop / hard-drop / pausa
```

Cuando una pieza recién generada ya colisiona al aparecer (`spawn`), el juego pasa a **Game Over**.

---

## Tests y calidad de código

```bash
bun run test:unit          # Vitest en modo watch
bun run test:unit --run    # una sola pasada
bun run type-check         # chequeo de tipos con vue-tsc (TypeScript 7 / tsgo)
bun run lint               # Oxlint
bun run format             # Oxfmt (sin punto y coma, comillas simples)
```

> No uses `bun test`: lanza el test runner propio de Bun en lugar de Vitest.

Los tests (`src/engine/__tests__/game.spec.ts`) cubren el motor: colisiones, rotación y _wall kicks_, caída, pausa, game over, puntuación, niveles, cada power-up, las piezas no estándar, combos, T-spin, B2B y perfect clear. `src/render/__tests__/effects.spec.ts` comprueba la capa de efectos con un contexto de canvas falso y `src/audio/__tests__/sfx.spec.ts` el sonido con un `AudioContext` falso. El generador aleatorio se inyecta para que sean deterministas.

---

## Tecnologías

- **Vue 3** (`<script setup>`, composables, `provide`/`inject`, `<Transition>`).
- **TypeScript 7** (compilador nativo _tsgo_) en modo estricto, con `vue-tsc` para los componentes.
- **Vite** como servidor de desarrollo y bundler, con **Vue DevTools** integradas.
- **Vitest** para los tests del motor.
- **Oxlint** y **Oxfmt** para lint y formato.
- **Bun** como gestor de paquetes.
- **Canvas 2D API** para todo el renderizado del juego.

---

## Estructura del proyecto

```
03-tetris/
├── index.html                 # Punto de entrada de Vite
├── src/
│   ├── main.ts                # Monta la app
│   ├── App.vue                # Layout principal
│   ├── style.css              # Estilos globales y variables de tema
│   ├── engine/
│   │   ├── constants.ts       # Tablas: piezas, colores, puntuación, power-ups
│   │   ├── game.ts            # Motor del juego (clase Game)
│   │   └── __tests__/
│   │       └── game.spec.ts   # Tests del motor (Vitest)
│   ├── audio/
│   │   ├── sfx.ts             # Sonidos sintetizados (Web Audio)
│   │   └── __tests__/
│   ├── render/
│   │   ├── canvas.ts          # Dibujo del tablero y vistas previas
│   │   ├── effects.ts         # Popups, partículas y ondas
│   │   └── __tests__/         # Tests de los efectos
│   ├── composables/
│   │   ├── useGame.ts         # Puente motor ↔ Vue, bucle y teclado
│   │   └── useTheme.ts        # Tema claro / oscuro
│   └── components/            # GameBoard, SidePanel, PiecePreview, GameOverlay, ThemeToggle
├── env.d.ts
├── vite.config.ts             # Vite + Vue + Vue DevTools, alias @/
├── vitest.config.ts
├── tsconfig.json              # Referencias a tsconfig.app / .node / .vitest
├── .oxlintrc.json / .oxfmtrc.json
└── package.json
```

---

## Personalización

Parámetros fáciles de ajustar en `src/engine/constants.ts`:

| Constante               | Significado                                  | Por defecto           |
| ----------------------- | -------------------------------------------- | --------------------- |
| `COLS`                  | Columnas del tablero                         | `10`                  |
| `ROWS`                  | Filas del tablero                            | `20`                  |
| `BLOCK`                 | Tamaño en píxeles de cada celda              | `30`                  |
| `COLORS`                | Paleta de colores por tipo de pieza          | 7 piezas + power-ups  |
| `LINE_SCORES`           | Puntos por 1, 2, 3 o 4 líneas eliminadas     | `[0,100,300,500,800]` |
| `INITIAL_DROP_INTERVAL` | Velocidad inicial de caída en ms             | `1000`                |
| `LINES_PER_POWERUP`     | Líneas necesarias para el siguiente power-up | `8`                   |
| `FREEZE_MS`             | Duración de Congelar en ms                   | `5000`                |
| `PENTOMINO_CHANCE`      | Probabilidad de pentominó                    | `0.1`                 |
| `HOLLOW_CHANCE`         | Probabilidad de la pieza hueca (reto)        | `0.04`                |
| `TSPIN_SCORES`          | Puntos de un T-spin con 0, 1, 2 o 3 líneas   | `[400,800,1200,1600]` |
| `MAX_COMBO_MULTIPLIER`  | Tope del multiplicador de combo              | `10`                  |
| `B2B_MULTIPLIER`        | Bonificación Back-to-Back                    | `1.5`                 |
| `PERFECT_CLEAR_SCORE`   | Puntos de un perfect clear (× nivel)         | `3000`                |

El tamaño del canvas se calcula a partir de `COLS`, `ROWS` y `BLOCK`, así que no hace falta tocar nada más.

---

## Licencia

Proyecto de uso libre con fines educativos y de práctica.
