<template>
  <div 
    ref="boardRef"
    class="relative overflow-hidden select-none w-full h-full cursor-grab"
    style="background: var(--board-bg); touch-action: none;"
    :class="{ 'cursor-grabbing': isDragging }"
    @mousedown.prevent="onDragStart"
    @touchstart.passive="onTouchDragStart"
  >
    <div 
      ref="gridRef"
      class="absolute grid p-0"
      :style="gridStyle"
      v-if="viewportCols > 0"
      :key="play.version.value"
    >
      <template v-for="y in (viewportRows + 2)" :key="'row-render-'+y">
        <MineCell 
          v-for="x in (viewportCols + 2)" 
          :key="`cell-${x}-${y}`" 
          :cell="play.getBlock(x + gridOffsetX - 1, y + gridOffsetY - 1)" 
          @click="onCellClick(x + gridOffsetX - 1, y + gridOffsetY - 1)"
          @contextmenu.prevent="onCellRightClick(x + gridOffsetX - 1, y + gridOffsetY - 1)"
          @lrclick="onCellLRClick(x + gridOffsetX - 1, y + gridOffsetY - 1)"
          @longpress="onCellRightClick(x + gridOffsetX - 1, y + gridOffsetY - 1)"
        />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useElementSize } from '@vueuse/core';
import { initAudio } from '../assets/audio.js';

const props = defineProps<{
  play: any
}>();

const boardRef = ref<HTMLElement | null>(null);
const gridRef = ref<HTMLElement | null>(null);
const { width, height } = useElementSize(boardRef);

// Must match CSS var(--cell-size) + var(--cell-gap)
const cellTotal = 40; // 38px + 2px

// Dynamically compute the number of rows and cols to fill the screen
const viewportCols = computed(() => Math.ceil(width.value / cellTotal) || 20);
const viewportRows = computed(() => Math.ceil(height.value / cellTotal) || 15);

// Top-left coordinate of the rendered grid in the infinite world
const gridOffsetX = ref(0);
const gridOffsetY = ref(0);

// Sub-grid pixel offsets for smooth panning
const pixelOffsetX = ref(0);
const pixelOffsetY = ref(0);

const isDragging = ref(false);

// 网格样式：只有 transform 会随拖拽变化，其余静态缓存
const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${viewportCols.value + 2}, var(--cell-size))`,
  gridAutoRows: 'var(--cell-size)',
  gap: 'var(--cell-gap)',
  transform: `translate(${pixelOffsetX.value - cellTotal}px, ${pixelOffsetY.value - cellTotal}px)`,
  willChange: 'transform',
  background: 'var(--grid-bg)',
  padding: 'var(--cell-gap)',
}));

// ── 拖拽状态 ─────────────────────────────────────────────
let startMouseX = 0;
let startMouseY = 0;
let startPixelX = 0;
let startPixelY = 0;
let startGridX = 0;
let startGridY = 0;
let hasDragged = false;
let mouseIsDown = false;

// ── Mouse drag (桌面端) ──────────────────────────────────
const onDragStart = (e: MouseEvent) => {
  initAudio();
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
  applyDrag(e.clientX, e.clientY);
};

const onDragEnd = () => {
  mouseIsDown = false;
  isDragging.value = false;
  window.removeEventListener('mousemove', onDragMove);
  window.removeEventListener('mouseup', onDragEnd);
  saveCameraPosition();
  setTimeout(() => { hasDragged = false; }, 50);
};

// ── Touch drag (触屏端) ──────────────────────────────────
let touchId: number | null = null;

const onTouchDragStart = (e: TouchEvent) => {
  if (touchId !== null) return;
  const touch = e.changedTouches[0];
  if (!touch) return;
  
  initAudio();
  touchId = touch.identifier;
  hasDragged = false;
  startMouseX = touch.clientX;
  startMouseY = touch.clientY;
  startPixelX = pixelOffsetX.value;
  startPixelY = pixelOffsetY.value;
  startGridX = gridOffsetX.value;
  startGridY = gridOffsetY.value;

  window.addEventListener('touchmove', onTouchDragMove, { passive: false });
  window.addEventListener('touchend', onTouchDragEnd);
  window.addEventListener('touchcancel', onTouchDragEnd);
};

const onTouchDragMove = (e: TouchEvent) => {
  const touch = getTouchById(e);
  if (!touch) return;
  e.preventDefault();
  applyDrag(touch.clientX, touch.clientY);
};

const onTouchDragEnd = (e: TouchEvent) => {
  const touch = getTouchById(e);
  if (!touch && touchId !== null) return;
  touchId = null;
  isDragging.value = false;
  window.removeEventListener('touchmove', onTouchDragMove);
  window.removeEventListener('touchend', onTouchDragEnd);
  window.removeEventListener('touchcancel', onTouchDragEnd);
  saveCameraPosition();
  setTimeout(() => { hasDragged = false; }, 50);
};

const getTouchById = (e: TouchEvent): Touch | undefined => {
  for (let i = 0; i < e.changedTouches.length; i++) {
    const touch = e.changedTouches[i];
    if (touch && touch.identifier === touchId) {
      return touch;
    }
  }
  return undefined;
};

// ── 共享拖拽逻辑 ─────────────────────────────────────────
const applyDrag = (clientX: number, clientY: number) => {
  const dx = clientX - startMouseX;
  const dy = clientY - startMouseY;
  
  if (!hasDragged && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
    hasDragged = true;
    isDragging.value = true;
  }

  if (!hasDragged) return;

  let newPixX = startPixelX + dx;
  let newPixY = startPixelY + dy;
  let newGridX = startGridX;
  let newGridY = startGridY;

  while (newPixX >= cellTotal) { newPixX -= cellTotal; newGridX -= 1; }
  while (newPixX < 0) { newPixX += cellTotal; newGridX += 1; }
  while (newPixY >= cellTotal) { newPixY -= cellTotal; newGridY -= 1; }
  while (newPixY < 0) { newPixY += cellTotal; newGridY += 1; }

  // 直接写 ref（Vue 会自动合并到下一帧批量更新）
  pixelOffsetX.value = newPixX;
  pixelOffsetY.value = newPixY;
  gridOffsetX.value = newGridX;
  gridOffsetY.value = newGridY;
  
  props.play.state.value.cameraX = newGridX;
  props.play.state.value.cameraY = newGridY;
};

const saveCameraPosition = () => {
  props.play.state.value.cameraX = gridOffsetX.value;
  props.play.state.value.cameraY = gridOffsetY.value;
  localStorage.setItem('minesweeper-camera', JSON.stringify({
    x: gridOffsetX.value,
    y: gridOffsetY.value
  }));
};

// ── Cell 操作 ────────────────────────────────────────────
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
  }
});
</script>