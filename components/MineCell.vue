<template>
  <button
    class="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center font-bold text-lg select-none focus:outline-none"
    :class="[cellClasses, textClass]"
    @mousedown="onMouseDown"
  >
    {{ displayContent }}
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  cell: {
    x: number;
    y: number;
    mine: boolean;
    adjacentMines: number;
    revealed: boolean;
    flagged: boolean;
  }
}>();

const emit = defineEmits(['lrclick']);

const onMouseDown = (event: MouseEvent) => {
  // If both left and right mouse buttons are pressed (buttons === 3)
  if (event.buttons === 3) {
    emit('lrclick', event);
  }
};

const cellClasses = computed(() => {
  if (props.cell.flagged && !props.cell.revealed) {
    return 'bg-gradient-to-br from-gray-100 to-gray-300 dark:from-gray-700 dark:to-gray-800 shadow-[inset_2px_2px_0px_rgba(255,255,255,0.8),inset_-2px_-2px_0px_rgba(0,0,0,0.2)] dark:shadow-[inset_2px_2px_0px_rgba(255,255,255,0.1),inset_-2px_-2px_0px_rgba(0,0,0,0.4)] border border-gray-400 dark:border-gray-900';
  }

  if (!props.cell.revealed) {
    return 'bg-gradient-to-br from-gray-100 to-gray-300 dark:from-gray-700 dark:to-gray-800 hover:brightness-110 shadow-[inset_2px_2px_0px_rgba(255,255,255,0.8),inset_-2px_-2px_0px_rgba(0,0,0,0.2)] dark:shadow-[inset_2px_2px_0px_rgba(255,255,255,0.1),inset_-2px_-2px_0px_rgba(0,0,0,0.4)] border border-gray-400 dark:border-gray-900 active:shadow-none active:bg-gray-200';
  }
  
  if (props.cell.mine) {
    return 'bg-red-500 shadow-[inset_1px_1px_3px_rgba(0,0,0,0.3)] border border-gray-300 dark:border-gray-700';
  }

  return 'bg-gray-50 dark:bg-gray-900 shadow-[inset_1px_1px_2px_rgba(0,0,0,0.1)] border border-gray-300 dark:border-gray-800 text-gray-800 dark:text-gray-200';
});

const displayContent = computed(() => {
  if (!props.cell.revealed) {
    return props.cell.flagged ? '🚩' : '';
  }
  if (props.cell.mine) {
    return '💣';
  }
  return props.cell.adjacentMines > 0 ? props.cell.adjacentMines : '';
});

const numberColors = [
  'text-transparent',
  'text-blue-500 dark:text-blue-400',
  'text-green-600 dark:text-green-400',
  'text-red-500 dark:text-red-400',
  'text-purple-600 dark:text-purple-400',
  'text-orange-600 dark:text-orange-400',
  'text-teal-600 dark:text-teal-400',
  'text-black dark:text-white',
  'text-gray-600 dark:text-gray-400',
];

const textClass = computed(() => {
  if (props.cell.revealed && !props.cell.mine) {
    return numberColors[props.cell.adjacentMines] || '';
  }
  return '';
});
</script>
