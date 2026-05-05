<template>
  <div class="relative w-screen h-screen overflow-hidden bg-gray-200 dark:bg-gray-900 font-sans">
    
    <!-- Floating Header & Controls -->
    <div class="absolute top-6 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-4 pointer-events-none">
      <div class="text-center drop-shadow-md bg-white/60 dark:bg-black/60 backdrop-blur-md px-6 py-2 rounded-full pointer-events-auto border border-white/20 shadow-sm">
        <h1 class="text-3xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-teal-500 dark:from-blue-400 dark:to-teal-300">
          Infinite Minesweeper
        </h1>
      </div>

      <!-- Game Controls & Stats -->
      <div class="flex items-center gap-6 p-2 bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg rounded-2xl shadow-lg border border-gray-100/50 dark:border-gray-800/50 pointer-events-auto">
        
        <!-- Score -->
        <div class="flex items-center gap-2 px-4 py-2 bg-yellow-50/80 dark:bg-yellow-900/30 rounded-xl">
          <UIcon name="i-heroicons-star" class="w-5 h-5 text-yellow-500" />
          <span class="text-xl font-mono font-bold text-gray-700 dark:text-gray-200">
            {{ String(play.state.value.score || 0).padStart(4, '0') }}
          </span>
        </div>

        <UButton 
          color="neutral" 
          variant="ghost" 
          class="rounded-full w-14 h-14 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 transition-transform active:scale-95 shadow-inner"
          @click="resetGame"
        >
          <span class="text-3xl">
            {{ play.state.value.score < 0 ? '😰' : play.state.value.score > 50 ? '😎' : '😊' }}
          </span>
        </UButton>

        <div class="flex items-center gap-2 px-4 py-2 bg-gray-50/80 dark:bg-gray-800/80 rounded-xl">
          <UIcon name="i-heroicons-flag" class="w-5 h-5 text-red-500" />
          <span class="text-xl font-mono font-bold text-gray-700 dark:text-gray-200">
            {{ String(play.state.value.flags || 0).padStart(3, '0') }}
          </span>
        </div>

      </div>
      
      <div class="text-xs font-semibold text-gray-500 dark:text-gray-400 bg-white/50 dark:bg-black/50 px-3 py-1 rounded-full pointer-events-auto backdrop-blur-sm">
        Drag to pan • Left/Right Click to play
      </div>
    </div>

    <!-- The Infinite Board -->
    <MineBoard ref="boardRef" :play="play" class="w-full h-full" />

  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { GamePlay } from '../assets/logic.js';

const play = new GamePlay();
const boardRef = ref(null);

const resetGame = () => {
  // 不再销毁世界，只是让玩家重生
  play.respawn();
  
  if (boardRef.value) {
    // 随机传送寻找新大陆（坐标区间 -10000 到 10000）
    const rx = Math.floor(Math.random() * 20000) - 10000;
    const ry = Math.floor(Math.random() * 20000) - 10000;
    boardRef.value.jumpTo(rx, ry);
  }
};
</script>
