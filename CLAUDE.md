# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the project

Vite + Vue 3 + TypeScript app scaffolded with the official `bun create vue@latest` (create-vue: `--ts --tsgo --vitest --oxfmt`, ESLint removed in favour of Oxlint only). **Package manager is bun** (user preference; lockfile is `bun.lock`; don't use npm/npx or add a `package-lock.json`).

```bash
bun install
bun run dev              # dev server with HMR (+ Vue DevTools) at http://localhost:5173
bun run test:unit        # Vitest in watch mode; add --run for a single pass
bun run type-check       # vue-tsc --build (TypeScript 7 / tsgo)
bun run lint             # oxlint . --fix
bun run format           # oxfmt src/ (no semicolons, single quotes: .oxfmtrc.json)
bun run build            # type-check + production build into dist/ (run-p)
bun run preview          # serve dist/
```

Don't use `bun test`: it runs bun's own test runner instead of Vitest. Run `format`, `lint`, `type-check` and `test:unit --run` before committing.

Opening `index.html` directly over `file://` doesn't work (ES modules); always go through Vite.

**Dependencies are always kept on their latest versions** (user preference): add with `bun add <pkg>@latest` (writes a `^x.y.z` range), check with `bun outdated`. Intentional exceptions:
- `typescript` is the create-vue `--tsgo` alias to `typescript-native-bridge`, **pinned to a concrete version (never `@latest`)**. It exposes the TS 7 native compiler through a TS-6-compatible API so `vue-tsc` keeps working; it's the path validated by the Vue language-tools maintainer (vuejs/language-tools#5381). Plain `typescript@7` breaks `vue-tsc`. Upgrade by bumping the pinned version (`bun pm view typescript-native-bridge version`). Revisit when TS 7.1 can type-check `.vue` files natively.
- `@types/node` stays on `^24` to match the installed Node 24 and `@tsconfig/node24`.

TS configs follow create-vue: `tsconfig.app.json` (src, `noUncheckedIndexedAccess` on, `@/` alias), `tsconfig.vitest.json` (`src/**/__tests__/*`), `tsconfig.node.json` (config files). Because of `noUncheckedIndexedAccess`, access the board through `Game.cell()` / `Game.setCell()` and iterate shapes with `forEachCell()` instead of raw `board[r][c]`.

## Architecture

Three layers, strictly separated:

- **`src/engine/`: pure TS, no DOM, no Vue, no timers.** `constants.ts` holds the tables; `game.ts` holds the `Game` class with all state and rules. Callers drive it with `update(dt)` once per frame plus input methods (`moveLeft`, `rotate`, `hardDrop`, `togglePause`…), which ignore input themselves when paused or game over. Randomness is injected (`new Game({ random })`) so tests are deterministic. Visual side effects go out as `GameEvent`s through `onEvent` (`popup`, `special` with the piece's board cells). The engine never knows how they're drawn.
- **`src/render/`: canvas drawing only.** `canvas.ts`: `drawBlock()` takes the context and cell size, so the board (`BLOCK`) and previews (`drawPreview`) share it; special pieces get a pulsing glow (`withSpecialGlow`). `effects.ts`: transient visuals. `Effects.handle(event, now)` maps engine events to `PopupLayer` (floating texts) and `ParticleLayer` (sparks, stars, expanding rings; `dt` capped at 50 ms). New animations should be added there, driven by new `GameEvent` variants, not by the engine touching the canvas.
- **Vue (`src/composables`, `src/components`): UI only.** `useGame()` (called once in `App.vue`, shared via `provide(GameKey)` / `useGameContext()`) owns the engine instance, the single `requestAnimationFrame` loop, the keyboard listener and a flat reactive `hud` copy synced every frame. Canvas components subscribe with `onFrame(cb)`.

Key invariants:

- **Never make the engine reactive.** The `Game` instance is `markRaw`; the board is walked every frame and Vue proxies would slow it down. The UI reads the `hud` snapshot, not the engine directly (canvas drawing is the exception: it reads the engine every frame).
- **The rAF loop always runs while mounted**; pause/game over are handled by `Game.update()` returning early. That's why there's no stop/resume logic and why resume never adds the paused time (`lastTime` advances every frame). The loop and keydown listener **must** be torn down in `onUnmounted`, or every HMR reload leaves a duplicate loop running.
- **Piece type doubles as color index.** `PIECES[type]` shapes are filled with their own type; `merge()` copies them into `board`; `drawBlock()` looks them up in `COLORS`. `0` = empty. Extend `PIECES` and `COLORS` together, appending at the end. Current map: 1–7 standard tetrominoes, 8–12 power-ups (1×1, `POWER_FIRST..POWER_LAST`), 13 wildcard/comodín (board-only, `PIECES[13]` is `null`), 14–16 pentominoes (+, U, Y), 17 single (reward after a Tetris), 18 hollow 3×3 (challenge). `specialKind(type)` classifies 14–18. `CELL_ICONS` maps an index to a glyph that `drawBlock()` paints on top.
- **`Game.lockPiece()` is the pipeline every feature hooks into**: `merge()` → `resolvePowerUp()` → `clearLines()` → `spawn()`. `spawn()` refills `next` via `pickNextPiece()`, the single place that decides which piece comes next, with fixed priority: pending reward single (after a Tetris) → pending power-up → hollow (`HOLLOW_CHANCE`) → pentomino (`PENTOMINO_CHANCE`) → standard. Pending flags that don't fire stay pending for the following piece.
- **`Game.reset()` is the only reset path** (constructor and the restart button).
- **Canvas size is derived from constants** in `GameBoard.vue` (`COLS*BLOCK` × `ROWS*BLOCK`); previews from their `cells`/`cellSize` props.
- **Rotation is transpose+reverse, not SRS**, with horizontal kicks `[0, -1, 1, -2, 2]` and no rotation-state tracking.
- **Congelar** is `frozenMs`, only decremented inside `update()`, so pausing preserves it.
- **Speed/scoring curve lives in `clearLines()`**: level every 10 lines, `dropInterval = max(100, 1000 - (level-1)*90)`.
- **Theme**: `useTheme()` sets `data-theme` on `<html>`; the canvas can't read CSS, so `gridColor` is copied from `--grid` whenever the theme changes.

## Conventions

- All user-facing text (UI, README, code comments) is in Spanish.
- Every engine rule change should come with a Vitest test in `src/**/__tests__/*.spec.ts` (engine specs run with `// @vitest-environment node`; the default environment is jsdom).
