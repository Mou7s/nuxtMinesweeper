<template>
  <div class="relative w-screen h-screen overflow-hidden font-sans" style="background: var(--board-bg);">
    
    <!-- Floating HUD -->
    <div class="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-3 pointer-events-none">
      
      <!-- Main Control Panel -->
      <div class="hud-panel rounded-2xl px-3 py-2 flex items-center gap-2 pointer-events-auto">
        
        <!-- User Info / Profile -->
        <div 
          class="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl cursor-pointer transition-colors border border-transparent hover:border-gray-200 dark:hover:border-gray-700"
          @click="handleProfileClick"
        >
          <UAvatar 
            v-if="play.user.value"
            :alt="play.user.value.username" 
            size="sm"
            :ui="{ root: 'bg-white ring-2 ring-offset-2 ring-offset-white dark:ring-offset-gray-900' }"
            :style="{ '--tw-ring-color': play.user.value.color }"
          />
          <UIcon v-else name="i-heroicons-user-circle" class="w-8 h-8 text-gray-400" />
          <div class="flex flex-col leading-tight">
            <span class="text-xs font-bold text-gray-800 dark:text-gray-100">
              {{ play.user.value ? play.user.value.username : '未登录' }}
            </span>
            <span v-if="play.user.value" class="text-[10px] text-gray-500 font-mono">
              Score: {{ play.user.value.score }}
            </span>
            <span v-else class="text-[10px] text-blue-500 font-bold">点击登录</span>
          </div>
        </div>

        <div class="w-px h-8 bg-gray-200 dark:bg-gray-700 mx-1"></div>

        <!-- Face Button -->
        <button class="face-btn" @click="resetGame">
          {{ faceEmoji }}
        </button>

        <div class="w-px h-8 bg-gray-200 dark:bg-gray-700 mx-1"></div>

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
        <div class="info-pill flex items-center gap-2">
          <span class="conn-dot" :class="play.state.value.connected ? 'conn-dot--online' : 'conn-dot--offline'"></span>
          <span>{{ play.state.value.connected ? 'Online' : 'Connecting...' }}</span>
        </div>
        <div class="info-pill font-mono flex items-center gap-1">
          📍 {{ play.state.value.cameraX }}, {{ play.state.value.cameraY }}
        </div>
      </div>
    </div>

    <!-- Leaderboard (Floating Right) -->
    <div class="absolute top-4 right-4 z-50 w-48 pointer-events-none hidden md:block">
      <div class="hud-panel rounded-2xl p-3 pointer-events-auto">
        <div class="flex items-center gap-2 mb-3">
          <UIcon name="i-heroicons-trophy" class="text-yellow-500 w-5 h-5" />
          <h3 class="text-sm font-black uppercase tracking-wider text-gray-700 dark:text-gray-300">排行榜</h3>
        </div>
        <div class="space-y-2">
          <div 
            v-for="(p, i) in play.state.value.leaderboard" 
            :key="p.username"
            class="flex items-center justify-between text-xs"
          >
            <div class="flex items-center gap-2 overflow-hidden">
              <span class="font-mono text-gray-400 w-3">{{ i + 1 }}</span>
              <span 
                class="w-2 h-2 rounded-full flex-shrink-0" 
                :style="{ background: p.color }"
              ></span>
              <span class="truncate font-bold text-gray-700 dark:text-gray-200" :title="p.username">
                {{ p.username }}
              </span>
            </div>
            <span class="font-mono font-bold text-blue-600 dark:text-blue-400">{{ p.score }}</span>
          </div>
          <div v-if="!play.state.value.leaderboard.length" class="text-center py-4 text-xs text-gray-400">
            暂无玩家数据
          </div>
        </div>
      </div>
    </div>

    <!-- The Infinite Board -->
    <MineBoard ref="boardRef" :play="play" class="w-full h-full" />

    <!-- Auth Modal -->
    <AuthModal ref="authModal" :play="play" />

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { GamePlay } from '../assets/logic';

const play = new GamePlay();
const boardRef = ref<any>(null);
const authModal = ref<any>(null);

const faceEmoji = computed(() => {
  const score = play.user.value?.score || 0;
  if (score < -20) return '😵';
  if (score < 0) return '😰';
  if (score > 200) return '🤩';
  if (score > 50) return '😎';
  return '😊';
});

const handleProfileClick = () => {
  console.log('Profile clicked! play.user.value:', play.user.value);
  console.log('authModal.value:', authModal.value);
  
  if (!play.user.value) {
    if (!authModal.value) {
      alert('错误：登陆弹窗未就绪 (authModal is null)');
      return;
    }
    authModal.value.open();
  } else {
    if (confirm('是否退出登录？')) {
      play.logout();
    }
  }
};

onMounted(() => {
  try {
    const saved = localStorage.getItem('minesweeper-camera');
    if (saved && boardRef.value) {
      const { x, y } = JSON.parse(saved);
      boardRef.value.jumpTo(x || 0, y || 0, false);
    }
  } catch(e) {}
  
  // 如果没登录，自动弹出登录框
  setTimeout(() => {
    if (!play.user.value) authModal.value.open();
  }, 1000);
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
