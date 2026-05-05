<template>
  <button
    :class="cellClass"
    @mousedown="onMouseDown"
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
  if (event.buttons === 3) emit('lrclick', event);
};

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

const numClass = computed(() => {
  if (!props.cell.revealed || props.cell.mine) return '';
  return `mine-num-${props.cell.adjacentMines}`;
});
</script>
