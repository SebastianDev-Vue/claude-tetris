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

- **`src/engine/`: pure TS, no DOM, no Vue, no timers.** `constants.ts` holds the tables; `game.ts` holds the `Game` class with all state and rules. Callers drive it with `update(dt)` once per frame plus input methods (`moveLeft`, `rotate`, `hardDrop`, `togglePause`…), which ignore input themselves when paused or game over. Randomness is injected (`new Game({ random })`) so tests are deterministic. Visual side effects go out as `GameEvent`s through `onEvent` (`popup`, `special` with the piece's board cells, `clear` with cleared row indices, combo, T-spin, B2B, perfect clear and points, `lock` (with `vanish` in the Invisible challenge), `garbage`, `finish` with `won`, `skill` with `ok`, `energy-full`, `hold`). The engine never knows how they're drawn.
- **`src/render/`: canvas drawing only.** `canvas.ts`: `drawBlock()` takes the context and cell size, so the board (`BLOCK`) and previews (`drawPreview`) share it; special pieces get a pulsing glow (`withSpecialGlow`). `drawBoard(ctx, game, style, now)` takes a `RenderStyle` (`gridColor`, `retro`); in retro every cell is an 8-bit pixel block (`drawRetroBlock`) colored by `retroColor(type, level)`: `RETRO_PALETTES` has 3 colors per level (cycling every 10), garbage/fixed/wildcard have fixed colors, power-ups/wildcard get a letter from `RETRO_GLYPHS` in `RETRO_FONT` (Press Start 2P, `@fontsource/press-start-2p` imported in `main.ts`); no grid, ghost or glow. `drawBlock`/`drawPreview` take `retroLevel` (0 = normal mode). `effects.ts`: transient visuals; `Effects.draw(ctx, now, tint)` forces one color on every layer (retro passes `retroPalette(level)[0]`). `Effects.handle(event, now)` maps engine events to `PopupLayer` (floating texts) and `ParticleLayer` (sparks, stars, expanding rings; `dt` capped at 50 ms). New animations should be added there, driven by new `GameEvent` variants, not by the engine touching the canvas.
- **`src/audio/sfx.ts`: synthesized Web Audio sounds** driven by the same engine events (`Sfx.handle(event)`). The `AudioContext` is created in `unlock()` on the first keydown (browser autoplay policy); without Web Audio everything is a no-op. `M` toggles mute.
- **Vue (`src/composables`, `src/components`): UI only.** `useGame()` (called once in `App.vue`, shared via `provide(GameKey)` / `useGameContext()`) owns the engine instance, the single `requestAnimationFrame` loop, the keyboard listener and a flat reactive `hud` copy synced every frame. Canvas components subscribe with `onFrame(cb)`.

Key invariants:

- **Never make the engine reactive.** The `Game` instance is `markRaw`; the board is walked every frame and Vue proxies would slow it down. The UI reads the `hud` snapshot, not the engine directly (canvas drawing is the exception: it reads the engine every frame).
- **The rAF loop always runs while mounted**; pause/game over are handled by `Game.update()` returning early. That's why there's no stop/resume logic and why resume never adds the paused time (`lastTime` advances every frame). The loop and keydown listener **must** be torn down in `onUnmounted`, or every HMR reload leaves a duplicate loop running.
- **Piece type doubles as color index.** `PIECES[type]` shapes are filled with their own type; `merge()` copies them into `board`; `drawBlock()` looks them up in `COLORS`. `0` = empty. Extend `PIECES` and `COLORS` together, appending at the end. Current map: 1–7 standard tetrominoes, 8–12 power-ups (1×1, `POWER_FIRST..POWER_LAST`), 13 wildcard/comodín (board-only, `PIECES[13]` is `null`), 14–16 pentominoes (+, U, Y), 17 single (reward after a Tetris), 18 hollow 3×3 (challenge), 19 garbage and 20 fixed block (challenge board-only cells). `specialKind(type)` classifies 14–18. `CELL_ICONS` maps an index to a glyph that `drawBlock()` paints on top.
- **`Game.lockPiece()` is the pipeline every feature hooks into**: `takeSnapshot()` (for Deshacer; hard-drop points are added right after it so undo removes them) → `isTSpin()` (evaluated on the board *before* merging) → `merge()` → `resolvePowerUp()` → `clearLines(tspin)` → `checkChallenge()` → `spawn()`. Upcoming pieces live in `queue` (`QUEUE_SIZE` = 5; `next` is a getter for `queue[0]`). `spawn()` shifts the queue and calls `refillQueue()`, the single place that decides which pieces enter it: a pending reward single (after a Tetris) or, failing that, a pending power-up is `unshift`ed so it becomes the *next* piece; then the end is filled with random pieces: hollow (`HOLLOW_CHANCE`) → pentomino (`PENTOMINO_CHANCE`) → standard. Pending flags that don't fire stay pending for the following piece.
- **Energy and skills live in `engine/skills.ts`** (table `SKILLS`, constants). `clearLines()` calls `addEnergy()` (+10/line, +10 for a Tetris or T-spin with lines, capped at 100, `energy-full` event once). `Game.useSkill(id)` only works with a full bar while playing; it spends the bar only if the skill applied (`skill` event with `ok`). Skills: `peekPieces` (counted down in `spawn()`), `swapPiece()`, `slowMs` (like `frozenMs`, only decremented in `update()`; `effectiveDropInterval` doubles the interval), `undo()` (restores the one-level `Snapshot`; extend `Snapshot`/`takeSnapshot()` when adding state that a lock changes) and Hold extra (resets `holdUsed`; fails if hold is already available). The skill menu (`E`) is UI state `hud.skillMenu`: like the mode menu, `useGame` stops calling `update()` while it's open; the engine is not paused.
- **`Game.reset(mode?)` is the only reset path** (constructor, `start(mode)` from the menu, restart). Without argument it repeats the current mode.
- **Modes / challenges live in `engine/challenges.ts`**: each `Challenge` has `setup` (called in `reset`), `tick` (each `update`), `progress` (panel text), `isWon` and optional `lossReason`. `Game.update()` advances `elapsedMs`, runs `tick` and `checkChallenge()` *before* the drop logic; `lockPiece()` calls `checkChallenge()` after clearing lines and only spawns if the game didn't end. Every game end goes through `finish(won, reason)` (sets `gameOver`, `result`, `endReason`, emits `finish`), including topping out in Marathon. Challenge-specific engine hooks: `addGarbageRow()`, `placeFixedBlocks()`, `rotationReversed` (CCW rotation), `hideLocked` (renderer skips locked cells while playing).
- **The app starts on the mode menu** (`hud.menu`). While the menu is open `useGame` doesn't call `game.update()` and only number keys 1–6 (pick mode) and `M` are handled.
- **Canvas size is derived from constants** in `GameBoard.vue` (`COLS*BLOCK` × `ROWS*BLOCK`); previews from their `cells`/`cellSize` props.
- **Rotation is transpose+reverse, not SRS**, with horizontal kicks `[0, -1, 1, -2, 2]` and no rotation-state tracking.
- **Hold** is `holdPiece()` (`C` only, auto-repeat ignored; Shift is deliberately not bound because 5 presses open Windows Sticky Keys): `swapHold()` stores the current piece (or swaps with the stored one, both back in spawn form; with an empty slot the next queue piece comes in) and sets `holdUsed`, which `spawn()` clears. It goes through `replaceCurrent()` (collision check at spawn + `announceSpecial()`), so it is refused if the incoming piece collides (popup + `hold` event with `ok: false`), and it resets `lastMoveRotate`. Taking a piece from the queue counts down `peekPieces` like `spawn()`. Hold extra also requires `holdFits`. `Snapshot` includes `hold`, and undo gives a fresh turn.
- **Congelar** is `frozenMs` (and Ralentizar `slowMs`), only decremented inside `update()`, so pausing preserves it.
- **Scoring lives in `clearLines()` / `scoreClear()`**: `points = round(base × level × comboMult × (b2b ? 1.5 : 1)) + (perfect ? 3000 × level : 0)`, with `base` from `LINE_SCORES` or `TSPIN_SCORES`. `combo` counts consecutive clearing locks (multiplier = `min(combo, 10)`, a non-clearing lock resets it). `b2b` means the last clearing lock was difficult (Tetris or T-spin with lines); an easy clear breaks it, a non-clearing lock doesn't. Wildcards are removed before scoring so they count toward a perfect clear. Level every 10 lines, `dropInterval = max(100, 1000 - (level-1)*90)`.
- **T-spin = 3-corner rule** on the T's 3×3 box plus `lastMoveRotate`. `rotate()` sets it; `moveLeft/Right` and soft drop clear it; gravity and hard drop keep it. Works without SRS because the T's 3×3 matrix keeps its centre at (x+1, y+1) when rotated.
- **Theme**: `useTheme()` (called once in `App.vue`, shared via `provide(ThemeKey)` / `useThemeContext()`) sets `data-theme` on `<html>`; the canvas can't read CSS, so `gridColor` is copied from `--grid` whenever the theme changes. **Retro mode** is `retro` in the same composable: `data-style="retro"` on `<html>` (its CSS variables are declared after the themes and also match `[data-theme]` so they win over either theme), `R` toggles it from any screen (its own keydown listener, removed in `onUnmounted`), and `toggleTheme()` is a no-op while it's on. `GameBoard` and `PiecePreview` read `retro` every frame; the pixel frame (hard `box-shadow` bands on `#board`) and CRT scanlines (`.board-frame.retro::after`) are CSS.

### Gotchas

- **Vite on Windows may miss appends made from the shell** (e.g. `cat >> file`): the dev server keeps serving the old module and the browser fails with "does not provide an export named …". After appending to a source file from the shell, `touch` it (or edit it with the Edit tool).

## Conventions

- All user-facing text (UI, README, code comments) is in Spanish.
- Every engine rule change should come with a Vitest test in `src/**/__tests__/*.spec.ts` (engine specs run with `// @vitest-environment node`; the default environment is jsdom).
