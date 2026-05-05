<template>
  <div 
    ref="boardRef"
    class="relative overflow-hidden select-none touch-none w-full h-full cursor-grab"
    style="background: var(--board-bg);"
    :class="{ 'cursor-grabbing': isDragging }"
    @mousedown.prevent="onDragStart"
  >
    <div 
      class="absolute grid p-0"
      :style="{
        gridTemplateColumns: `repeat(${viewportCols + 2}, var(--cell-size))`,
        gridAutoRows: 'var(--cell-size)',
        gap: 'var(--cell-gap)',
        transform: `translate(${pixelOffsetX - cellTotal}px, ${pixelOffsetY - cellTotal}px)`,
        willChange: 'transform',
        background: 'var(--grid-bg)',
        padding: 'var(--cell-gap)',
      }"
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

const boardRef = ref(null);
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
let startMouseX = 0;
let startMouseY = 0;
let startPixelX = 0;
let startPixelY = 0;
let startGridX = 0;
let startGridY = 0;
let hasDragged = false;
let mouseIsDown = false;

const onDragStart = (e: MouseEvent) => {
  initAudio();
  if (e.button !== 0 && e.button !== 1) return;
  // 不立即设置 isDragging！等鼠标真正移动后再激活，否则 pointer-events:none 会吃掉点击
  mouseIsDown = true;
  hasDragged = false;
  startMouseX = e.clientX;
  startMouseY = e.clientY;
  startPixelX = pixelOffsetX.value;
  startPixelY = pixelOffsetY.value;
  startGridX = gridOffsetX.value;
  startGridY = gridOffsetY.value;

  window.addEventListener('mousemove', onDragMove);
  window.addEventListener('mouseup', onDragEnd);
};

const onDragMove = (e: MouseEvent) => {
  if (!mouseIsDown) return;

  const dx = e.clientX - startMouseX;
  const dy = e.clientY - startMouseY;
  
  if (!hasDragged && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
    hasDragged = true;
    isDragging.value = true; // 只有真正拖拽了才激活 cursor-grabbing + pointer-events:none
  }

  if (!hasDragged) return; // 还没超过阈值，不移动地图

  let newPixX = startPixelX + dx;
  let newPixY = startPixelY + dy;
  let newGridX = startGridX;
  let newGridY = startGridY;

  while (newPixX >= cellTotal) {
    newPixX -= cellTotal;
    newGridX -= 1;
  }
  while (newPixX < 0) {
    newPixX += cellTotal;
    newGridX += 1;
  }

  while (newPixY >= cellTotal) {
    newPixY -= cellTotal;
    newGridY -= 1;
  }
  while (newPixY < 0) {
    newPixY += cellTotal;
    newGridY += 1;
  }

  pixelOffsetX.value = newPixX;
  pixelOffsetY.value = newPixY;
  gridOffsetX.value = newGridX;
  gridOffsetY.value = newGridY;
  
  props.play.state.value.cameraX = newGridX;
  props.play.state.value.cameraY = newGridY;
};

const onDragEnd = () => {
  mouseIsDown = false;
  isDragging.value = false;
  window.removeEventListener('mousemove', onDragMove);
  window.removeEventListener('mouseup', onDragEnd);
  
  props.play.state.value.cameraX = gridOffsetX.value;
  props.play.state.value.cameraY = gridOffsetY.value;
  localStorage.setItem('minesweeper-camera', JSON.stringify({
    x: gridOffsetX.value,
    y: gridOffsetY.value
  }));
  
  setTimeout(() => {
    hasDragged = false;
  }, 50);
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
  }
});
</script>
