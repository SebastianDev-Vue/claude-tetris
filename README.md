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
- [Cómo ejecutar el juego](#cómo-ejecutar-el-juego)
- [Controles](#controles)
- [Cómo funciona](#cómo-funciona)
  - [Arquitectura](#arquitectura)
  - [Flujo del juego](#flujo-del-juego)
- [Tests](#tests)
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
- **Sistema de puntuación** clásico (100 / 300 / 500 / 800 multiplicado por nivel).
- **Niveles** que aumentan cada 10 líneas y aceleran la caída.
- **Pausa** y **Game Over** con opción de reinicio.
- **Tema claro / oscuro**.
- **Power-ups**: cada 8 líneas aparece una pieza especial de 1 bloque (ver abajo).

### Power-ups

| Pieza | Efecto al fijarse |
| ----- | ----------------- |
| 💣 Bomba | Destruye el área 3×3 alrededor del bloque |
| ⚡ Rayo | Limpia la fila y la columna completas del bloque |
| 🎨 Tinte | Convierte en comodines (★) todos los bloques del color sobre el que cae (o del más abundante). Los comodines desaparecen con la siguiente limpieza de líneas y dan 50 puntos × nivel cada uno |
| ⬇ Gravedad | Compacta el tablero: cada columna cae hasta rellenar los huecos |
| ❄ Congelar | Detiene la caída automática durante 5 segundos |

El panel lateral muestra cuántas líneas faltan para el siguiente power-up y el tiempo restante de Congelar.

---

## Cómo ejecutar el juego

Requiere [Bun](https://bun.sh).

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

---

## Cómo funciona

### Arquitectura

El código se divide en tres capas que no se mezclan:

1. **Motor** (`src/engine/`): TypeScript puro, sin DOM ni Vue.
   - `constants.ts`: tamaño del tablero, colores, formas de las piezas, puntuaciones y power-ups.
   - `game.ts`: la clase `Game` con todo el estado (tablero, pieza actual y siguiente, puntuación, nivel…) y las reglas: colisiones, rotación con _wall kicks_, caída, limpieza de líneas y power-ups. Se maneja con `update(dt)` en cada frame y con métodos de input (`moveLeft`, `rotate`, `hardDrop`…). Comunica los efectos visuales mediante eventos (`onEvent`).
2. **Render** (`src/render/canvas.ts`): dibuja el tablero, la pieza fantasma, las vistas previas y los textos flotantes sobre un `<canvas>`.
3. **Interfaz Vue** (`src/composables/`, `src/components/`):
   - `useGame()` crea el motor, el único bucle `requestAnimationFrame`, los atajos de teclado y una copia reactiva (`hud`) de los datos que muestra el panel.
   - `useTheme()` gestiona el tema claro/oscuro.
   - Componentes: `GameBoard` (canvas del tablero), `SidePanel`, `PiecePreview`, `GameOverlay` (pausa / game over con transición) y `ThemeToggle`.

Algunas decisiones de diseño:

- **El tablero no es reactivo.** El motor se marca con `markRaw` para que Vue no lo envuelva en proxies; el canvas lo lee directamente en cada frame.
- **El bucle corre siempre** mientras la app está montada; el motor ignora `update()` en pausa o tras game over. Así reanudar nunca hace caer la pieza de golpe y no puede quedar un bucle vivo tras perder.
- **El tipo de pieza es también su índice de color**: las formas se rellenan con su propio número (1–13) y esos valores se copian al tablero tal cual.

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

   lockPiece(): merge → resolvePowerUp → clearLines → spawn
   keydown → mover / rotar / soft-drop / hard-drop / pausa
```

Cuando una pieza recién generada ya colisiona al aparecer (`spawn`), el juego pasa a **Game Over**.

---

## Tests

```bash
bun run test        # ejecuta Vitest una vez
bun run test:watch  # modo watch
bun run typecheck   # chequeo de tipos con vue-tsc
```

> Usa `bun run test` y no `bun test`: este último lanza el test runner propio de Bun en lugar de Vitest.

Los tests (`tests/game.test.ts`) cubren el motor: colisiones, rotación y _wall kicks_, caída, pausa, game over, puntuación, niveles y cada power-up. El generador aleatorio se inyecta para que sean deterministas.

---

## Tecnologías

- **Vue 3** (`<script setup>`, composables, `provide`/`inject`, `<Transition>`).
- **TypeScript** en modo estricto, con `vue-tsc` para los componentes.
- **Vite** como servidor de desarrollo y bundler.
- **Vitest** para los tests del motor.
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
│   │   └── game.ts            # Motor del juego (clase Game)
│   ├── render/
│   │   └── canvas.ts          # Dibujo en canvas y textos flotantes
│   ├── composables/
│   │   ├── useGame.ts         # Puente motor ↔ Vue, bucle y teclado
│   │   └── useTheme.ts        # Tema claro / oscuro
│   └── components/            # GameBoard, SidePanel, PiecePreview, GameOverlay, ThemeToggle
├── tests/
│   └── game.test.ts           # Tests del motor (Vitest)
├── vite.config.ts
├── tsconfig.json
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

El tamaño del canvas se calcula a partir de `COLS`, `ROWS` y `BLOCK`, así que no hace falta tocar nada más.

---

## Licencia

Proyecto de uso libre con fines educativos y de práctica.
