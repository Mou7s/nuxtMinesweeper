<template>
  <div class="relative w-screen h-screen overflow-hidden font-sans bg-slate-200 dark:bg-slate-950">
    <!-- Enhanced Background for Glass Effect -->
    <div class="absolute inset-0 pointer-events-none overflow-hidden">
      <div class="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] rounded-full bg-blue-500/20 blur-[120px] animate-pulse"></div>
      <div class="absolute -bottom-[10%] -right-[10%] w-[50%] h-[50%] rounded-full bg-indigo-500/20 blur-[120px] animate-pulse" style="animation-delay: 2s;"></div>
      <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[30%] h-[30%] rounded-full bg-purple-500/10 blur-[100px]"></div>
    </div>


    <!-- Floating HUD -->
    <div class="absolute top-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-4 pointer-events-none">
      
      <!-- Main Control Panel -->
      <div class="hud-panel rounded-3xl px-4 py-2.5 flex items-center gap-3 pointer-events-auto shadow-2xl">
        
        <!-- User Info / Profile -->
        <div 
          class="flex items-center gap-3 px-3 py-1.5 hover:bg-white/30 dark:hover:bg-white/10 rounded-2xl cursor-pointer transition-all border border-transparent hover:border-white/50 group"
          @click="handleProfileClick"
        >
          <div class="relative">
            <UAvatar 
              v-if="play.user.value"
              :alt="play.user.value.username" 
              size="md"
              class="ring-2 ring-white/50 transition-transform group-hover:scale-110"
              :style="{ background: play.user.value.color }"
            />
            <UIcon v-else name="i-heroicons-user-circle" class="w-9 h-9 text-gray-500/80 group-hover:text-blue-500 transition-colors" />
            <div v-if="play.user.value" class="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-green-500 border-2 border-white dark:border-slate-900 rounded-full"></div>
          </div>
          <div class="flex flex-col">
            <span class="text-sm font-black text-slate-800 dark:text-slate-100 tracking-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {{ play.user.value ? play.user.value.username : 'Guest Player' }}
            </span>
            <div class="flex items-center gap-1.5">
              <span v-if="play.user.value" class="text-[10px] text-blue-600 dark:text-blue-400 font-black uppercase tracking-widest">
                {{ play.user.value.score }} PTS
              </span>
              <span v-else class="text-[9px] text-slate-500 font-black tracking-tighter">CLICK TO JOIN</span>
            </div>
          </div>
        </div>


        <div class="w-px h-10 bg-gray-300/50 dark:bg-gray-700/50 mx-1"></div>

        <!-- Face Button -->
        <button class="face-btn" @click="resetGame">
          {{ faceEmoji }}
        </button>

        <div class="w-px h-10 bg-gray-300/50 dark:bg-gray-700/50 mx-1"></div>

        <!-- Flags -->
        <div class="hud-stat hud-stat--flags group">
          <UIcon name="i-heroicons-flag" class="w-5 h-5 text-red-500 group-hover:animate-bounce" />
          <span class="text-2xl font-mono font-black text-slate-800 dark:text-slate-100 tracking-tighter">
            {{ String(play.state.value.flags || 0).padStart(3, '0') }}
          </span>
        </div>

      </div>

      <!-- Info Bar -->
      <div class="flex items-center gap-3 pointer-events-auto">
        <div class="info-pill flex items-center gap-2.5">
          <span class="conn-dot" :class="play.state.value.connected ? 'conn-dot--online' : 'conn-dot--offline'"></span>
          <span class="tracking-[0.2em] uppercase text-[9px] font-black">{{ play.state.value.connected ? 'Online' : 'Reconnecting' }}</span>
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
            <div class="hud-panel p-6 rounded-[2rem] w-72 flex flex-col gap-6 shadow-2xl border-white/50">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <div class="p-1.5 rounded-lg bg-blue-500/20 text-blue-500">
                    <UIcon name="i-heroicons-paper-airplane" class="w-4 h-4" />
                  </div>
                  <h4 class="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Teleport</h4>
                </div>
                <span class="text-[9px] font-mono font-bold text-slate-400">JMP.SYS</span>
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
    <div class="absolute top-6 right-6 z-50 w-60 pointer-events-none hidden lg:block">
      <div class="hud-panel rounded-[2rem] p-6 pointer-events-auto">
        <div class="flex items-center gap-3 mb-6">
          <div class="p-2.5 rounded-2xl bg-yellow-500/20 border border-yellow-500/30 shadow-inner">
            <UIcon name="i-heroicons-trophy" class="text-yellow-600 dark:text-yellow-400 w-6 h-6" />
          </div>
          <div class="flex flex-col">
            <h3 class="text-xs font-black uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">Leaderboard</h3>
            <span class="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Global Ranking</span>
          </div>
        </div>
        <div class="space-y-1.5 max-h-[400px] overflow-y-auto glass-scroll pr-1">
          <div 
            v-for="(p, i) in play.state.value.leaderboard" 
            :key="p.username"
            class="leaderboard-row group"
            :class="{ 'leaderboard-row--me': p.username === play.user.value?.username }"
          >
            <div class="flex items-center gap-3 overflow-hidden">
              <!-- Rank Badge -->
              <div class="rank-badge" :class="`rank-badge--${i + 1}`">
                <span v-if="i > 2">{{ i + 1 }}</span>
                <UIcon v-else-if="i === 0" name="i-heroicons-bolt" class="w-3.5 h-3.5" />
                <UIcon v-else-if="i === 1" name="i-heroicons-sparkles" class="w-3.5 h-3.5" />
                <UIcon v-else-if="i === 2" name="i-heroicons-star" class="w-3.5 h-3.5" />
              </div>

              <!-- Player Avatar/Orb -->
              <div class="relative flex-shrink-0">
                <div 
                  class="w-4 h-4 rounded-full ring-2 ring-white/50 transition-all duration-500 group-hover:shadow-[0_0_12px_rgba(255,255,255,0.5)]" 
                  :style="{ 
                    background: p.color,
                    boxShadow: `0 0 10px ${p.color}44`
                  }"
                ></div>
                <div v-if="p.username === play.user.value?.username" class="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full border border-white"></div>
              </div>

              <!-- Username -->
              <span 
                class="truncate font-black text-sm transition-colors duration-300"
                :class="p.username === play.user.value?.username ? 'text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-200 group-hover:text-blue-500'"
                :title="p.username"
              >
                {{ p.username }}
              </span>
            </div>

            <!-- Score -->
            <div class="flex flex-col items-end leading-none">
              <span class="font-mono font-black text-sm text-slate-800 dark:text-slate-100 group-hover:scale-110 transition-transform origin-right">
                {{ p.score }}
              </span>
              <span class="text-[7px] font-black text-slate-400 uppercase tracking-tighter">POINTS</span>
            </div>
          </div>

          <div v-if="!play.state.value.leaderboard.length" class="text-center py-10">
            <UIcon name="i-heroicons-globe-alt" class="w-8 h-8 text-slate-300 animate-pulse mb-3 mx-auto" />
            <div class="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">
              Scanning World...
            </div>
          </div>
        </div>

      </div>
    </div>


    <!-- The Infinite Board -->
    <MineBoard ref="boardRef" :play="play" class="w-full h-full" />

    <!-- Zoom Control (Bottom Right) -->
    <div class="absolute bottom-6 right-6 z-50 flex flex-col items-end gap-3 pointer-events-none">
      <div class="hud-panel rounded-2xl px-2 py-2 flex items-center gap-1.5 pointer-events-auto">
        <button 
          class="p-2.5 rounded-xl hover:bg-white/30 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 transition-all active:scale-90 group"
          @click="boardRef?.setScale((boardRef?.getScale() || 1) - 0.2)"
        >
          <UIcon name="i-heroicons-minus" class="w-5 h-5 group-hover:text-blue-500" />
        </button>
        
        <div 
          class="px-4 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/20 cursor-pointer hover:bg-blue-500/20 transition-all group"
          @click="boardRef?.setScale(1.0)"
          title="Reset Zoom"
        >
          <span class="text-[11px] font-black text-blue-600 dark:text-blue-400 font-mono tracking-tighter">
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
