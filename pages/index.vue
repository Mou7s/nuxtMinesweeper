<script setup lang="ts">
import { useStorage } from '@vueuse/core';
import { GamePlay } from '~/composables/logic';
import '@material/web/all';

const play = new GamePlay(9, 9, 10);

const now = useNow();
const timerMS = computed(() =>
  Math.round(
    ((play.state.value.endMS ?? +now) - (play.state.value.startMS ?? +now)) /
      1000
  )
);

useStorage('vuesweeper-state', play.state);
const state = computed(() => play.board);

const mineRest = computed(() => {
  if (!play.state.value.mineGenerated) return play.mines;
  return play.blocks.reduce((a, b) => a - (b.flagged ? 1 : 0), play.mines);
});

function newGame(difficulty: 'easy' | 'medium' | 'hard') {
  switch (difficulty) {
    case 'easy':
      play.reset(9, 9, 10);
      break;
    case 'medium':
      play.reset(16, 16, 40);
      break;
    case 'hard':
      play.reset(16, 30, 99);
      break;
  }
}

watchEffect(() => {
  play.checkGameState();
});
</script>

<template>
  <div>
    Minesweeper

    <div class="flex gap-1 justify-center p-4">
      <button @click="play.reset()">
        <md-elevated-button>New Game</md-elevated-button>
      </button>
      <button @click="newGame('easy')">
        <md-elevated-button>Easy</md-elevated-button>
      </button>
      <button @click="newGame('medium')">
        <md-elevated-button>Medium</md-elevated-button>
      </button>
      <button @click="newGame('hard')">
        <md-elevated-button>Hard</md-elevated-button>
      </button>
    </div>

    <div class="grid gap-10 place-content-center grid-flow-col">
      <!-- <div class=" text-2xl flex gap-1 items-center">
        <div>time:{{ timerMS }}</div>
      </div> -->

      <div class="flex gap-1 items-center">mine rest:{{ mineRest }}</div>
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
    <Footer></Footer>
  </div>
</template>
