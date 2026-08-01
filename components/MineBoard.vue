<template>
  <div ref="viewport" class="finite-board__viewport">
    <div ref="root" class="finite-board" :class="{ 'finite-board--disabled': !play.state.value.run }">
      <canvas
        ref="canvas"
        class="finite-board__canvas"
        aria-label="Minesweeper board"
        @contextmenu.prevent="handleContextMenu"
        @pointerdown="handlePointerDown"
        @pointermove="handlePointerMove"
        @pointerup="handlePointerUp"
        @pointercancel="handlePointerCancel"
      />
      <div v-if="!play.state.value.run" class="finite-board__empty">
        <span class="text-5xl">💣</span>
        <span class="text-sm font-black uppercase tracking-[0.25em]">Choose a challenge</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useElementSize } from '@vueuse/core';
import { initAudio } from '../assets/audio.js';

const props = defineProps({ play: { type: Object, required: true } });
const colorMode = useColorMode();
const viewport = ref(null);
const root = ref(null);
const canvas = ref(null);
const { width, height } = useElementSize(viewport);
const dpr = ref(1);
const boardSize = ref(0);
let context = null;
let renderFrame = null;
let longPressTimer = null;
let pointerStart = null;
let moved = false;
let longPressFired = false;

const lightTheme = {
  background: '#e2e8f0',
  hidden: '#f8fafc',
  hiddenStroke: 'rgba(100, 116, 139, 0.38)',
  revealed: '#dbe4ee',
  revealedStroke: 'rgba(100, 116, 139, 0.24)',
  mine: '#e11d48',
  mineSurface: '#ffe4e6',
  flag: '#e11d48',
  flagPole: '#334155',
  text: ['#1d4ed8', '#15803d', '#be123c', '#6d28d9', '#9f1239', '#0e7490', '#1e293b', '#475569'],
};

const darkTheme = {
  background: '#0f172a',
  hidden: '#1e293b',
  hiddenStroke: 'rgba(148, 163, 184, 0.3)',
  revealed: '#111827',
  revealedStroke: 'rgba(148, 163, 184, 0.2)',
  mine: '#fb7185',
  mineSurface: '#4c0519',
  flag: '#fb7185',
  flagPole: '#cbd5e1',
  text: ['#60a5fa', '#4ade80', '#fb7185', '#c084fc', '#fb923c', '#22d3ee', '#e2e8f0', '#94a3b8'],
};

const colors = computed(() => {
  if (colorMode.value === 'dark') return darkTheme;
  if (colorMode.value === 'light') return lightTheme;
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? darkTheme
    : lightTheme;
});

const scheduleRender = () => {
  if (renderFrame !== null) return;
  renderFrame = requestAnimationFrame(() => {
    renderFrame = null;
    draw();
  });
};

const resize = () => {
  const element = canvas.value;
  const board = root.value;
  if (!element || !board) return;
  const challenge = props.play.state.value.challenge || props.play.state.value.run;
  const rows = challenge?.rows || 16;
  const cols = challenge?.cols || 16;
  const availableWidth = Math.max(0, width.value);
  const availableHeight = Math.max(0, height.value);
  if (!availableWidth || !availableHeight) return;
  boardSize.value = Math.floor(Math.min(availableWidth, availableHeight, 620));
  board.style.width = `${boardSize.value}px`;
  board.style.height = `${boardSize.value}px`;
  dpr.value = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
  element.width = Math.floor(boardSize.value * dpr.value);
  element.height = Math.floor(boardSize.value * dpr.value);
  element.dataset.rows = rows;
  element.dataset.cols = cols;
  context = element.getContext('2d');
  scheduleRender();
};

const draw = () => {
  if (!context || !boardSize.value) return;
  const run = props.play.state.value.run;
  const rows = run?.rows || 16;
  const cols = run?.cols || 16;
  const cellSize = boardSize.value / cols;
  context.setTransform(dpr.value, 0, 0, dpr.value, 0, 0);
  context.clearRect(0, 0, boardSize.value, boardSize.value);
  const theme = colors.value;
  context.fillStyle = theme.background;
  context.fillRect(0, 0, boardSize.value, boardSize.value);

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const cell = props.play.getCell(x, y);
      drawCell(cell, x * cellSize, y * cellSize, cellSize);
    }
  }
};

const drawCell = (cell, x, y, size) => {
  const theme = colors.value;
  const gap = Math.max(1, size * 0.035);
  const cellX = x + gap / 2;
  const cellY = y + gap / 2;
  const cellSize = size - gap;
  context.save();
  if (!cell.revealed) {
    context.fillStyle = theme.hidden;
    context.fillRect(cellX, cellY, cellSize, cellSize);
    context.fill();
    context.strokeStyle = theme.hiddenStroke;
    context.lineWidth = Math.max(1, size * 0.025);
    context.strokeRect(cellX, cellY, cellSize, cellSize);
    if (cell.flagged) drawFlag(x, y, size);
  } else if (cell.mine) {
    context.fillStyle = theme.mineSurface;
    context.fillRect(cellX, cellY, cellSize, cellSize);
    context.strokeStyle = theme.mine;
    context.lineWidth = Math.max(1, size * 0.025);
    context.strokeRect(cellX, cellY, cellSize, cellSize);
    drawMine(x, y, size);
  } else {
    context.fillStyle = theme.revealed;
    context.fillRect(cellX, cellY, cellSize, cellSize);
    context.strokeStyle = theme.revealedStroke;
    context.lineWidth = Math.max(1, size * 0.02);
    context.strokeRect(cellX, cellY, cellSize, cellSize);
    if (cell.adjacentMines > 0) {
      context.fillStyle = theme.text[cell.adjacentMines - 1] || theme.text[7];
      context.font = `800 ${Math.max(10, size * 0.48)}px Inter, system-ui, sans-serif`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(String(cell.adjacentMines), x + size / 2, y + size / 2);
    }
  }
  context.restore();
};

const drawMine = (x, y, size) => {
  const theme = colors.value;
  const centerX = x + size / 2;
  const centerY = y + size / 2;
  const radius = size * 0.2;
  context.save();
  context.strokeStyle = theme.mine;
  context.fillStyle = theme.mine;
  context.lineWidth = Math.max(1.5, size * 0.055);
  for (let angle = 0; angle < Math.PI; angle += Math.PI / 4) {
    context.beginPath();
    context.moveTo(centerX + Math.cos(angle) * size * 0.24, centerY + Math.sin(angle) * size * 0.24);
    context.lineTo(centerX + Math.cos(angle) * size * 0.34, centerY + Math.sin(angle) * size * 0.34);
    context.stroke();
  }
  context.beginPath();
  context.arc(centerX, centerY, radius, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = 'rgba(255, 255, 255, 0.72)';
  context.beginPath();
  context.arc(centerX - radius * 0.32, centerY - radius * 0.32, radius * 0.25, 0, Math.PI * 2);
  context.fill();
  context.restore();
};

const drawFlag = (x, y, size) => {
  const theme = colors.value;
  context.save();
  const centerX = x + size / 2;
  const top = y + size * 0.24;
  context.strokeStyle = theme.flagPole;
  context.lineWidth = Math.max(1.5, size * 0.07);
  context.beginPath();
  context.moveTo(centerX, top);
  context.lineTo(centerX, y + size * 0.77);
  context.stroke();
  context.fillStyle = theme.flag;
  context.beginPath();
  context.moveTo(centerX, top);
  context.lineTo(x + size * 0.78, y + size * 0.39);
  context.lineTo(centerX, y + size * 0.52);
  context.closePath();
  context.fill();
  context.fillRect(x + size * 0.25, y + size * 0.75, size * 0.5, Math.max(2, size * 0.07));
  context.restore();
};

const cellAt = (event) => {
  const rect = canvas.value?.getBoundingClientRect();
  const run = props.play.state.value.run;
  if (!rect || !run || !boardSize.value) return null;
  const x = Math.floor(((event.clientX - rect.left) / rect.width) * run.cols);
  const y = Math.floor(((event.clientY - rect.top) / rect.height) * run.rows);
  if (x < 0 || x >= run.cols || y < 0 || y >= run.rows) return null;
  return props.play.getCell(x, y);
};

const clearLongPress = () => {
  if (longPressTimer) clearTimeout(longPressTimer);
  longPressTimer = null;
};

const handlePointerDown = (event) => {
  initAudio();
  pointerStart = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
  moved = false;
  longPressFired = false;
  canvas.value?.setPointerCapture?.(event.pointerId);
  if (event.pointerType === 'touch') {
    longPressTimer = setTimeout(() => {
      if (!moved) {
        longPressFired = true;
        const cell = cellAt(event);
        if (cell) props.play.onRightClick(cell);
      }
    }, 450);
  }
};

const handlePointerMove = (event) => {
  if (!pointerStart) return;
  if (Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 8) {
    moved = true;
    clearLongPress();
  }
};

const handlePointerUp = (event) => {
  if (!pointerStart) return;
  clearLongPress();
  const wasMoved = moved;
  const wasLongPress = longPressFired;
  pointerStart = null;
  moved = false;
  if (wasMoved || wasLongPress) return;
  const cell = cellAt(event);
  if (!cell) return;
  if (event.button === 2) props.play.onRightClick(cell);
  else props.play.onClick(cell);
};

const handlePointerCancel = () => {
  clearLongPress();
  pointerStart = null;
  moved = false;
};

const handleContextMenu = (event) => {
  event.preventDefault();
};

watch([width, height], resize);
watch(() => props.play.version.value, scheduleRender);
watch(() => colorMode.value, scheduleRender);
watch(() => props.play.state.value.run, async () => {
  await nextTick();
  resize();
}, { deep: true });

onMounted(async () => {
  await nextTick();
  resize();
});

onBeforeUnmount(() => {
  clearLongPress();
  if (renderFrame !== null) cancelAnimationFrame(renderFrame);
});
</script>
