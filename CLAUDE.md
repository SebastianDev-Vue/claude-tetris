# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the project

There is no build step, package manager, linter, or test suite — it's plain HTML/CSS/JS with zero dependencies. Verification is manual, in a browser.

```bash
start index.html        # Windows: open directly, works fine over file://
python3 -m http.server 8000   # or: npx serve .   (optional local server)
```

## Architecture

All game logic lives in `game.js` as one flat, global script (no modules, no exports). Key cross-file and cross-function invariants:

- **Canvas size is not derived from constants.** `game.js` defines `COLS`/`ROWS`/`BLOCK` (10/20/30), but the actual pixel sizes are hardcoded in `index.html`: the board canvas (`300x600`) and the next-piece canvas (`120x120`). If you change `COLS`, `ROWS`, or `BLOCK`, update both canvas elements too — board must be `COLS*BLOCK` × `ROWS*BLOCK`. The next-piece canvas size is independent, driven by the local `NB` constant inside `drawNext()`, not `BLOCK`.
- **Piece type doubles as color index.** `PIECES[type]` shapes are filled with the piece's own type number (1–7); `merge()` copies those values directly into the `board` matrix, and `drawBlock()` looks them up in `COLORS` by that same index. `0` always means an empty cell. Adding a new piece means extending `PIECES` and `COLORS` together, in sync.
- **State is a single global `let` block** (board, current, next, score, lines, level, paused, gameOver, dropInterval, animId, etc.). `init()` is the only reset path — called once at script load and again on restart-button click.
- **Rotation is transpose+reverse, not SRS.** `tryRotate()` rotates via `rotateCW()` then tries a flat horizontal kick offset list `[0, -1, 1, -2, 2]`. There's no per-piece rotation-state tracking, which real SRS kick tables would require.
- **The loop is a `requestAnimationFrame` accumulator** (`loop()`), stepping the piece down when `dropAccum >= dropInterval`. Its handle (`animId`) is touched from three places: `togglePause`, `endGame`, `init`. When resuming from pause, `lastTime` is reset to `performance.now()` first — skipping that makes the accumulated pause time count as elapsed drop time and the piece falls instantly.
- **Two canvases, one draw helper.** `drawBlock()` takes the target context and cell size as parameters, so it's shared between the main board (`ctx`, `BLOCK`) and the next-piece preview (`nextCtx`, `NB`).
- **Speed/scoring curve lives in `clearLines()`**: level increases every 10 lines, and `dropInterval = max(100, 1000 - (level-1)*90)`.

## Gotchas

- When game over happens via natural drop (piece locks → `spawn()` → `endGame()` from inside `loop()`), `endGame()`'s `cancelAnimationFrame(animId)` is a no-op because `animId` is the frame already executing. `loop()` must therefore check `gameOver` itself and not schedule another frame — otherwise the loop runs forever behind the overlay, merging and spawning pieces. `loop()` also returns early if `gameOver || paused` as a guard against stray queued frames.
- All user-facing text (overlay, HTML labels, README) is in Spanish — match that for any new UI strings.
