<script setup>
const isDev = ref(false);
defineProps({ block: Object });

const emit = defineEmits(['lrclick']);

function whichButtons(event) {
  if (event.buttons === 3) emit('lrclick', event);
}

const numberColors = [
  'text-transparent',
  'text-blue-500',
  'text-green-500',
  'text-yellow-500',
  'text-orange-500',
  'text-red-500',
  'text-purple-500',
  'text-pink-500',
  'text-teal-500',
];

function getBlockClass(block) {
  if (block.flagged) return 'bg-gray-500 opacity-10';
  if (!block.revealed)
    return 'bg-gray-500 opacity-10 hover:bg-gray-500 opacity-20';

  return block.mine
    ? 'bg-red-500 opacity-50'
    : numberColors[block.adjacentMines];
}
</script>

<template>
  <button
    class="flex items-center justify-center w-8 h-8 border border-neutral-400 opacity-90"
    :class="getBlockClass(block)"
    @mousedown="whichButtons"
  >
    <div v-if="block.flagged">
      <div class="text-red-500">X</div>
    </div>

    <div v-else-if="block.revealed || isDev">
      <div v-if="block.mine">X</div>
      <div v-else class="font-semibold">
        {{ block.adjacentMines }}
      </div>
    </div>
  </button>
</template>
~/assets/types
