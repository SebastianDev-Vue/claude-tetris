# Carrera contra tu fantasma: diseño

Fecha: 2026-11-06 · Rama: `tetris-fantasma` · Requisito previo: mejora 1 (controles y ajustes), hoy en curso en `tetris-controles`.

## Objetivo

Mientras juegas, tu mejor partida de ese modo se reproduce en directo en un mini tablero, con la diferencia de puntos en tiempo real. Compite por puntos, no con las mismas piezas: los power-ups y recompensas consumen del mismo flujo aleatorio, así que dos partidas con igual semilla se separan pronto.

Fuera de esta versión: ver la repetición completa, compartirla por enlace y comparar por tiempo.

## Fases

1. **Motor** (no depende de la mejora 1): `engine/rng.ts`, `engine/replay.ts`, semilla en `reset()`, nivel base por partida y test de reproducción. Si ese test no se puede poner en verde, se revisa el coste de la mejora antes de seguir.
2. **Integración** (después de unir la mejora 1 a `main` y actualizar esta rama): bucle de pasos fijos, grabación, almacenamiento e interfaz.

## Motor

### Generador con semilla

`engine/rng.ts` exporta `createRng(seed): () => number`, con valores en [0, 1). `Game.reset(mode?, seed?)` sustituye el generador cuando recibe semilla, antes de consumir ningún número. Sigue siendo el único camino de reinicio. Sin semilla mantiene el generador actual, y la opción `random` del constructor se conserva para los tests existentes.

### Nivel base por partida

Hoy el menú de pausa cambia `startLevel` en plena partida y `clearLines()` lo lee, lo que rompe la reproducción y contradice el texto «Se aplica al reiniciar». Se separan dos valores:

- `startLevel`: ajuste para la próxima partida.
- `baseLevel`: copia fijada en `reset()`; es lo que usa `clearLines()` y lo que se graba.

### Reproducción

`engine/replay.ts` exporta:

- `STEP_MS = 1000 / 120` y `REPLAY_VERSION`. La versión cambia cuando cambian las reglas.
- `ReplayAction`: `moveLeft`, `moveRight`, `softDrop`, `rotate`, `hardDrop`, `holdPiece` y `` `useSkill:${SkillId}` ``.
- `Replay`: `version`, `seed`, `mode`, `startLevel`, `score` y `actions`, una lista de `[paso, acción]` en orden.
- `applyAction(game, action)`: el único punto que traduce una acción a un método de `Game`.
- `createReplayer(game, replay)`: prepara la partida con `setStartLevel()` y `reset(mode, seed)`, y devuelve una función `step()`.

Contrato de un paso: **primero se aplican las acciones grabadas con ese número de paso y después `update(STEP_MS)`**. El grabador usa el mismo orden: guarda el contador de pasos actual y aplica la acción, y el contador solo sube con cada `update` real.

La simulación es función exclusiva de semilla, modo, nivel inicial y acciones. DAS, ARR y la asignación de teclas no entran en la grabación, porque se graba la acción resultante y no el estado del teclado.

## Integración

### Bucle (`useGame.frame`)

Orden en cada frame:

1. Cuenta atrás de la mejora 1.
2. Si `isAdvancing()`: `keyRepeat.update(dt, step)`, que graba en el paso actual.
3. Si `isAdvancing()`: `acumulador += dt`, con `dt` ya limitado por `MAX_FRAME_MS`, y luego un paso por cada `STEP_MS` acumulado, avanzando jugador y fantasma. Se corta si el jugador termina a mitad de frame.

Fuera de `isAdvancing()` no suben ni el acumulador ni el contador. La pausa, la cuenta atrás, los menús y el fin de partida detienen a ambos sin lógica nueva. `start()` pone a cero el acumulador y el contador.

**Ritmo de caída.** No puede ser idéntico al actual, que va por frames. El criterio es el intervalo nominal con un paso de tolerancia: `[intervalo, intervalo + STEP_MS]`. A velocidad máxima y 60 Hz, hoy tarda unos 100–117 ms y pasará a unos 100–108 ms.

### Grabación

Todo el input de juego pasa por `act(acción)`: `step()` de la mejora 1, el `switch` de teclas y `useSkill`. Las acciones sin efecto también se graban, porque se reproducen igual.

- `start()` crea la grabación con semilla nueva (`Math.random`, solo en la capa Vue) y `baseLevel`. Sustituirla descarta la anterior, así que reiniciar o salir al menú no necesita más código.
- Se guarda solo en el evento `finish`, con la puntuación final. Las partidas perdidas también cuentan como terminadas.

### Almacenamiento (`composables/useGhosts.ts`)

Clave `tetris-ghosts`: un objeto `{ [modo]: Replay }`, como máximo uno por modo, aparte de los récords.

- Solo se guarda si `score > 0` y supera al guardado de ese modo.
- La carga valida versión igual a `REPLAY_VERSION`, modo coincidente con la clave, `seed` y `score` numéricos, `startLevel` entero 1–10 y acciones `[entero ≥ 0, acción conocida]` con pasos no decrecientes. Una entrada inválida se descarta sin afectar a las demás.
- Los errores de almacenamiento o cuota llena se ignoran, como en `useRecords`.

### Fantasma en partida

- Segunda instancia de `Game` con `markRaw` y sin `onEvent`: sin sonido ni partículas. Se prepara en `start()` con `createReplayer` si hay fantasma para ese modo.
- Si termina antes, `update()` ya no hace nada: su tablero queda fijo y se muestra su puntuación final.
- `Hud`: `hasGhost`, `ghostScore`, `ghostFinished` y `ghostDiff`, sincronizados en `syncHud`.
- Se crea dentro de `useGame`, que ya retira el bucle en `onUnmounted`, así que una recarga de HMR no deja instancias vivas.

### Interfaz

- **`GhostBoard.vue` (nuevo):** usa `onFrame`, `drawBoard` y `ctx.scale` con la skin activa. Debe limpiar el canvas **antes** de escalar, porque el `clearRect` de `drawBoard` usa coordenadas ya transformadas y solo borraría una parte.
- **`render/canvas.ts`:** `shadowBlur` no se escala con la transformación. Los halos de neón y de piezas especiales se multiplican por la escala actual, para que no salgan enormes en el mini tablero. El tablero principal no cambia, porque usa escala 1.
- **`LeftPanel`:** sin fantasma, los controles (siguiendo la configuración de la mejora 1) y el texto «Termina una partida para correr contra tu mejor marca». Con fantasma, el mini tablero en ese mismo hueco. Los controles siguen en el menú de pausa.
- **`SidePanel`:** bajo SCORE, por ejemplo `+1.240 ▲ sobre el fantasma` o `−300 ▼ bajo el fantasma`, con color y también signo y flecha. Con diferencia 0 se muestra `=` en color neutro.

## Decisiones cerradas en este spec

- **Comparar por tiempo:** no. Se compara por puntos en todos los modos. Sprint es el único con objetivo cronometrado, y ahí terminar antes puede dar menos puntos; es una limitación aceptada en esta versión.
- **Mini tablero:** celdas de 12 px (120×240), dentro de los 146 px útiles del panel, en el hueco de los controles y bajo HOLD. El boceto inicial lo situaba encima de HOLD, pero el requisito es no desplazarlo. Si con OBJETIVO visible el panel supera la altura del tablero, se baja a 10 px (100×200).

## Pruebas

**Motor (fase 1)**

- Reproducción en los 6 modos: misma semilla y mismas acciones dan igual tablero, puntuación, líneas, nivel, cola y hold, comparando una partida con `onEvent` y otra sin él.
- El test incluye habilidades y Deshacer. La barra de energía se rellena en el mismo paso en ambas partidas, y se comprueba que Deshacer se aplicó de verdad.
- El test cubre también un nivel inicial distinto de 1.
- Cambiar `startLevel` en plena partida no altera esa partida.
- La caída por gravedad queda dentro de `[intervalo, intervalo + STEP_MS]`.

**Integración (fase 2)**

- Almacenamiento: guarda solo si mejora, datos corruptos, versión incompatible y cuota llena.
- Bucle con rAF simulado: mismos pasos a distintas frecuencias de frame, la pausa no avanza el contador y desmontar cancela el bucle.
- Revisión en el navegador de las 5 skins y del modo Invisible, incluido el tablero fijo cuando el fantasma termina antes.

## Documentación

Al terminar la fase 2 se actualiza `CLAUDE.md`, incluida la regla de subir `REPLAY_VERSION` al cambiar las reglas, y el README.

## Riesgos

- Si la mejora 1 cambia `step()` o `isAdvancing()` antes de unirse, habrá que ajustar los puntos de conexión de la fase 2.
- Una regla que cambie sin subir `REPLAY_VERSION` haría que los fantasmas guardados se desvíen de su puntuación, sin dar error.
