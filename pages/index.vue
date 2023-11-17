<script setup>
// import { useStorage } from '@vueuse/core';
import { GamePlay } from '~/assets/logic';

const colorMode = useColorMode();
const date = useState('date', () => new Date());

const isDark = computed({
  get() {
    return colorMode.value === 'dark';
  },
  set() {
    colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark';
  },
});

const label = computed(() =>
  date.value.toLocaleDateString('en-us', {
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
);

const play = new GamePlay(9, 9, 10);

// useStorage('vuesweeper-state', play.state);

const state = computed(() => play.board);

const mineRest = computed(() => {
  if (!play.state.value.mineGenerated) {
    return play.mines;
  }
  return play.blocks.reduce((a, b) => a - (b.flagged ? 1 : 0), play.mines);
  // use filter
  // const unflaggedBlocks = play.blocks.filter((b) => !b.flagged);
  // return play.mines - unflaggedBlocks.length;
});

const difficultyLevels = {
  easy: {
    rows: 9,
    cols: 9,
    mines: 10,
  },
  medium: {
    rows: 16,
    cols: 16,
    mines: 40,
  },
  hard: {
    rows: 16,
    cols: 30,
    mines: 99,
  },
};

const newGame = (difficulty) => {
  const { rows, cols, mines } = difficultyLevels[difficulty];
  play.reset(rows, cols, mines);
};
// const newGame = (difficulty: 'easy' | 'medium' | 'hard') => {
//   switch (difficulty) {
//     case 'easy':
//       play.reset(9, 9, 10);
//       break;
//     case 'medium':
//       play.reset(16, 16, 40);
//       break;
//     case 'hard':
//       play.reset(16, 30, 99);
//       break;
//   }
// };

watchEffect(() => {
  play.checkGameState();
});

play.reset();
</script>

<template>
  <UContainer>
    <UCard>
      <div class="flex justify-between items-center">
        <UButton icon="i-heroicons-calendar-days-20-solid" :label="label" />

        <div>
          <ClientOnly>
            <UButton
              :icon="
                isDark
                  ? 'i-heroicons-moon-20-solid'
                  : 'i-heroicons-sun-20-solid'
              "
              color="gray"
              variant="ghost"
              aria-label="Theme"
              @click="isDark = !isDark"
            >
            </UButton>
          </ClientOnly>
        </div>
      </div>
    </UCard>
    <p class="text-3xl font-serif mt-10">Minesweeper</p>

    <div class="flex gap-1 justify-center p-4">
      <UButton @click="play.reset()">New Game</UButton>
      <UButton @click="newGame('easy')">Easy</UButton>
      <UButton @click="newGame('medium')">Medium</UButton>
      <UButton @click="newGame('hard')">Hard</UButton>
    </div>

    <div class="grid gap-10 place-content-center grid-flow-col">
      <div class="flex gap-1 items-center font-serif">
        mine rest:{{ mineRest }}
      </div>
    </div>

    <div class="p-5 w-full overflow-auto">
      <div
        v-for="(row, y) in state"
        :key="y"
        class="flex items-center justify-center w-max m-auto"
      >
        <MineBlock
          v-for="(block, x) in row"
          :key="x"
          :block="block"
          @click="play.onClick(block)"
          @lrclick="play.autoExpand(block)"
          @contextmenu.prevent="play.onRightClick(block)"
        ></MineBlock>
      </div>
    </div>

    <div v-if="play.state.value.status === 'won'">Congratulations!</div>
  </UContainer>
</template>
