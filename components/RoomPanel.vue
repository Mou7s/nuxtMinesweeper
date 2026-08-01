<template>
  <div>
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <div class="text-xs font-bold text-slate-500 dark:text-slate-400">房间码</div>
        <div class="font-mono text-xl font-black tracking-widest">{{ room.code }}</div>
      </div>
      <UButton v-if="room.status === 'lobby'" color="primary" class="font-black" @click="play.setRoomReady(true)">准备</UButton>
      <span v-else class="text-xs font-black uppercase text-violet-500">{{ room.status }}</span>
    </div>
    <div class="mt-3 flex items-center justify-between gap-3 text-xs font-bold text-slate-500 dark:text-slate-400">
      <span>{{ room.players.length }} 名玩家 · {{ room.status }}</span>
      <button type="button" class="font-black text-violet-600 dark:text-violet-400" :aria-expanded="playersOpen" @click="playersOpen = !playersOpen">
        {{ playersOpen ? '收起玩家' : '查看玩家' }}
      </button>
    </div>
    <div v-if="playersOpen" class="mt-3 space-y-2">
      <div v-for="player in room.players" :key="player.id" class="leaderboard-entry">
        <span class="user-dot" :style="{ background: player.color }"></span>
        <span class="flex-1 font-bold">{{ player.username }}</span>
        <span class="text-xs font-black uppercase text-slate-400">{{ player.ready ? 'Ready' : 'Waiting' }}</span>
      </div>
    </div>
    <div v-if="room.status === 'countdown'" class="mt-5 border-l-2 border-violet-500 bg-violet-500/10 p-3 text-sm font-black text-violet-600">准备完成，马上开始</div>
    <div v-if="room.status === 'finished'" class="mt-5 border-l-2 border-emerald-500 bg-emerald-500/10 p-3 text-sm font-black text-emerald-600">比赛结束</div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

defineProps({ room: { type: Object, required: true }, play: { type: Object, required: true } });
const playersOpen = ref(false);
</script>
