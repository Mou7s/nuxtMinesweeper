<template>
  <UContainer>
    <p class="text-3xl font-serif">
      <span class="hover:text-primary-500 Transition"> Minesweeper </span>
    </p>

    <div class="flex justify-center items-center gap-1 p-4 font-serif">
      <UButton @click="newGame('beginner')">Beginner</UButton>
      <UButton @click="newGame('intermediate')">Intermediate</UButton>
      <UButton @click="newGame('expert')">Expert</UButton>
    </div>

    <div>
      <span>Remaining Mines:</span>
      <span class="text-3xl Transition text-green-500 border p-2 m-2">
        {{ remainingMines }}
      </span>
    </div>

    <div class="py-4">
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
    <div v-if="play.state.value.status === 'won'">
      <p>Congratulations!</p>
      <div class="flex justify-between">
        <ConfettiExplosion />
        <ConfettiExplosion />
      </div>
    </div>
  </UContainer>
</template>

<script setup>
import { GamePlay } from '../assets/logic.js';
import '../assets/style.css';
import ConfettiExplosion from 'vue-confetti-explosion';

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
  beginner: {
    rows: 9,
    cols: 9,
    mines: 10,
  },
  intermediate: {
    rows: 16,
    cols: 16,
    mines: 40,
  },
  expert: {
    rows: 16,
    cols: 30,
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

newGame('beginner'); //start game
</script>
