<template>
  <div class="panel p-5 sm:p-6">
    <div class="mb-4 flex items-center justify-between">
      <h3 class="text-lg font-black">今日排行榜</h3>
      <span class="text-xs font-bold text-slate-400">前 100</span>
    </div>
    <div v-if="entries?.length" class="space-y-2">
      <div v-for="entry in entries" :key="entry.userId" class="leaderboard-entry" :class="{ 'leaderboard-entry--me': entry.userId === me?.userId }">
        <span class="rank">{{ entry.rank }}</span>
        <span class="user-dot" :style="{ background: entry.color }"></span>
        <span class="min-w-0 flex-1 truncate font-bold">{{ entry.username }}</span>
        <span class="font-mono text-sm font-black">{{ format(entry.effectiveMs) }}</span>
      </div>
    </div>
    <div v-else class="bg-slate-100 p-8 text-center text-sm font-bold text-slate-400 dark:bg-slate-900">还没有成绩。</div>
  </div>
</template>

<script setup>
defineProps({ entries: Array, me: Object });

const format = (value) => {
  const total = Math.max(0, value || 0);
  const minutes = Math.floor(total / 60000);
  const seconds = Math.floor((total % 60000) / 1000).toString().padStart(2, '0');
  const hundredths = Math.floor((total % 1000) / 10).toString().padStart(2, '0');
  return `${minutes}:${seconds}.${hundredths}`;
};
</script>
