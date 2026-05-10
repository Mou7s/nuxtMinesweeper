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

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { initAudio } from '../assets/audio.js';

const props = defineProps<{
  play: any
}>();

type Cell = {
  x: number;
  y: number;
  mine: boolean;
  adjacentMines: number;
  revealed: boolean;
  flagged: boolean;
  ownerColor?: string;
};

const boardRef = ref<HTMLElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);
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

let ctx: CanvasRenderingContext2D | null = null;
let renderFrame: number | null = null;
let dragFrame: number | null = null;
let longPressTimer: ReturnType<typeof setTimeout> | null = null;
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
let touchId1: number | null = null;
let touchId2: number | null = null;
let initialDist = 0;
let initialScale = 1;
let touchStartClientX = 0;
let touchStartClientY = 0;
let longPressFired = false;
let lastCursorEmit = 0;

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

const hiddenCell: Cell = {
  x: 0,
  y: 0,
  mine: false,
  adjacentMines: 0,
  revealed: false,
  flagged: false,
};

const readCssColor = (name: string, fallback: string) => {
  if (!boardRef.value) return fallback;
  return getComputedStyle(boardRef.value).getPropertyValue(name).trim() || fallback;
};

const getVisibleCell = (x: number, y: number) => {
  return (props.play.blocks.get(`${x},${y}`) as Cell | undefined) || hiddenCell;
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

  const dpr = Math.max(1, window.devicePixelRatio || 1);
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
  const canvas = canvasRef.value;
  if (!canvas || !ctx) return;

  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const viewWidth = width.value;
  const viewHeight = height.value;
  const boardBg = readCssColor('--board-bg', '#bfc3cb');
  const gridBg = readCssColor('--grid-bg', '#b0b4bc');
  const cellBg = readCssColor('--cell-bg', '#c8ccd4');
  const revealedBg = readCssColor('--revealed-bg', '#e8ecf0');
  const highlight = readCssColor('--cell-highlight', 'rgba(255,255,255,0.65)');
  const shadow = readCssColor('--cell-shadow', 'rgba(0,0,0,0.25)');
  const isDark = document.documentElement.classList.contains('dark');
  const nums = isDark ? darkNumberColors : numberColors;

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
};

const drawCell = (
  context: CanvasRenderingContext2D,
  cell: Cell,
  x: number,
  y: number,
  cellBg: string,
  revealedBg: string,
  highlight: string,
  shadow: string,
  nums: string[],
) => {
  if (!cell.revealed || cell.flagged) {
    context.fillStyle = cell.flagged ? cellBg : cellBg;
    context.fillRect(x, y, cellSize, cellSize);
    drawRaisedCell(context, x, y, highlight, shadow);

    if (cell.flagged && !cell.revealed) {
      context.font = '20px Inter, Segoe UI Emoji, Apple Color Emoji, sans-serif';
      context.fillText('🚩', x + cellSize / 2, y + cellSize / 2 + 1);
    }
    return;
  }

  if (cell.mine) {
    context.fillStyle = '#dc2626';
    context.fillRect(x, y, cellSize, cellSize);
    context.strokeStyle = 'rgba(0, 0, 0, 0.25)';
    context.strokeRect(x + 0.5, y + 0.5, cellSize - 1, cellSize - 1);
    context.font = '20px Inter, Segoe UI Emoji, Apple Color Emoji, sans-serif';
    context.fillText('💣', x + cellSize / 2, y + cellSize / 2 + 1);
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
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  highlight: string,
  shadow: string,
) => {
  context.fillStyle = highlight;
  context.fillRect(x, y, cellSize, 2);
  context.fillRect(x, y, 2, cellSize);
  context.fillStyle = shadow;
  context.fillRect(x, y + cellSize - 2, cellSize, 2);
  context.fillRect(x + cellSize - 2, y, 2, cellSize);
};

const screenToWorld = (clientX: number, clientY: number) => {
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

const normalizeCamera = (pixX: number, pixY: number, gridX: number, gridY: number) => {
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

const onDragStart = (e: MouseEvent) => {
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

const onDragMove = (e: MouseEvent) => {
  if (!mouseIsDown) return;
  scheduleDrag(e.clientX, e.clientY);
};

const onDragEnd = (e: MouseEvent) => {
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

const onContextMenu = (e: MouseEvent) => {
  if (hasDragged) return;
  const world = screenToWorld(e.clientX, e.clientY);
  if (world) onCellRightClick(world.x, world.y);
};

const onWheel = (e: WheelEvent) => {
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

const applyZoom = (newScale: number, centerX: number, centerY: number) => {
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
  scheduleRender();
};

const onTouchStart = (e: TouchEvent) => {
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

const onTouchMove = (e: TouchEvent) => {
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

const onTouchEnd = (e: TouchEvent) => {
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

const startLongPress = (clientX: number, clientY: number) => {
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

const getTouch = (e: TouchEvent, id: number): Touch | undefined => {
  for (let i = 0; i < e.touches.length; i++) {
    const touch = e.touches[i];
    if (touch && touch.identifier === id) return touch;
  }
  return undefined;
};

const getDist = (t1: Touch, t2: Touch) => {
  return Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
};

const scheduleDrag = (clientX: number, clientY: number) => {
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

const applyDrag = (clientX: number, clientY: number) => {
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
  scheduleRender();
};

const handleLocalMouseMove = (e: MouseEvent) => {
  const world = screenToWorld(e.clientX, e.clientY);
  if (!world) return;

  const now = Date.now();
  if (now - lastCursorEmit > 50) {
    props.play.sendCursor(world.preciseX, world.preciseY);
    lastCursorEmit = now;
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

const onCellClick = (wx: number, wy: number) => {
  if (hasDragged) return;
  initAudio();
  props.play.onClick(props.play.getBlock(wx, wy));
};

const onCellRightClick = (wx: number, wy: number) => {
  if (hasDragged) return;
  initAudio();
  props.play.onRightClick(props.play.getBlock(wx, wy));
};

const onCellLRClick = (wx: number, wy: number) => {
  if (hasDragged) return;
  initAudio();
  props.play.autoExpand(props.play.getBlock(wx, wy));
};

defineExpose({
  jumpTo(x: number, y: number, save = true) {
    gridOffsetX.value = x;
    gridOffsetY.value = y;
    pixelOffsetX.value = 0;
    pixelOffsetY.value = 0;
    props.play.state.value.cameraX = x;
    props.play.state.value.cameraY = y;
    if (save) {
      localStorage.setItem('minesweeper-camera', JSON.stringify({ x, y }));
    }
    scheduleRender();
  },
  getScale() {
    return scale.value;
  },
  setScale(s: number) {
    scale.value = Math.min(Math.max(s, minScale), maxScale);
    scheduleRender();
  }
});

watch([width, height], resizeCanvas);
watch(() => props.play.version.value, scheduleRender);

onMounted(async () => {
  await nextTick();
  resizeCanvas();
});

onBeforeUnmount(() => {
  if (dragFrame !== null) cancelAnimationFrame(dragFrame);
  if (renderFrame !== null) cancelAnimationFrame(renderFrame);
  clearLongPress();
  cleanupMouseListeners();
  cleanupTouchListeners();
});
</script>
