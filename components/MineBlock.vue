<script setup>
const isDev = ref(false);
defineProps({ block: Object });

const emit = defineEmits(['lrclick']);

function whichButtons(event) {
  if (event.buttons === 3) emit('lrclick', event);
}

const numberColors = [
  'text-transparent',
  'text-green-100',
  'text-green-300',
  'text-green-500',
  'text-green-700',
  'text-green-900',
  'text-blue-500',
  'text-blue-700',
  'text-blue-900',
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
    class="flex items-center justify-center w-8 h-8 border border-gray-400 opacity-90"
    :class="getBlockClass(block)"
    @mousedown="whichButtons"
  >
    <div v-if="block.flagged">
      <div>
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
          aria-label="mine"
        >
          <path
            fill="currentColor"
            d="M23 13v-2h-3.07a7.988 7.988 0 0 0-1.62-3.9l2.19-2.17l-1.43-1.43l-2.17 2.19A7.988 7.988 0 0 0 13 4.07V1h-2v3.07c-1.42.18-2.77.74-3.9 1.62L4.93 3.5L3.5 4.93L5.69 7.1A7.988 7.988 0 0 0 4.07 11H1v2h3.07c.18 1.42.74 2.77 1.62 3.9L3.5 19.07l1.43 1.43l2.17-2.19c1.13.88 2.48 1.44 3.9 1.62V23h2v-3.07c1.42-.18 2.77-.74 3.9-1.62l2.17 2.19l1.43-1.43l-2.19-2.17a7.988 7.988 0 0 0 1.62-3.9zM12 8a4 4 0 0 0-4 4H6a6 6 0 0 1 6-6z"
          />
        </svg>
      </div>
      <div v-else>
        {{ block.adjacentMines }}
      </div>
    </div>
  </button>
</template>
~/assets/types
