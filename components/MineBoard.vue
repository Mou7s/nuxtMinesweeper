<template>
  <div 
    ref="boardRef"
    class="relative overflow-hidden bg-gray-300 dark:bg-gray-900 select-none touch-none w-full h-full cursor-grab"
    :class="{ 'cursor-grabbing': isDragging }"
    @mousedown.prevent="onDragStart"
  >
    <div 
      class="absolute grid gap-[1px] bg-gray-400 dark:bg-gray-700 p-[1px]"
      :style="{
        gridTemplateColumns: `repeat(${viewportCols + 2}, 40px)`,
        gridAutoRows: '40px',
        transform: `translate(${pixelOffsetX - 40}px, ${pixelOffsetY - 40}px)`,
      }"
      v-if="viewportCols > 0"
    >
      <template v-for="y in (viewportRows + 2)" :key="'row-render-'+y">
        <MineCell 
          v-for="x in (viewportCols + 2)" 
          :key="`cell-render-${x}-${y}`" 
          :cell="play.getBlock(x + gridOffsetX - 1, y + gridOffsetY - 1)" 
          @click="onCellClick(play.getBlock(x + gridOffsetX - 1, y + gridOffsetY - 1))"
          @contextmenu.prevent="onCellRightClick(play.getBlock(x + gridOffsetX - 1, y + gridOffsetY - 1))"
          @lrclick="onCellLRClick(play.getBlock(x + gridOffsetX - 1, y + gridOffsetY - 1))"
        />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useElementSize } from '@vueuse/core';

const props = defineProps<{
  play: any
}>();

const boardRef = ref(null);
const { width, height } = useElementSize(boardRef);

const CELL_SIZE = 41; // 40px + 1px gap

// Dynamically compute the number of rows and cols to fill the screen
const viewportCols = computed(() => Math.ceil(width.value / CELL_SIZE) || 20);
const viewportRows = computed(() => Math.ceil(height.value / CELL_SIZE) || 15);

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
let hasDragged = false; // Add a flag to detect actual dragging

const onDragStart = (e: MouseEvent) => {
  if (e.button !== 0 && e.button !== 1) return; // Only allow left or middle click to drag
  isDragging.value = true;
  hasDragged = false; // Reset drag flag
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
  if (!isDragging.value) return;

  const dx = e.clientX - startMouseX;
  const dy = e.clientY - startMouseY;
  
  if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
    hasDragged = true; // Mark as dragging if moved more than 3 pixels
  }

  let newPixX = startPixelX + dx;
  let newPixY = startPixelY + dy;
  let newGridX = startGridX;
  let newGridY = startGridY;

  // Resolve pixel offsets into grid coordinates when they exceed cell size
  while (newPixX >= CELL_SIZE) {
    newPixX -= CELL_SIZE;
    newGridX -= 1;
  }
  while (newPixX < 0) {
    newPixX += CELL_SIZE;
    newGridX += 1;
  }

  while (newPixY >= CELL_SIZE) {
    newPixY -= CELL_SIZE;
    newGridY -= 1;
  }
  while (newPixY < 0) {
    newPixY += CELL_SIZE;
    newGridY += 1;
  }

  pixelOffsetX.value = newPixX;
  pixelOffsetY.value = newPixY;
  gridOffsetX.value = newGridX;
  gridOffsetY.value = newGridY;
};

const onDragEnd = () => {
  isDragging.value = false;
  window.removeEventListener('mousemove', onDragMove);
  window.removeEventListener('mouseup', onDragEnd);
  
  // Reset hasDragged flag after a short delay so click events don't fire
  setTimeout(() => {
    hasDragged = false;
  }, 50);
};

const onCellClick = (block: any) => {
  if (hasDragged) return; // Ignore click if we just dragged
  props.play.onClick(block);
};

const onCellRightClick = (block: any) => {
  if (hasDragged) return;
  props.play.onRightClick(block);
};

const onCellLRClick = (block: any) => {
  if (hasDragged) return;
  props.play.autoExpand(block);
};

// Expose jump method for "teleporting" to a new continent
defineExpose({
  jumpTo(x: number, y: number) {
    gridOffsetX.value = x;
    gridOffsetY.value = y;
    pixelOffsetX.value = 0;
    pixelOffsetY.value = 0;
  }
});
</script>
