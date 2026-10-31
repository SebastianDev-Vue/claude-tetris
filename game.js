'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - azul pálido
  '#ffb74d', // L - orange
  '#ff7043', // 8  power-up: Bomba
  '#fff176', // 9  power-up: Rayo
  '#f06292', // 10 power-up: Tinte
  '#7986cb', // 11 power-up: Gravedad
  '#b3e5fc', // 12 power-up: Congelar
  '#e0e0e0', // 13 comodín (creado por Tinte)
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8]],                                       // Bomba
  [[9]],                                       // Rayo
  [[10]],                                      // Tinte
  [[11]],                                      // Gravedad
  [[12]],                                      // Congelar
  null,                                        // 13 comodín: solo existe en el tablero
];

const LINE_SCORES = [0, 100, 300, 500, 800];

// Power-ups: piezas 1×1 que se consumen al fijarse y aplican un efecto
const POWER_FIRST = 8, POWER_LAST = 12;
const WILDCARD = 13;
const POWER_NAMES = { 8: 'BOMBA', 9: 'RAYO', 10: 'TINTE', 11: 'GRAVEDAD', 12: 'CONGELAR' };
const CELL_ICONS = { 8: '💣', 9: '⚡', 10: '🎨', 11: '⬇', 12: '❄', 13: '★' };
const LINES_PER_POWERUP = 8;
const FREEZE_MS = 5000;
const WILDCARD_SCORE = 50;
const POPUP_MS = 1200;

const isPowerUp = v => v >= POWER_FIRST && v <= POWER_LAST;

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeBtn = document.getElementById('theme-toggle');
const powerupInfoEl = document.getElementById('powerup-info');

let gridColor = '#22222e';

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let linesToPowerUp, pendingPowerUp, frozenMs, popups;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function makePiece(type) {
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function randomPiece() {
  return makePiece(Math.floor(Math.random() * 7) + 1);
}

// Único punto que decide qué pieza entra en la cola
function pickNextPiece() {
  if (pendingPowerUp) {
    pendingPowerUp = false;
    return makePiece(POWER_FIRST + Math.floor(Math.random() * (POWER_LAST - POWER_FIRST + 1)));
  }
  return randomPiece();
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    // Los comodines que queden se eliminan con cualquier limpieza de líneas
    const wild = removeWildcards();
    if (wild) {
      score += wild * WILDCARD_SCORE * level;
      addPopup(`COMODINES +${wild}`, COLORS[WILDCARD]);
    }
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    linesToPowerUp -= cleared;
    if (linesToPowerUp <= 0) {
      linesToPowerUp += LINES_PER_POWERUP;
      pendingPowerUp = true;
    }
    updateHUD();
  }
}

function removeWildcards() {
  let count = 0;
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (board[r][c] === WILDCARD) { board[r][c] = 0; count++; }
  return count;
}

// ---- Power-ups ----

// Se llama tras merge(): consume los bloques especiales de la pieza recién fijada
function resolvePowerUp() {
  for (let r = 0; r < current.shape.length; r++) {
    for (let c = 0; c < current.shape[r].length; c++) {
      const v = current.shape[r][c];
      if (!isPowerUp(v)) continue;
      const x = current.x + c, y = current.y + r;
      board[y][x] = 0;
      applyPowerUp(v, x, y);
      addPopup(POWER_NAMES[v], COLORS[v]);
    }
  }
}

function applyPowerUp(type, x, y) {
  switch (type) {
    case 8: // Bomba: vacía el área 3×3 centrada en el bloque
      for (let r = y - 1; r <= y + 1; r++)
        for (let c = x - 1; c <= x + 1; c++)
          if (r >= 0 && r < ROWS && c >= 0 && c < COLS) board[r][c] = 0;
      break;
    case 9: // Rayo: vacía su fila y su columna
      board[y].fill(0);
      for (let r = 0; r < ROWS; r++) board[r][x] = 0;
      break;
    case 10: { // Tinte: un color entero pasa a comodín
      const color = tintTargetColor(x, y);
      if (!color) break;
      for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++)
          if (board[r][c] === color) board[r][c] = WILDCARD;
      break;
    }
    case 11: // Gravedad: cada columna cae hasta compactar los huecos
      for (let c = 0; c < COLS; c++) {
        const filled = [];
        for (let r = 0; r < ROWS; r++) if (board[r][c]) filled.push(board[r][c]);
        for (let r = ROWS - 1; r >= 0; r--) board[r][c] = filled.length ? filled.pop() : 0;
      }
      break;
    case 12: // Congelar: sin caída automática durante FREEZE_MS
      frozenMs = FREEZE_MS;
      break;
  }
}

// Color del bloque sobre el que cae el Tinte; si no hay, el más abundante del tablero
function tintTargetColor(x, y) {
  const below = y + 1 < ROWS ? board[y + 1][x] : 0;
  if (below && below !== WILDCARD) return below;
  const counts = {};
  let best = 0, bestCount = 0;
  for (const row of board)
    for (const v of row) {
      if (!v || v === WILDCARD) continue;
      counts[v] = (counts[v] || 0) + 1;
      if (counts[v] > bestCount) { best = v; bestCount = counts[v]; }
    }
  return best;
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

// Orden fijo: fijar → efectos de power-up → limpiar líneas → nueva pieza
function lockPiece() {
  merge();
  resolvePowerUp();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = pickNextPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
  updatePowerUpInfo();
}

function updatePowerUpInfo() {
  let text;
  if (frozenMs > 0) text = `❄ ${Math.ceil(frozenMs / 1000)}s`;
  else if (pendingPowerUp || isPowerUp(next.type)) text = '¡listo!';
  else text = `en ${linesToPowerUp} ${linesToPowerUp === 1 ? 'línea' : 'líneas'}`;
  if (powerupInfoEl.textContent !== text) powerupInfoEl.textContent = text;
}

// ---- Popups de texto flotante sobre el tablero ----

function addPopup(text, color) {
  popups.push({ text, color, born: performance.now() });
}

function drawPopups() {
  const now = performance.now();
  popups = popups.filter(p => now - p.born < POPUP_MS);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 22px system-ui, sans-serif';
  popups.forEach((p, i) => {
    const t = (now - p.born) / POPUP_MS;
    ctx.globalAlpha = 1 - t;
    ctx.fillStyle = p.color;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 3;
    const y = canvas.height / 2 - 40 * t + i * 28;
    ctx.strokeText(p.text, canvas.width / 2, y);
    ctx.fillText(p.text, canvas.width / 2, y);
  });
  ctx.restore();
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  // icono de power-up / comodín
  const icon = CELL_ICONS[colorIndex];
  if (icon) {
    context.fillStyle = colorIndex === WILDCARD ? '#f9a825' : '#1a1a25';
    context.font = `${Math.floor(size * 0.6)}px system-ui, sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(icon, x * size + size / 2, y * size + size / 2 + 1);
  }
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);

  drawPopups();
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  // Un frame ya encolado no debe avanzar el juego tras game over o pausa
  if (gameOver || paused) return;
  const dt = ts - lastTime;
  lastTime = ts;
  if (frozenMs > 0) {
    // Congelar: la caída automática no avanza (el jugador sí puede moverse)
    frozenMs = Math.max(0, frozenMs - dt);
    updatePowerUpInfo();
  } else {
    dropAccum += dt;
  }
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  // Si lockPiece() terminó el juego, endGame() canceló el frame actual (ya en
  // ejecución, sin efecto); no hay que encolar otro o el loop sigue para siempre.
  if (gameOver) return;
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  linesToPowerUp = LINES_PER_POWERUP;
  pendingPowerUp = false;
  frozenMs = 0;
  popups = [];
  lastTime = performance.now();
  next = pickNextPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

function applyTheme(theme) {
  const light = theme === 'light';
  document.documentElement.dataset.theme = theme;
  gridColor = getComputedStyle(document.documentElement).getPropertyValue('--grid').trim();
  themeBtn.textContent = light ? 'Modo oscuro' : 'Modo claro';
  themeBtn.setAttribute('aria-label', light ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro');
  themeBtn.setAttribute('aria-pressed', String(light));
  // Redibuja directamente (sin tocar el loop) para que el cambio se vea en pausa o game over
  if (current) { draw(); drawNext(); }
}

themeBtn.addEventListener('click', () => {
  applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
  themeBtn.blur(); // evita que Space reactive el botón
});

applyTheme('dark');

init();
