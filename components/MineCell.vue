<template>
  <button
    :class="cellClass"
    :style="cellStyle"
    @mousedown="onMouseDown"
    @touchstart.prevent="onTouchStart"
    @touchend.prevent="onTouchEnd"
    @touchcancel="onTouchCancel"
  >
    <span v-if="cell.flagged && !cell.revealed" class="text-lg leading-none">🚩</span>
    <span v-else-if="cell.revealed && cell.mine" class="text-lg leading-none">💣</span>
    <span v-else-if="cell.revealed && cell.adjacentMines > 0" :class="numClass" class="leading-none">
      {{ cell.adjacentMines }}
    </span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { initAudio } from '../assets/audio.js';

const props = defineProps<{
  cell: {
    x: number;
    y: number;
    mine: boolean;
    adjacentMines: number;
    revealed: boolean;
    flagged: boolean;
    ownerColor?: string;
  }
}>();

const emit = defineEmits(['lrclick', 'longpress']);

// ── Mouse: 双键同时按下 = 自动展开 ──
const onMouseDown = (event: MouseEvent) => {
  initAudio();
  if (event.buttons === 3) emit('lrclick', event);
};

// ── Touch: 长按 = 插旗 ──
let touchTimer: ReturnType<typeof setTimeout> | null = null;
let touchMoved = false;
let touchStartTime = 0;
const LONG_PRESS_DURATION = 400; // ms

const onTouchStart = (event: TouchEvent) => {
  initAudio();
  touchMoved = false;
  touchStartTime = Date.now();
  
  touchTimer = setTimeout(() => {
    // 长按触发 → 插旗（模拟右键）
    if (!touchMoved) {
      emit('longpress', event);
      touchTimer = null;
    }
  }, LONG_PRESS_DURATION);
};

const onTouchEnd = (event: TouchEvent) => {
  if (touchTimer) {
    clearTimeout(touchTimer);
    touchTimer = null;
    // 短按且未移动 → 由浏览器的 click 事件处理翻开
    // touchstart.prevent 已阻止了默认行为，需要手动触发 click
    if (!touchMoved && Date.now() - touchStartTime < LONG_PRESS_DURATION) {
      (event.target as HTMLElement)?.click();
    }
  }
};

const onTouchCancel = () => {
  if (touchTimer) {
    clearTimeout(touchTimer);
    touchTimer = null;
  }
};

// 暴露给父组件用于标记 touchMoved
const setTouchMoved = () => {
  touchMoved = true;
  if (touchTimer) {
    clearTimeout(touchTimer);
    touchTimer = null;
  }
};

defineExpose({ setTouchMoved });

// ── 样式 ──
const cellClass = computed(() => {
  const base = 'mine-cell';
  
  if (props.cell.flagged && !props.cell.revealed) {
    return `${base} mine-cell--flagged`;
  }
  if (!props.cell.revealed) {
    return `${base} mine-cell--hidden`;
  }
  if (props.cell.mine) {
    return `${base} mine-cell--mine`;
  }
  return `${base} mine-cell--revealed`;
});

const cellStyle = computed(() => {
  if (props.cell.revealed && props.cell.ownerColor && !props.cell.mine) {
    return { borderBottom: `3px solid ${props.cell.ownerColor}` };
  }
  return {};
});

const numClass = computed(() => {
  if (!props.cell.revealed || props.cell.mine) return '';
  return `mine-num-${props.cell.adjacentMines}`;
});
</script>