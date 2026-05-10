<template>
  <div 
    ref="boardRef"
    class="relative overflow-hidden select-none w-full h-full cursor-grab"
    style="background: var(--board-bg); touch-action: none;"
    :class="{ 'cursor-grabbing': isDragging }"
    @mousedown.prevent="onDragStart"
    @touchstart.passive="onTouchStart"
    @wheel.prevent="onWheel"
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

// Dynamically compute the number of rows and cols to fill the screen (divided by scale)
const viewportCols = computed(() => Math.ceil((width.value / cellTotal) / scale.value) || 20);
const viewportRows = computed(() => Math.ceil((height.value / cellTotal) / scale.value) || 15);

// Top-left coordinate of the rendered grid in the infinite world
const gridOffsetX = ref(0);
const gridOffsetY = ref(0);

// Sub-grid pixel offsets for smooth panning
const pixelOffsetX = ref(0);
const pixelOffsetY = ref(0);

const isDragging = ref(false);
const scale = ref(1.0);
const minScale = 0.4;
const maxScale = 2.0;

// 网格样式：只有 transform 会随拖拽变化，其余静态缓存
const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${viewportCols.value + 2}, var(--cell-size))`,
  gridAutoRows: 'var(--cell-size)',
  gap: 'var(--cell-gap)',
  transform: `scale(${scale.value}) translate(${pixelOffsetX.value - cellTotal}px, ${pixelOffsetY.value - cellTotal}px)`,
  transformOrigin: '0 0',
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

// ── Wheel zoom (桌面端) ───────────────────────────────────
const onWheel = (e: WheelEvent) => {
  const zoomSpeed = 0.001;
  const delta = -e.deltaY * zoomSpeed;
  const oldScale = scale.value;
  const newScale = Math.min(Math.max(oldScale + delta, minScale), maxScale);
  
  if (newScale !== oldScale) {
    const rect = boardRef.value?.getBoundingClientRect();
    if (rect) {
      // 鼠标相对于容器的位置
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      
      applyZoom(newScale, mx, my);
    }
  }
};

const applyZoom = (newScale: number, centerX: number, centerY: number) => {
  const oldScale = scale.value;
  const ratio = newScale / oldScale;

  // 为了让缩放中心点 (centerX, centerY) 保持在同一个世界坐标：
  // 缩放前的偏移补偿 (pixelOffsetX - cellTotal)
  // 缩放后的新偏移需要满足：(new_px - centerX) = (old_px - centerX) * (old_scale / new_scale)
  // 简化逻辑：我们直接通过调整偏移量来对齐
  
  // 1. 计算世界坐标偏移的增量（在当前缩放级别下）
  // 由于我们是 translate * scale，translate 是内部像素
  // 我们需要调整内部像素偏移：new_internal_px = internal_px - (centerX / oldScale - centerX / newScale)
  
  const dx = (centerX / oldScale) - (centerX / newScale);
  const dy = (centerY / oldScale) - (centerY / newScale);

  let newPixX = pixelOffsetX.value - dx;
  let newPixY = pixelOffsetY.value - dy;
  let newGridX = gridOffsetX.value;
  let newGridY = gridOffsetY.value;

  // 标准化偏移量
  while (newPixX >= cellTotal) { newPixX -= cellTotal; newGridX -= 1; }
  while (newPixX < 0) { newPixX += cellTotal; newGridX += 1; }
  while (newPixY >= cellTotal) { newPixY -= cellTotal; newGridY -= 1; }
  while (newPixY < 0) { newPixY += cellTotal; newGridY += 1; }

  scale.value = newScale;
  pixelOffsetX.value = newPixX;
  pixelOffsetY.value = newPixY;
  gridOffsetX.value = newGridX;
  gridOffsetY.value = newGridY;
  
  saveCameraPosition();
};

// ── Touch Handling (触屏端) ──────────────────────────────
let touchId1: number | null = null;
let touchId2: number | null = null;
let initialDist = 0;
let initialScale = 1;

const onTouchStart = (e: TouchEvent) => {
  initAudio();
  if (e.touches.length === 1) {
    // Single touch: Drag
    const touch = e.touches[0];
    touchId1 = touch.identifier;
    touchId2 = null;
    hasDragged = false;
    startMouseX = touch.clientX;
    startMouseY = touch.clientY;
    startPixelX = pixelOffsetX.value;
    startPixelY = pixelOffsetY.value;
    startGridX = gridOffsetX.value;
    startGridY = gridOffsetY.value;
  } else if (e.touches.length === 2) {
    // Multi touch: Pinch
    touchId1 = e.touches[0].identifier;
    touchId2 = e.touches[1].identifier;
    initialDist = getDist(e.touches[0], e.touches[1]);
    initialScale = scale.value;
  }

  window.addEventListener('touchmove', onTouchMove, { passive: false });
  window.addEventListener('touchend', onTouchEnd);
  window.addEventListener('touchcancel', onTouchEnd);
};

const onTouchMove = (e: TouchEvent) => {
  if (e.touches.length === 1 && touchId1 !== null && touchId2 === null) {
    // Single touch move
    const touch = getTouch(e, touchId1);
    if (touch) {
      e.preventDefault();
      applyDrag(touch.clientX, touch.clientY);
    }
  } else if (e.touches.length === 2 && touchId1 !== null && touchId2 !== null) {
    // Pinch move
    e.preventDefault();
    const t1 = getTouch(e, touchId1);
    const t2 = getTouch(e, touchId2);
    if (t1 && t2) {
      const dist = getDist(t1, t2);
      if (initialDist > 0) {
        const factor = dist / initialDist;
        const newScale = Math.min(Math.max(initialScale * factor, minScale), maxScale);
        
        if (newScale !== scale.value) {
          // 双指中心点作为缩放中心
          const rect = boardRef.value?.getBoundingClientRect();
          if (rect) {
            const cx = (t1.clientX + t2.clientX) / 2 - rect.left;
            const cy = (t1.clientY + t2.clientY) / 2 - rect.top;
            applyZoom(newScale, cx, cy);
          }
        }
      }
    }
  }
};

const onTouchEnd = (e: TouchEvent) => {
  if (e.touches.length === 0) {
    touchId1 = null;
    touchId2 = null;
    isDragging.value = false;
    window.removeEventListener('touchmove', onTouchMove);
    window.removeEventListener('touchend', onTouchEnd);
    window.removeEventListener('touchcancel', onTouchEnd);
    saveCameraPosition();
    setTimeout(() => { hasDragged = false; }, 50);
  } else if (e.touches.length === 1) {
    // If one finger remains, reset drag start to that finger's current position
    const touch = e.touches[0];
    touchId1 = touch.identifier;
    touchId2 = null;
    startMouseX = touch.clientX;
    startMouseY = touch.clientY;
    startPixelX = pixelOffsetX.value;
    startPixelY = pixelOffsetY.value;
    startGridX = gridOffsetX.value;
    startGridY = gridOffsetY.value;
  }
};

const getTouch = (e: TouchEvent, id: number): Touch | undefined => {
  for (let i = 0; i < e.touches.length; i++) {
    if (e.touches[i].identifier === id) return e.touches[i];
  }
  return undefined;
};

const getDist = (t1: Touch, t2: Touch) => {
  return Math.sqrt(Math.pow(t1.clientX - t2.clientX, 2) + Math.pow(t1.clientY - t2.clientY, 2));
};

// ── 共享拖拽逻辑 ─────────────────────────────────────────
const applyDrag = (clientX: number, clientY: number) => {
  // 注意：缩放后，屏幕移动 1 像素，对应网格内部移动 1/scale 像素
  const dx = (clientX - startMouseX) / scale.value;
  const dy = (clientY - startMouseY) / scale.value;
  
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
  },
  getScale() {
    return scale.value;
  },
  setScale(s: number) {
    scale.value = Math.min(Math.max(s, minScale), maxScale);
  }
});
</script>