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
      <div class="text-red-500">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          aria-label="mine"
        >
          <path
            fill="currentColor"
            d="M23 13v-2h-3.07a7.988 7.988 0 0 0-1.62-3.9l2.19-2.17l-1.43-1.43l-2.17 2.19A7.988 7.988 0 0 0 13 4.07V1h-2v3.07c-1.42.18-2.77.74-3.9 1.62L4.93 3.5L3.5 4.93L5.69 7.1A7.988 7.988 0 0 0 4.07 11H1v2h3.07c.18 1.42.74 2.77 1.62 3.9L3.5 19.07l1.43 1.43l2.17-2.19c1.13.88 2.48 1.44 3.9 1.62V23h2v-3.07c1.42-.18 2.77-.74 3.9-1.62l2.17 2.19l1.43-1.43l-2.19-2.17a7.988 7.988 0 0 0 1.62-3.9zM12 8a4 4 0 0 0-4 4H6a6 6 0 0 1 6-6z"
          />
        </svg>
      </div>
    </div>

    <div v-else-if="block.revealed || isDev">
      <div v-if="block.mine">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          aria-label="creeperMine"
        >
          <path
            fill="currentColor"
            d="M4 2h16a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2m2 4v4h4v2H8v6h2v-2h4v2h2v-6h-2v-2h4V6h-4v4h-4V6z"
          />
        </svg>
      </div>
      <div v-else class="font-semibold">
        {{ block.adjacentMines }}
      </div>
    </div>
  </button>
</template>
~/assets/types
