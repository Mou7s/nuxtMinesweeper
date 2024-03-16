<template>
  <UContainer>
    <div class="text-3xl font-serif">
      <p
        class="hover:text-green-500 transition-colors duration-500 ease-in-out inline"
      >
        Minesweeper
      </p>
    </div>

    <div class="flex gap-1 justify-center p-4 items-center">
      <span class="font-serif font-bold bg-none">Reset:</span>
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

<script setup>
import { GamePlay } from '../assets/logic.js';

const state = computed(() => play.board);
const play = new GamePlay();

const mineRest = computed(() => {
  if (!play.state.value.mineGenerated) {
    return play.mines;
  }
  return play.blocks.reduce((a, b) => a - (b.flagged ? 1 : 0), play.mines);
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
    rows: 25,
    cols: 25,
    mines: 99,
  },
};

const newGame = (difficulty) => {
  const { rows, cols, mines } = difficultyLevels[difficulty];
  play.reset(rows, cols, mines);
};

watchEffect(() => {
  play.checkGameState();
});

newGame('easy'); //start game
</script>
