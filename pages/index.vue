<template>
  <div class="relative w-screen h-screen overflow-hidden font-sans bg-slate-200 dark:bg-slate-950">
    <!-- Floating HUD -->
    <div class="hud-stack absolute left-1/2 top-3 z-50 flex -translate-x-1/2 flex-col items-center gap-2.5 pointer-events-none sm:top-4">
      
      <!-- Main Control Panel -->
      <div class="hud-panel hud-main flex items-center gap-2 pointer-events-auto">
        
        <!-- User Info / Profile -->
        <div 
          class="hud-user group"
          @click="handleProfileClick"
        >
          <div class="relative">
            <UAvatar 
              v-if="play.user.value"
              :alt="play.user.value.username" 
              size="md"
              class="ring-2 ring-white/50 transition-transform group-hover:scale-105"
              :style="{ background: play.user.value.color }"
            />
            <UIcon v-else name="i-heroicons-user-circle" class="h-9 w-9 text-slate-500/80 transition-colors group-hover:text-blue-500" />
            <div v-if="play.user.value" class="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-green-500 border-2 border-white dark:border-slate-900 rounded-full"></div>
          </div>
          <div class="flex min-w-0 flex-col">
            <span class="max-w-[118px] truncate text-sm font-black text-slate-800 transition-colors group-hover:text-blue-600 dark:text-slate-100 dark:group-hover:text-blue-400">
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


        <div class="hud-divider"></div>

        <!-- Face Button -->
        <button class="face-btn" @click="resetGame">
          {{ faceEmoji }}
        </button>

        <div class="hud-divider"></div>

        <!-- Flags -->
        <div class="hud-stat hud-stat--flags group">
          <UIcon name="i-heroicons-flag" class="h-4.5 w-4.5 text-red-500" />
          <span class="font-mono text-xl font-black text-slate-800 dark:text-slate-100">
            {{ String(play.state.value.flags || 0).padStart(3, '0') }}
          </span>
        </div>

      </div>

      <!-- Info Bar -->
      <div class="flex max-w-[calc(100vw-24px)] items-center gap-2 overflow-hidden pointer-events-auto">
        <div class="info-pill flex items-center gap-2.5">
          <span class="conn-dot" :class="play.state.value.connected ? 'conn-dot--online' : 'conn-dot--offline'"></span>
          <span class="uppercase text-[9px] font-black">{{ play.state.value.connected ? 'Online' : 'Reconnecting' }}</span>
        </div>

        <UPopover :popper="{ placement: 'bottom', offset: 12 }">
          <div 
            class="info-pill flex cursor-pointer items-center gap-2 font-mono active:scale-95"
            @click="syncTeleportCoords"
          >
            <UIcon name="i-heroicons-map-pin" class="h-3.5 w-3.5 text-blue-500" />
            <span class="tabular-nums">{{ play.state.value.cameraX }}, {{ play.state.value.cameraY }}</span>
          </div>
          
          <template #content>
            <div class="hud-panel w-72 flex flex-col gap-5 p-5">
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
    <div class="absolute right-4 top-4 z-50 hidden w-64 pointer-events-none lg:block">
      <div class="hud-panel hud-side pointer-events-auto">
        <div class="mb-4 flex items-center gap-3">
          <div class="hud-icon hud-icon--gold">
            <UIcon name="i-heroicons-trophy" class="h-5 w-5 text-yellow-600 dark:text-yellow-300" />
          </div>
          <div class="flex flex-col">
            <h3 class="text-xs font-black uppercase text-slate-600 dark:text-slate-300">Leaderboard</h3>
            <span class="text-[9px] font-bold uppercase text-slate-400">Global Ranking</span>
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
    <div class="absolute bottom-4 right-4 z-50 flex flex-col items-end gap-3 pointer-events-none">
      <div class="hud-panel hud-zoom flex items-center gap-1 pointer-events-auto">
        <button 
          class="hud-icon-button group"
          @click="boardRef?.setScale((boardRef?.getScale() || 1) - 0.2)"
        >
          <UIcon name="i-heroicons-minus" class="h-5 w-5 group-hover:text-blue-500" />
        </button>
        
        <div 
          class="zoom-readout"
          @click="boardRef?.setScale(1.0)"
          title="Reset Zoom"
        >
          <span class="font-mono text-[11px] font-black text-blue-600 dark:text-blue-300">
            {{ Math.round((boardRef?.getScale() || 1) * 100) }}%
          </span>
        </div>


        <button 
          class="hud-icon-button"
          @click="boardRef?.setScale((boardRef?.getScale() || 1) + 0.2)"
        >
          <UIcon name="i-heroicons-plus" class="h-5 w-5" />
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
import { installAudioUnlockListeners } from '../assets/audio.js';

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
  if (!play.user.value) {
    if (!authModal.value) {
      alert('登录弹窗还没准备好，请稍后再试');
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
  installAudioUnlockListeners();

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
