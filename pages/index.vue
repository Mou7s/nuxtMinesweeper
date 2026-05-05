<template>
  <div class="relative w-screen h-screen overflow-hidden font-sans" style="background: var(--board-bg);">
    
    <!-- Floating HUD -->
    <div class="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-3 pointer-events-none">
      
      <!-- Main Control Panel -->
      <div class="hud-panel rounded-2xl px-3 py-2 flex items-center gap-2 pointer-events-auto">
        
        <!-- Score -->
        <div class="hud-stat hud-stat--score">
          <span class="text-yellow-500 text-lg">⭐</span>
          <span class="text-xl font-mono font-extrabold text-gray-800 dark:text-gray-100 tracking-tight">
            {{ String(play.state.value.score || 0).padStart(4, '0') }}
          </span>
        </div>

        <!-- Face Button -->
        <button class="face-btn" @click="resetGame">
          {{ faceEmoji }}
        </button>

        <!-- Flags -->
        <div class="hud-stat hud-stat--flags">
          <span class="text-red-500 text-lg">🚩</span>
          <span class="text-xl font-mono font-extrabold text-gray-800 dark:text-gray-100 tracking-tight">
            {{ String(play.state.value.flags || 0).padStart(3, '0') }}
          </span>
        </div>
      </div>

      <!-- Info Bar -->
      <div class="flex items-center gap-2 pointer-events-auto">
        <!-- Connection Status -->
        <div class="info-pill flex items-center gap-2">
          <span 
            class="conn-dot" 
            :class="play.state.value.connected ? 'conn-dot--online' : 'conn-dot--offline'"
          ></span>
          <span>{{ play.state.value.connected ? 'Online' : 'Connecting...' }}</span>
        </div>

        <!-- Coordinates -->
        <div class="info-pill font-mono flex items-center gap-1">
          📍 {{ play.state.value.cameraX }}, {{ play.state.value.cameraY }}
        </div>

        <!-- Help -->
        <div class="info-pill hidden sm:block">
          Drag to pan · Click to dig · Right-click to flag
        </div>
      </div>
    </div>

    <!-- The Infinite Board -->
    <MineBoard ref="boardRef" :play="play" class="w-full h-full" />

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { GamePlay } from '../assets/logic.js';

const play = new GamePlay();
const boardRef = ref<any>(null);

const faceEmoji = computed(() => {
  const score = play.state.value.score || 0;
  if (score < -20) return '😵';
  if (score < 0) return '😰';
  if (score > 200) return '🤩';
  if (score > 50) return '😎';
  return '😊';
});

onMounted(() => {
  try {
    const saved = localStorage.getItem('minesweeper-camera');
    if (saved && boardRef.value) {
      const { x, y } = JSON.parse(saved);
      boardRef.value.jumpTo(x || 0, y || 0, false);
    }
  } catch(e) {}
});

const resetGame = () => {
  play.respawn();
  
  if (boardRef.value) {
    const rx = Math.floor(Math.random() * 20000) - 10000;
    const ry = Math.floor(Math.random() * 20000) - 10000;
    boardRef.value.jumpTo(rx, ry);
  }
};
</script>
