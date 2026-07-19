<template>
  <div
    ref="boardRef"
    class="relative overflow-hidden select-none w-full h-full cursor-grab"
    style="background: var(--board-bg); touch-action: none;"
    :class="{ 'cursor-grabbing': isDragging }"
    @mousedown.prevent="onDragStart"
    @contextmenu.prevent="onContextMenu"
    @touchstart.passive="onTouchStart"
    @wheel.prevent="onWheel"
    @mousemove="handleLocalMouseMove"
  >
    <canvas ref="canvasRef" class="absolute inset-0 w-full h-full"></canvas>

    <!-- Other Players' Cursors -->
    <div
      class="absolute inset-0 pointer-events-none z-40"
      :style="{ transform: `scale(${scale}) translate(${pixelOffsetX - cellTotal}px, ${pixelOffsetY - cellTotal}px)`, transformOrigin: '0 0' }"
    >
      <div
        v-for="(c, id) in play.state.value.cursors"
        :key="'cursor-'+id"
        class="absolute transition-all duration-100 ease-linear pointer-events-none"
        :style="{
          left: `${(c.x - gridOffsetX + 1) * cellTotal}px`,
          top: `${(c.y - gridOffsetY + 1) * cellTotal}px`,
          zIndex: 100
        }"
      >
        <div class="relative">
          <UIcon
            name="i-heroicons-cursor-arrow-rays"
            class="w-6 h-6 -translate-x-1 -translate-y-1 drop-shadow-lg"
            :style="{ color: c.color }"
          />
          <div
            class="absolute left-4 top-4 px-1.5 py-0.5 rounded-md text-[10px] font-black text-white whitespace-nowrap shadow-sm"
            :style="{ background: c.color }"
          >
            {{ c.username }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { initAudio } from '../assets/audio.js';

const props = defineProps({ play: Object });

const boardRef = ref(null);
const canvasRef = ref(null);
const { width, height } = useElementSize(boardRef);

const cellSize = 38;
const cellGap = 2;
const cellTotal = 40;
const minScale = 0.4;
const maxScale = 2.0;

const viewportCols = computed(() => Math.ceil((width.value / cellTotal) / scale.value) || 20);
const viewportRows = computed(() => Math.ceil((height.value / cellTotal) / scale.value) || 15);

const gridOffsetX = ref(0);
const gridOffsetY = ref(0);
const pixelOffsetX = ref(0);
const pixelOffsetY = ref(0);
const scale = ref(1.0);
const isDragging = ref(false);

let ctx = null;
let renderFrame = null;
let dragFrame = null;
let longPressTimer = null;
let startMouseX = 0;
let startMouseY = 0;
let startPixelX = 0;
let startPixelY = 0;
let startGridX = 0;
let startGridY = 0;
let pendingDragX = 0;
let pendingDragY = 0;
let mouseIsDown = false;
let hasDragged = false;
let touchId1 = null;
let touchId2 = null;
let initialDist = 0;
let initialScale = 1;
let touchStartClientX = 0;
let touchStartClientY = 0;
let longPressFired = false;
let lastCursorEmit = 0;
let lastCursorX = null;
let lastCursorY = null;
let themeObserver = null;
const flagSprites = new Map();
let mineSprite = null;

const numberColors = [
  '',
  '#2563eb',
  '#16a34a',
  '#dc2626',
  '#7c3aed',
  '#b91c1c',
  '#0891b2',
  '#1e1e1e',
  '#6b7280',
];

const darkNumberColors = [
  '',
  '#60a5fa',
  '#4ade80',
  '#f87171',
  '#c084fc',
  '#fb923c',
  '#22d3ee',
  '#e2e8f0',
  '#94a3b8',
];

const hiddenCell = {
  x: 0,
  y: 0,
  mine: false,
  adjacentMines: 0,
  revealed: false,
  flagged: false,
};

let palette = {
  boardBg: '#bfc3cb',
  gridBg: '#b0b4bc',
  cellBg: '#c8ccd4',
  revealedBg: '#e8ecf0',
  highlight: 'rgba(255,255,255,0.65)',
  shadow: 'rgba(0,0,0,0.25)',
  nums: numberColors,
};

const refreshPalette = () => {
  if (!boardRef.value) return;
  const styles = getComputedStyle(boardRef.value);
  const read = (name, fallback) => styles.getPropertyValue(name).trim() || fallback;
  palette = {
    boardBg: read('--board-bg', '#bfc3cb'),
    gridBg: read('--grid-bg', '#b0b4bc'),
    cellBg: read('--cell-bg', '#c8ccd4'),
    revealedBg: read('--revealed-bg', '#e8ecf0'),
    highlight: read('--cell-highlight', 'rgba(255,255,255,0.65)'),
    shadow: read('--cell-shadow', 'rgba(0,0,0,0.25)'),
    nums: document.documentElement.classList.contains('dark') ? darkNumberColors : numberColors,
  };
  scheduleRender();
};

const getVisibleCell = (x, y) => {
  return (props.play.blocks.get(`${x},${y}`)) || hiddenCell;
};

const scheduleRender = () => {
  if (renderFrame !== null) return;

  renderFrame = requestAnimationFrame(() => {
    renderFrame = null;
    drawBoard();
  });
};

const resizeCanvas = () => {
  const canvas = canvasRef.value;
  if (!canvas) return;

  const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
  const nextWidth = Math.max(1, Math.floor(width.value * dpr));
  const nextHeight = Math.max(1, Math.floor(height.value * dpr));

  if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
    canvas.width = nextWidth;
    canvas.height = nextHeight;
  }

  canvas.style.width = `${width.value}px`;
  canvas.style.height = `${height.value}px`;
  ctx = canvas.getContext('2d');
  scheduleRender();
};

const drawBoard = () => {
  const startTime = performance.now();
  const canvas = canvasRef.value;
  if (!canvas || !ctx) return;

  const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
  const viewWidth = width.value;
  const viewHeight = height.value;
  const { boardBg, gridBg, cellBg, revealedBg, highlight, shadow, nums } = palette;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, viewWidth, viewHeight);
  ctx.fillStyle = boardBg;
  ctx.fillRect(0, 0, viewWidth, viewHeight);
  ctx.save();
  ctx.scale(scale.value, scale.value);

  const startX = pixelOffsetX.value - cellTotal;
  const startY = pixelOffsetY.value - cellTotal;
  const cols = viewportCols.value + 2;
  const rows = viewportRows.value + 2;

  ctx.fillStyle = gridBg;
  ctx.fillRect(startX, startY, cols * cellTotal + cellGap, rows * cellTotal + cellGap);

  ctx.font = '800 16px Inter, Segoe UI, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const wx = gridOffsetX.value + col - 1;
      const wy = gridOffsetY.value + row - 1;
      const x = startX + cellGap + col * cellTotal;
      const y = startY + cellGap + row * cellTotal;
      const cell = getVisibleCell(wx, wy);

      drawCell(ctx, cell, x, y, cellBg, revealedBg, highlight, shadow, nums);
    }
  }

  ctx.restore();
  props.play.state.value.perf.drawTime = performance.now() - startTime;
};

const drawCell = (
  context,
  cell,
  x,
  y,
  cellBg,
  revealedBg,
  highlight,
  shadow,
  nums,
) => {
  if (!cell.revealed || cell.flagged) {
    context.fillStyle = cell.flagged ? cellBg : cellBg;
    context.fillRect(x, y, cellSize, cellSize);
    drawRaisedCell(context, x, y, highlight, shadow);

    if (cell.flagged && !cell.revealed) {
      context.drawImage(getFlagSprite(cell.flagOwnerColor || '#ef4444'), x, y, cellSize, cellSize);
    }
    return;
  }

  if (cell.mine) {
    context.fillStyle = '#dc2626';
    context.fillRect(x, y, cellSize, cellSize);
    context.strokeStyle = 'rgba(0, 0, 0, 0.25)';
    context.strokeRect(x + 0.5, y + 0.5, cellSize - 1, cellSize - 1);
    context.drawImage(getMineSprite(), x, y, cellSize, cellSize);
    return;
  }

  context.fillStyle = revealedBg;
  context.fillRect(x, y, cellSize, cellSize);
  context.strokeStyle = 'rgba(0, 0, 0, 0.12)';
  context.strokeRect(x + 0.5, y + 0.5, cellSize - 1, cellSize - 1);

  if (cell.ownerColor) {
    context.fillStyle = cell.ownerColor;
    context.fillRect(x, y + cellSize - 3, cellSize, 3);
  }

  if (cell.adjacentMines > 0) {
    context.font = '800 16px Inter, Segoe UI, system-ui, sans-serif';
    context.fillStyle = nums[cell.adjacentMines] || nums[8];
    context.fillText(String(cell.adjacentMines), x + cellSize / 2, y + cellSize / 2 + 1);
  }
};

const drawRaisedCell = (
  context,
  x,
  y,
  highlight,
  shadow,
) => {
  context.fillStyle = highlight;
  context.fillRect(x, y, cellSize, 2);
  context.fillRect(x, y, 2, cellSize);
  context.fillStyle = shadow;
  context.fillRect(x, y + cellSize - 2, cellSize, 2);
  context.fillRect(x + cellSize - 2, y, 2, cellSize);
};

const createSpriteCanvas = () => {
  const sprite = document.createElement('canvas');
  sprite.width = cellSize * 2;
  sprite.height = cellSize * 2;
  const spriteContext = sprite.getContext('2d');
  spriteContext.scale(2, 2);
  return { sprite, spriteContext };
};

const getFlagSprite = (color) => {
  if (flagSprites.has(color)) return flagSprites.get(color);
  const { sprite, spriteContext } = createSpriteCanvas();
  drawFlagVector(spriteContext, 0, 0, color);
  flagSprites.set(color, sprite);
  return sprite;
};

const getMineSprite = () => {
  if (mineSprite) return mineSprite;
  const created = createSpriteCanvas();
  created.spriteContext.font = '20px Inter, Segoe UI Emoji, Apple Color Emoji, sans-serif';
  created.spriteContext.textAlign = 'center';
  created.spriteContext.textBaseline = 'middle';
  created.spriteContext.fillText('💣', cellSize / 2, cellSize / 2 + 1);
  mineSprite = created.sprite;
  return mineSprite;
};

const drawFlagVector = (
  context,
  x,
  y,
  color,
) => {
  const poleX = x + 14;
  const poleTop = y + 8;
  const poleBottom = y + 28;

  context.save();
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.shadowColor = 'rgba(15, 23, 42, 0.22)';
  context.shadowBlur = 2;
  context.shadowOffsetY = 1;

  context.strokeStyle = '#334155';
  context.lineWidth = 2.5;
  context.beginPath();
  context.moveTo(poleX, poleTop);
  context.lineTo(poleX, poleBottom);
  context.stroke();

  context.fillStyle = color;
  context.beginPath();
  context.moveTo(poleX + 1, poleTop + 1);
  context.lineTo(x + 27, y + 12);
  context.lineTo(poleX + 1, y + 17);
  context.closePath();
  context.fill();

  context.shadowColor = 'transparent';
  context.fillStyle = 'rgba(255, 255, 255, 0.45)';
  context.beginPath();
  context.moveTo(poleX + 3, poleTop + 3);
  context.lineTo(x + 23, y + 12);
  context.lineTo(poleX + 3, y + 14);
  context.closePath();
  context.fill();

  context.fillStyle = '#334155';
  context.fillRect(x + 9, y + 28, 16, 3);
  context.restore();
};

const screenToWorld = (clientX, clientY) => {
  const rect = boardRef.value?.getBoundingClientRect();
  if (!rect) return null;

  const mx = clientX - rect.left;
  const my = clientY - rect.top;
  const col = Math.floor((mx / scale.value - (pixelOffsetX.value - cellTotal) - cellGap) / cellTotal);
  const row = Math.floor((my / scale.value - (pixelOffsetY.value - cellTotal) - cellGap) / cellTotal);

  return {
    x: gridOffsetX.value + col - 1,
    y: gridOffsetY.value + row - 1,
    preciseX: (mx / scale.value - pixelOffsetX.value) / cellTotal + gridOffsetX.value,
    preciseY: (my / scale.value - pixelOffsetY.value) / cellTotal + gridOffsetY.value,
  };
};

const normalizeCamera = (pixX, pixY, gridX, gridY) => {
  let nextPixX = pixX;
  let nextPixY = pixY;
  let nextGridX = gridX;
  let nextGridY = gridY;

  while (nextPixX >= cellTotal) { nextPixX -= cellTotal; nextGridX -= 1; }
  while (nextPixX < 0) { nextPixX += cellTotal; nextGridX += 1; }
  while (nextPixY >= cellTotal) { nextPixY -= cellTotal; nextGridY -= 1; }
  while (nextPixY < 0) { nextPixY += cellTotal; nextGridY += 1; }

  return { pixX: nextPixX, pixY: nextPixY, gridX: nextGridX, gridY: nextGridY };
};

const syncViewport = () => {
  props.play.setViewport(
    gridOffsetX.value - 1,
    gridOffsetY.value - 1,
    viewportCols.value + 2,
    viewportRows.value + 2,
  );
};

const onDragStart = (e) => {
  initAudio();
  if (e.buttons === 3) {
    const world = screenToWorld(e.clientX, e.clientY);
    if (world) onCellLRClick(world.x, world.y);
    return;
  }

  if (e.button !== 0 && e.button !== 1) return;

  mouseIsDown = true;
  hasDragged = false;
  startMouseX = e.clientX;
  startMouseY = e.clientY;
  startPixelX = pixelOffsetX.value;
  startPixelY = pixelOffsetY.value;
  startGridX = gridOffsetX.value;
  startGridY = gridOffsetY.value;

  window.addEventListener('mousemove', onDragMove, { passive: true });
  window.addEventListener('mouseup', onDragEnd);
};

const onDragMove = (e) => {
  if (!mouseIsDown) return;
  scheduleDrag(e.clientX, e.clientY);
};

const onDragEnd = (e) => {
  flushDragFrame();
  mouseIsDown = false;
  isDragging.value = false;
  cleanupMouseListeners();

  if (!hasDragged) {
    const world = screenToWorld(e.clientX, e.clientY);
    if (world) onCellClick(world.x, world.y);
  }

  saveCameraPosition();
  setTimeout(() => { hasDragged = false; }, 50);
};

const cleanupMouseListeners = () => {
  window.removeEventListener('mousemove', onDragMove);
  window.removeEventListener('mouseup', onDragEnd);
};

const onContextMenu = (e) => {
  if (hasDragged) return;
  const world = screenToWorld(e.clientX, e.clientY);
  if (world) onCellRightClick(world.x, world.y);
};

const onWheel = (e) => {
  const zoomSpeed = 0.001;
  const delta = -e.deltaY * zoomSpeed;
  const oldScale = scale.value;
  const newScale = Math.min(Math.max(oldScale + delta, minScale), maxScale);

  if (newScale !== oldScale) {
    const rect = boardRef.value?.getBoundingClientRect();
    if (rect) {
      applyZoom(newScale, e.clientX - rect.left, e.clientY - rect.top);
    }
  }
};

const applyZoom = (newScale, centerX, centerY) => {
  const oldScale = scale.value;
  const dx = (centerX / oldScale) - (centerX / newScale);
  const dy = (centerY / oldScale) - (centerY / newScale);
  const next = normalizeCamera(
    pixelOffsetX.value - dx,
    pixelOffsetY.value - dy,
    gridOffsetX.value,
    gridOffsetY.value,
  );

  scale.value = newScale;
  pixelOffsetX.value = next.pixX;
  pixelOffsetY.value = next.pixY;
  gridOffsetX.value = next.gridX;
  gridOffsetY.value = next.gridY;
  saveCameraPosition();
  syncViewport();
  scheduleRender();
};

const onTouchStart = (e) => {
  initAudio();

  if (e.touches.length === 1) {
    const touch = e.touches[0];
    if (!touch) return;

    touchId1 = touch.identifier;
    touchId2 = null;
    hasDragged = false;
    startMouseX = touch.clientX;
    startMouseY = touch.clientY;
    startPixelX = pixelOffsetX.value;
    startPixelY = pixelOffsetY.value;
    startGridX = gridOffsetX.value;
    startGridY = gridOffsetY.value;
    touchStartClientX = touch.clientX;
    touchStartClientY = touch.clientY;
    startLongPress(touch.clientX, touch.clientY);
  } else if (e.touches.length === 2) {
    clearLongPress();
    const t1 = e.touches[0];
    const t2 = e.touches[1];
    if (!t1 || !t2) return;

    touchId1 = t1.identifier;
    touchId2 = t2.identifier;
    initialDist = getDist(t1, t2);
    initialScale = scale.value;
  }

  window.addEventListener('touchmove', onTouchMove, { passive: false });
  window.addEventListener('touchend', onTouchEnd);
  window.addEventListener('touchcancel', onTouchEnd);
};

const onTouchMove = (e) => {
  if (e.touches.length === 1 && touchId1 !== null && touchId2 === null) {
    const touch = getTouch(e, touchId1);
    if (touch) {
      e.preventDefault();
      scheduleDrag(touch.clientX, touch.clientY);
    }
  } else if (e.touches.length === 2 && touchId1 !== null && touchId2 !== null) {
    e.preventDefault();
    clearLongPress();
    const t1 = getTouch(e, touchId1);
    const t2 = getTouch(e, touchId2);
    if (t1 && t2) {
      const dist = getDist(t1, t2);
      if (initialDist > 0) {
        const factor = dist / initialDist;
        const newScale = Math.min(Math.max(initialScale * factor, minScale), maxScale);

        if (newScale !== scale.value) {
          const rect = boardRef.value?.getBoundingClientRect();
          if (rect) {
            applyZoom(newScale, (t1.clientX + t2.clientX) / 2 - rect.left, (t1.clientY + t2.clientY) / 2 - rect.top);
          }
        }
      }
    }
  }
};

const onTouchEnd = (e) => {
  if (e.touches.length === 0) {
    flushDragFrame();
    const shouldClick = !hasDragged && !longPressFired;
    clearLongPress();
    touchId1 = null;
    touchId2 = null;
    isDragging.value = false;
    cleanupTouchListeners();

    if (shouldClick) {
      const world = screenToWorld(touchStartClientX, touchStartClientY);
      if (world) onCellClick(world.x, world.y);
    }

    saveCameraPosition();
    setTimeout(() => { hasDragged = false; }, 50);
  } else if (e.touches.length === 1) {
    clearLongPress();
    const touch = e.touches[0];
    if (!touch) return;
    touchId1 = touch.identifier;
    touchId2 = null;
    startMouseX = touch.clientX;
    startMouseY = touch.clientY;
    startPixelX = pixelOffsetX.value;
    startPixelY = pixelOffsetY.value;
    startGridX = gridOffsetX.value;
    startGridY = gridOffsetY.value;
    touchStartClientX = touch.clientX;
    touchStartClientY = touch.clientY;
    startLongPress(touch.clientX, touch.clientY);
  }
};

const cleanupTouchListeners = () => {
  window.removeEventListener('touchmove', onTouchMove);
  window.removeEventListener('touchend', onTouchEnd);
  window.removeEventListener('touchcancel', onTouchEnd);
};

const startLongPress = (clientX, clientY) => {
  clearLongPress();
  longPressFired = false;
  longPressTimer = setTimeout(() => {
    if (hasDragged) return;
    longPressFired = true;
    const world = screenToWorld(clientX, clientY);
    if (world) onCellRightClick(world.x, world.y);
    longPressTimer = null;
  }, 400);
};

const clearLongPress = () => {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
};

const getTouch = (e, id) => {
  for (let i = 0; i < e.touches.length; i++) {
    const touch = e.touches[i];
    if (touch && touch.identifier === id) return touch;
  }
  return undefined;
};

const getDist = (t1, t2) => {
  return Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
};

const scheduleDrag = (clientX, clientY) => {
  pendingDragX = clientX;
  pendingDragY = clientY;

  if (dragFrame !== null) return;

  dragFrame = requestAnimationFrame(() => {
    dragFrame = null;
    applyDrag(pendingDragX, pendingDragY);
  });
};

const flushDragFrame = () => {
  if (dragFrame === null) return;

  cancelAnimationFrame(dragFrame);
  dragFrame = null;
  applyDrag(pendingDragX, pendingDragY);
};

const applyDrag = (clientX, clientY) => {
  const dx = (clientX - startMouseX) / scale.value;
  const dy = (clientY - startMouseY) / scale.value;

  if (!hasDragged && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
    clearLongPress();
    hasDragged = true;
    isDragging.value = true;
  }

  if (!hasDragged) return;

  const next = normalizeCamera(startPixelX + dx, startPixelY + dy, startGridX, startGridY);
  pixelOffsetX.value = next.pixX;
  pixelOffsetY.value = next.pixY;
  gridOffsetX.value = next.gridX;
  gridOffsetY.value = next.gridY;
  props.play.state.value.cameraX = next.gridX;
  props.play.state.value.cameraY = next.gridY;
  syncViewport();
  scheduleRender();
};

const handleLocalMouseMove = (e) => {
  const world = screenToWorld(e.clientX, e.clientY);
  if (!world) return;

  const now = Date.now();
  const movedEnough = lastCursorX === null
    || Math.hypot(world.preciseX - lastCursorX, world.preciseY - lastCursorY) >= 0.15;
  if (movedEnough && now - lastCursorEmit >= 120) {
    props.play.sendCursor(world.preciseX, world.preciseY);
    lastCursorEmit = now;
    lastCursorX = world.preciseX;
    lastCursorY = world.preciseY;
  }
};

const saveCameraPosition = () => {
  props.play.state.value.cameraX = gridOffsetX.value;
  props.play.state.value.cameraY = gridOffsetY.value;
  localStorage.setItem('minesweeper-camera', JSON.stringify({
    x: gridOffsetX.value,
    y: gridOffsetY.value
  }));
};

const onCellClick = (wx, wy) => {
  if (hasDragged) return;
  initAudio();
  props.play.onClick(props.play.getBlock(wx, wy));
};

const onCellRightClick = (wx, wy) => {
  if (hasDragged) return;
  initAudio();
  props.play.onRightClick(props.play.getBlock(wx, wy));
};

const onCellLRClick = (wx, wy) => {
  if (hasDragged) return;
  initAudio();
  props.play.autoExpand(props.play.getBlock(wx, wy));
};

defineExpose({
  jumpTo(x, y, save = true) {
    gridOffsetX.value = x;
    gridOffsetY.value = y;
    pixelOffsetX.value = 0;
    pixelOffsetY.value = 0;
    props.play.state.value.cameraX = x;
    props.play.state.value.cameraY = y;
    if (save) {
      localStorage.setItem('minesweeper-camera', JSON.stringify({ x, y }));
    }
    syncViewport();
    scheduleRender();
  },
  getScale() {
    return scale.value;
  },
  setScale(s) {
    scale.value = Math.min(Math.max(s, minScale), maxScale);
    syncViewport();
    scheduleRender();
  }
});

watch([width, height], resizeCanvas);
watch([viewportCols, viewportRows], () => {
  props.play.state.value.perf.visibleCells = (viewportCols.value + 2) * (viewportRows.value + 2);
  syncViewport();
}, { immediate: true });
watch(() => props.play.version.value, scheduleRender);

onMounted(async () => {
  await nextTick();
  refreshPalette();
  resizeCanvas();
  syncViewport();
  themeObserver = new MutationObserver(refreshPalette);
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
});

onBeforeUnmount(() => {
  if (dragFrame !== null) cancelAnimationFrame(dragFrame);
  if (renderFrame !== null) cancelAnimationFrame(renderFrame);
  clearLongPress();
  cleanupMouseListeners();
  cleanupTouchListeners();
  themeObserver?.disconnect();
});
</script>
