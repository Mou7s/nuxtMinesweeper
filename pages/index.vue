<template>
  <UContainer>
    <p class="text-3xl font-serif">
      <span class="hover:text-primary-500 Transition"> Minesweeper </span>
    </p>

    <div class="flex justify-center items-center gap-1 p-4">
      <span
        class="Transition hover:text-primary-500 font-serif font-bold bg-none"
      >
        Reset:
      </span>
      <UButton @click="newGame('easy')">Easy</UButton>
      <UButton @click="newGame('medium')">Medium</UButton>
      <UButton @click="newGame('hard')">Hard</UButton>
    </div>

    <div class="grid gap-10 place-content-center grid-flow-col">
      <div class="flex items-center font-serif">
        <span>mine rest:{{ remainingMines }}</span>
      </div>
    </div>

    <div class="p-5 rounded">
      <div
        v-for="(row, y) in state"
        :key="y"
        class="flex items-center justify-center"
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
import '../assets/style.css';

const state = computed(() => play.board);
const play = new GamePlay();

const remainingMines = computed(() => {
  // 如果地雷还没有生成，剩余的地雷数量就是总的地雷数量
  if (!play.state.value.mineGenerated) {
    return play.mines;
  }

  // 如果地雷已经生成，计算剩余的地雷数量
  // 遍历所有的地雷块，如果一个地雷块被标记，就从总的地雷数量中减去 1
  return play.blocks.reduce(
    (total, block) => total - (block.flagged ? 1 : 0),
    play.mines
  );
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
