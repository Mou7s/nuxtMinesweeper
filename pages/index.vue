<template>
  <div class="relative w-screen h-screen overflow-hidden font-sans bg-slate-200 dark:bg-slate-950">
    <!-- Subtle Background Gradient for Glass Effect -->
    <div class="absolute inset-0 pointer-events-none opacity-50 dark:opacity-20" 
         style="background: radial-gradient(circle at 50% 50%, #3b82f6 0%, transparent 60%);"></div>

    <!-- Floating HUD -->
    <div class="absolute top-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-4 pointer-events-none">
      
      <!-- Main Control Panel -->
      <div class="hud-panel rounded-3xl px-4 py-2.5 flex items-center gap-3 pointer-events-auto shadow-2xl">
        
        <!-- User Info / Profile -->
        <div 
          class="flex items-center gap-3 px-3 py-1.5 hover:bg-white/20 dark:hover:bg-white/5 rounded-2xl cursor-pointer transition-all border border-transparent hover:border-white/30"
          @click="handleProfileClick"
        >
          <UAvatar 
            v-if="play.user.value"
            :alt="play.user.value.username" 
            size="md"
            class="ring-2 ring-white/50"
            :style="{ background: play.user.value.color }"
          />
          <UIcon v-else name="i-heroicons-user-circle" class="w-9 h-9 text-gray-500" />
          <div class="flex flex-col">
            <span class="text-sm font-black text-gray-800 dark:text-gray-100 tracking-tight">
              {{ play.user.value ? play.user.value.username : 'Guest Player' }}
            </span>
            <span v-if="play.user.value" class="text-[11px] text-blue-600 dark:text-blue-400 font-black uppercase tracking-widest">
              Score: {{ play.user.value.score }}
            </span>
            <span v-else class="text-[10px] text-blue-500 font-bold">CLICK TO LOGIN</span>
          </div>
        </div>

        <div class="w-px h-10 bg-gray-300/50 dark:bg-gray-700/50 mx-1"></div>

        <!-- Face Button -->
        <button class="face-btn" @click="resetGame">
          {{ faceEmoji }}
        </button>

        <div class="w-px h-10 bg-gray-300/50 dark:bg-gray-700/50 mx-1"></div>

        <!-- Flags -->
        <div class="hud-stat hud-stat--flags px-4 py-2">
          <span class="text-xl">🚩</span>
          <span class="text-2xl font-mono font-black text-gray-800 dark:text-gray-100 tracking-tighter">
            {{ String(play.state.value.flags || 0).padStart(3, '0') }}
          </span>
        </div>
      </div>

      <!-- Info Bar -->
      <div class="flex items-center gap-3 pointer-events-auto">
        <div class="info-pill flex items-center gap-2.5 shadow-lg">
          <span class="conn-dot" :class="play.state.value.connected ? 'conn-dot--online' : 'conn-dot--offline'"></span>
          <span class="tracking-widest uppercase">{{ play.state.value.connected ? 'Online' : 'Reconnecting' }}</span>
        </div>
        <UPopover :popper="{ placement: 'bottom', offset: 12 }">
          <div 
            class="info-pill font-mono flex items-center gap-2 cursor-pointer hover:bg-white/60 dark:hover:bg-white/10 transition-all shadow-lg active:scale-95"
            @click="syncTeleportCoords"
          >
            <UIcon name="i-heroicons-map-pin" class="w-3.5 h-3.5 text-blue-500" />
            <span>{{ play.state.value.cameraX }}, {{ play.state.value.cameraY }}</span>
          </div>
          
          <template #content>
            <div class="hud-panel p-6 rounded-3xl w-64 flex flex-col gap-5 border-white/40 dark:border-white/10 shadow-3xl">
              <div class="flex items-center gap-2 mb-1">
                <UIcon name="i-heroicons-paper-airplane" class="text-blue-500 w-5 h-5" />
                <h4 class="text-xs font-black uppercase tracking-[0.2em] text-gray-500">Teleport</h4>
              </div>
              
              <div class="grid grid-cols-2 gap-3">
                <div class="space-y-1.5">
                  <span class="text-[9px] font-black text-gray-400 uppercase ml-1">Axis X</span>
                  <UInput v-model.number="teleportX" placeholder="0" size="md" class="font-mono" type="number" />
                </div>
                <div class="space-y-1.5">
                  <span class="text-[9px] font-black text-gray-400 uppercase ml-1">Axis Y</span>
                  <UInput v-model.number="teleportY" placeholder="0" size="md" class="font-mono" type="number" />
                </div>
              </div>

              <UButton 
                block 
                size="lg" 
                color="primary" 
                label="JUMP TO COORDINATES" 
                class="font-black rounded-xl py-3 shadow-lg shadow-blue-500/20"
                @click="doTeleport" 
              />
            </div>
          </template>
        </UPopover>
      </div>
    </div>

    <!-- Leaderboard (Floating Right) -->
    <div class="absolute top-6 right-6 z-50 w-56 pointer-events-none hidden lg:block">
      <div class="hud-panel rounded-3xl p-5 pointer-events-auto shadow-2xl">
        <div class="flex items-center gap-3 mb-4">
          <div class="p-2 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
            <UIcon name="i-heroicons-trophy" class="text-yellow-500 w-6 h-6" />
          </div>
          <h3 class="text-xs font-black uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">Leaderboard</h3>
        </div>
        <div class="space-y-3">
          <div 
            v-for="(p, i) in play.state.value.leaderboard" 
            :key="p.username"
            class="flex items-center justify-between group cursor-default"
          >
            <div class="flex items-center gap-3 overflow-hidden">
              <span class="font-mono text-[10px] text-gray-400 w-4">{{ i + 1 }}</span>
              <div 
                class="w-3 h-3 rounded-full flex-shrink-0 ring-2 ring-white/20" 
                :style="{ background: p.color }"
              ></div>
              <span class="truncate font-bold text-sm text-gray-700 dark:text-gray-200 group-hover:text-blue-500 transition-colors" :title="p.username">
                {{ p.username }}
              </span>
            </div>
            <span class="font-mono font-black text-sm text-blue-600 dark:text-blue-400">{{ p.score }}</span>
          </div>
          <div v-if="!play.state.value.leaderboard.length" class="text-center py-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            Waiting for data...
          </div>
        </div>
      </div>
    </div>

    <!-- The Infinite Board -->
    <MineBoard ref="boardRef" :play="play" class="w-full h-full" />

    <!-- Zoom Control (Bottom Right) -->
    <div class="absolute bottom-6 right-6 z-50 flex flex-col items-end gap-3 pointer-events-none">
      <div class="hud-panel rounded-2xl px-3 py-2 flex items-center gap-2 pointer-events-auto shadow-xl">
        <button 
          class="p-2 rounded-xl hover:bg-white/20 dark:hover:bg-white/5 text-gray-500 transition-all active:scale-90"
          @click="boardRef?.setScale((boardRef?.getScale() || 1) - 0.2)"
        >
          <UIcon name="i-heroicons-minus" class="w-5 h-5" />
        </button>
        
        <div 
          class="px-3 py-1 rounded-xl bg-blue-500/10 border border-blue-500/20 cursor-pointer hover:bg-blue-500/20 transition-all"
          @click="boardRef?.setScale(1.0)"
          title="Reset Zoom"
        >
          <span class="text-[10px] font-black text-blue-600 dark:text-blue-400 font-mono tracking-tighter">
            {{ Math.round((boardRef?.getScale() || 1) * 100) }}%
          </span>
        </div>

        <button 
          class="p-2 rounded-xl hover:bg-white/20 dark:hover:bg-white/5 text-gray-500 transition-all active:scale-90"
          @click="boardRef?.setScale((boardRef?.getScale() || 1) + 0.2)"
        >
          <UIcon name="i-heroicons-plus" class="w-5 h-5" />
        </button>
      </div>
    </div>

    <!-- Auth Modal -->
    <AuthModal ref="authModal" :play="play" />

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { GamePlay } from '../assets/logic';
import { initAudio, isAudioEnabled } from '../assets/audio.js';

const play = new GamePlay();
const boardRef = ref<any>(null);
const authModal = ref<any>(null);

const teleportX = ref(0);
const teleportY = ref(0);

const syncTeleportCoords = () => {
  teleportX.value = play.state.value.cameraX;
  teleportY.value = play.state.value.cameraY;
};

const doTeleport = () => {
  if (boardRef.value) {
    boardRef.value.jumpTo(teleportX.value, teleportY.value);
  }
};

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
  
  // 登录框不再自动弹出，用户点击左上角头像区域手动打开
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
