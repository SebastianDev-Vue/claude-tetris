# Carrera contra tu fantasma: plan de la fase 2

**Objetivo:** integrar en la app el motor reproducible de la fase 1: bucle de pasos fijos, grabación, almacenamiento y mini tablero.

**Spec:** `docs/superpowers/specs/2026-11-06-carrera-fantasma-design.md`

**Base:** `tetris-fantasma` con `manual-worktrees` unida (mejoras 1 y 3).

**Ejecución:** en esta sesión, a petición del usuario, con TDD y una revisión final.

## Restricciones

- Textos y comentarios en español; bun, nunca npm.
- `format`, `lint`, `type-check` y `test:unit --run` antes de cada commit.
- `Game` siempre con `markRaw`; el motor no conoce DOM ni Vue.
- `Math.random` para la semilla solo en la capa Vue.

## Puntos de atención

Cada uno lleva su test en la tarea indicada.

1. Una acción que llega con la partida parada no se graba: al reproducirla, el fantasma no estaría parado y la aplicaría (tarea 2).
2. `tetris-ghosts` con una entrada corrupta no invalida las demás (tarea 1).
3. La cuota llena conserva el fantasma anterior y no interrumpe la partida (tarea 1).
4. Una partida terminada con hard drop guarda también esa última acción (tarea 2).
5. Terminar a mitad de frame no da pasos de más (tarea 2).

## Tarea 1: almacenamiento

**Crear:** `src/composables/useGhosts.ts`, `src/composables/__tests__/useGhosts.spec.ts`.

**Produce:** `GHOSTS_KEY = 'tetris-ghosts'`, `loadGhost(mode): Replay | null`, `saveGhost(replay): boolean`, `ghostDiffLabel(diff): { text, note, trend: 'ahead' | 'behind' | 'tied' }`.

**Tests:** guarda solo si mejora y con `score > 0`; un fantasma por modo; JSON corrupto; versión incompatible; campos inválidos (modo, nivel, semilla, acción desconocida, pasos decrecientes); entrada mala junto a otra buena; cuota llena; etiquetas `+1.240 ▲`, `−300 ▼` y `=`.

## Tarea 2: bucle, grabación y fantasma

**Modificar:** `src/composables/useGame.ts`, `src/composables/__tests__/useGame.spec.ts`.

**Consume:** `applyAction`, `createReplayer`, `STEP_MS`, `REPLAY_VERSION` y la tarea 1.

**Produce:** `GameContext.ghost: Game`; `Hud.hasGhost`, `ghostScore`, `ghostFinished`, `ghostDiff`.

**Tests:** el tiempo simulado no depende de la frecuencia de frame; la pausa, la cuenta atrás y el menú de habilidades paran a ambos; partida real con teclas y su grabación guardada reproducen la misma puntuación y tablero; reiniciar o ir al menú no guarda; una acción en pausa no se graba; el fantasma va a la par del jugador y queda fijo al terminar; `ghostDiff` correcto; desmontar para el fantasma.

## Tarea 3: interfaz

**Crear:** `src/components/GhostBoard.vue`.

**Modificar:** `src/components/LeftPanel.vue`, `src/components/SidePanel.vue`, `src/render/canvas.ts` y sus specs.

**Valores:** celda de 12 px (120×240); limpiar antes de `ctx.scale`; `shadowBlur` multiplicado por la escala actual; texto «Termina una partida para correr contra tu mejor marca».

**Tests:** el halo se escala; `LeftPanel` muestra controles y texto sin fantasma, y mini tablero con fantasma; `SidePanel` muestra signo y flecha.

## Tarea 4: verificación y documentación

- Revisión en el navegador de las 5 skins y del modo Invisible; altura del panel con OBJETIVO (10 px si no cabe).
- Actualizar `CLAUDE.md` y el README.
- Revisión final de toda la rama.
