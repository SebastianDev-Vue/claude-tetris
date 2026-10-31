# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the project

Vite + Vue 3 + TypeScript app. **Package manager is bun** (user preference; lockfile is `bun.lock`; don't use npm/npx or add a `package-lock.json`).

```bash
bun install
bun run dev         # dev server with HMR at http://localhost:5173
bun run test        # Vitest, engine unit tests (tests/*.test.ts)
bun run typecheck   # vue-tsc --noEmit
bun run build       # typecheck + production build into dist/
bun run preview     # serve dist/
```

Use `bun run test`, **not** `bun test`: the latter runs bun's own test runner instead of Vitest.

Opening `index.html` directly over `file://` no longer works (ES modules); always go through Vite.

**Dependencies are always kept on their latest versions** (user preference). Exception: `typescript` is pinned to the newest 6.x, because the latest `vue-tsc` (Volar) requires `typescript <7` and crashes on TS 7 (`ERR_PACKAGE_PATH_NOT_EXPORTED ./lib/tsc`). Re-check that when upgrading.

## Architecture

Three layers, strictly separated:

- **`src/engine/`: pure TS, no DOM, no Vue, no timers.** `constants.ts` holds the tables; `game.ts` holds the `Game` class with all state and rules. Callers drive it with `update(dt)` once per frame plus input methods (`moveLeft`, `rotate`, `hardDrop`, `togglePause`…), which ignore input themselves when paused or game over. Randomness is injected (`new Game({ random })`) so tests are deterministic. Visual side effects go out as `GameEvent`s through `onEvent` (currently `popup`).
- **`src/render/canvas.ts`: canvas drawing only.** `drawBlock()` takes the context and cell size, so the board (`BLOCK`) and previews (`drawPreview`) share it. `PopupLayer` holds timestamp-based floating texts.
- **Vue (`src/composables`, `src/components`): UI only.** `useGame()` (called once in `App.vue`, shared via `provide(GameKey)` / `useGameContext()`) owns the engine instance, the single `requestAnimationFrame` loop, the keyboard listener and a flat reactive `hud` copy synced every frame. Canvas components subscribe with `onFrame(cb)`.

Key invariants:

- **Never make the engine reactive.** The `Game` instance is `markRaw`; the board is walked every frame and Vue proxies would slow it down. The UI reads the `hud` snapshot, not the engine directly (canvas drawing is the exception: it reads the engine every frame).
- **The rAF loop always runs while mounted**; pause/game over are handled by `Game.update()` returning early. That's why there's no stop/resume logic and why resume never adds the paused time (`lastTime` advances every frame). The loop and keydown listener **must** be torn down in `onUnmounted`, or every HMR reload leaves a duplicate loop running.
- **Piece type doubles as color index.** `PIECES[type]` shapes are filled with their own type; `merge()` copies them into `board`; `drawBlock()` looks them up in `COLORS`. `0` = empty. Extend `PIECES` and `COLORS` together, appending at the end. Current map: 1–7 standard tetrominoes, 8–12 power-ups (1×1, `POWER_FIRST..POWER_LAST`), 13 wildcard/comodín (board-only, `PIECES[13]` is `null`). `CELL_ICONS` maps an index to a glyph that `drawBlock()` paints on top.
- **`Game.lockPiece()` is the pipeline every feature hooks into**: `merge()` → `resolvePowerUp()` → `clearLines()` → `spawn()`. `spawn()` refills `next` via `pickNextPiece()`, the single place that decides which piece comes next.
- **`Game.reset()` is the only reset path** (constructor and the restart button).
- **Canvas size is derived from constants** in `GameBoard.vue` (`COLS*BLOCK` × `ROWS*BLOCK`); previews from their `cells`/`cellSize` props.
- **Rotation is transpose+reverse, not SRS**, with horizontal kicks `[0, -1, 1, -2, 2]` and no rotation-state tracking.
- **Congelar** is `frozenMs`, only decremented inside `update()`, so pausing preserves it.
- **Speed/scoring curve lives in `clearLines()`**: level every 10 lines, `dropInterval = max(100, 1000 - (level-1)*90)`.
- **Theme**: `useTheme()` sets `data-theme` on `<html>`; the canvas can't read CSS, so `gridColor` is copied from `--grid` whenever the theme changes.

## Conventions

- All user-facing text (UI, README, code comments) is in Spanish.
- Every engine rule change should come with a Vitest test in `tests/`.
