<template>
  <div class="minesweeper-app bg-slate-100 text-slate-900 transition-colors dark:bg-slate-950 dark:text-white">
    <header class="app-header border-b border-slate-200/80 bg-white/85 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/85">
      <div class="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div class="flex min-w-0 items-center gap-3">
          <div class="brand-mark" aria-hidden="true">MS</div>
          <div class="min-w-0">
            <h1 class="truncate text-lg font-black tracking-tight sm:text-xl">Minesweeper</h1>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button class="icon-button" title="切换主题" @click="toggleTheme">
            <span class="theme-glyph" aria-hidden="true">{{ colorMode.value === 'dark' ? '☼' : '☾' }}</span>
          </button>
          <button v-if="play.user.value" class="user-chip" @click="play.logout()">
            <span class="user-dot" :style="{ background: play.user.value.color }"></span>
            {{ play.user.value.username }}
          </button>
          <UButton v-else size="sm" color="primary" class="font-black" @click="authModal?.open()">登录</UButton>
        </div>
      </div>
    </header>

    <main class="app-main mx-auto w-full max-w-7xl px-3 sm:px-4">
      <nav class="mode-tabs grid grid-cols-3">
        <button v-for="tab in tabs" :key="tab.id" class="mode-tab" :class="{ 'mode-tab--active': mode === tab.id }" @click="mode = tab.id">
          <span>{{ tab.label }}</span>
        </button>
      </nav>

      <section v-if="mode === 'daily'" class="app-content game-layout game-layout--daily">
        <article class="game-card panel overflow-hidden">
          <div class="game-card__header flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h2 class="text-xl font-black tracking-tight">今日挑战</h2>
              <p class="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                {{ daily?.challengeDate || '加载题目中...' }} · 16×16 · 40 雷 · UTC 00:00 刷新
              </p>
            </div>
            <div class="text-right">
              <div class="text-[10px] font-black uppercase tracking-widest text-slate-400">Time</div>
              <div class="font-mono text-3xl font-black tabular-nums text-blue-600 dark:text-blue-400">{{ formatTime(timerMs) }}</div>
            </div>
          </div>

          <div class="board-shell game-card__board">
            <MineBoard v-if="play.state.value.run" :key="play.state.value.run.id" :play="play" />
            <div v-else class="empty-state flex flex-col items-center justify-center px-6 text-center">
              <h3 class="text-lg font-black">准备开始</h3>
              <p class="mt-2 max-w-md text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">16×16 · 40 雷 · 记录你的最佳有效用时。</p>
              <UButton class="mt-5 font-black" size="lg" color="primary" :disabled="!daily" @click="play.startDaily(daily?.id)">开始</UButton>
            </div>
          </div>

          <div v-if="play.state.value.run" class="game-card__footer flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 dark:border-slate-800">
            <div class="flex items-center gap-4 text-xs font-bold text-slate-500 dark:text-slate-400">
              <span>踩雷 {{ play.state.value.run.mineHits }} 次</span>
              <span>罚时 {{ formatTime(play.state.value.run.penaltyMs) }}</span>
              <span v-if="play.state.value.run.status === 'complete'" class="text-emerald-500">已完成</span>
            </div>
            <UButton size="sm" variant="soft" color="neutral" class="font-black" @click="play.startDaily(daily?.id)">重新挑战</UButton>
          </div>
        </article>

        <aside class="app-side">
          <div class="fold-panel panel">
            <button type="button" class="fold-panel__toggle" :aria-expanded="dailyInfoOpen" @click="dailyInfoOpen = !dailyInfoOpen">
              <span>
                <span class="fold-panel__eyebrow">Daily ranking</span>
                <span class="fold-panel__title">今日排行榜</span>
              </span>
              <span class="fold-panel__meta">{{ dailyInfoOpen ? '收起' : '展开' }}</span>
            </button>
            <div v-if="dailyInfoOpen" class="fold-panel__body">
              <Leaderboard :entries="play.state.value.leaderboard" :me="play.state.value.leaderboardMe" />
            </div>
          </div>
        </aside>
      </section>

      <section v-else-if="mode === 'versus'" class="app-content game-layout game-layout--versus">
        <article class="game-card panel">
          <div class="game-card__header flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 class="text-xl font-black tracking-tight">实时对战</h2>
              <p class="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">同一盘面、统一倒计时，先完成的人获胜。</p>
            </div>
          </div>

          <div v-if="!play.state.value.room" class="game-card__body grid gap-4 sm:grid-cols-2">
            <button class="action-card" @click="play.createRoom({ challengeId: daily?.id, maxPlayers: 2 })">
              <span class="font-black">创建 1v1</span><small>今日题目</small>
            </button>
            <button class="action-card" @click="play.createRoom({ maxPlayers: roomSize })">
              <span class="font-black">创建多人房间</span><small>私人随机题</small>
            </button>
            <div class="sm:col-span-2 bg-slate-100 p-4 dark:bg-slate-900">
              <label class="mb-2 block text-xs font-black uppercase tracking-widest text-slate-400">加入房间</label>
              <div class="flex gap-2">
                <UInput v-model="roomCode" class="min-w-0 flex-1 font-mono uppercase" placeholder="输入房间码" maxlength="8" />
                <UButton color="neutral" class="font-black" @click="play.joinRoom(roomCode)">加入</UButton>
              </div>
            </div>
          </div>

          <div v-else class="game-card__body game-card__body--room">
            <RoomPanel :room="play.state.value.room" :play="play" />
            <div v-if="play.state.value.run" class="room-board-shell board-shell">
              <MineBoard :key="play.state.value.run.id" :play="play" />
            </div>
          </div>
        </article>
        <aside class="app-side">
          <div class="fold-panel panel">
            <button type="button" class="fold-panel__toggle" :aria-expanded="roomInfoOpen" @click="roomInfoOpen = !roomInfoOpen">
              <span>
                <span class="fold-panel__eyebrow">Room settings</span>
                <span class="fold-panel__title">房间设置</span>
              </span>
              <span class="fold-panel__meta">{{ roomInfoOpen ? '收起' : '展开' }}</span>
            </button>
            <div v-if="roomInfoOpen" class="fold-panel__body">
              <label class="text-xs font-bold text-slate-500">多人房间人数</label>
              <select v-model.number="roomSize" class="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold dark:border-slate-700 dark:bg-slate-900">
                <option :value="3">3 人</option><option :value="4">4 人</option><option :value="6">6 人</option><option :value="8">8 人</option>
              </select>
              <p class="mt-5 text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">实时房间需要登录。断线后重新连接不会暂停计时。</p>
            </div>
          </div>
        </aside>
      </section>

      <section v-else class="app-content game-layout game-layout--async">
        <article class="game-card panel">
          <div class="game-card__header">
            <h2 class="text-xl font-black tracking-tight">异步挑战</h2>
            <p class="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">创建一个永久有效的挑战链接，和朋友分别竞速。</p>
          </div>
          <div class="game-card__body flex flex-col gap-3">
            <div class="grid flex-none gap-3 sm:grid-cols-2">
              <UButton size="lg" color="primary" class="font-black" @click="createAsyncChallenge">创建私人挑战</UButton>
              <div class="flex gap-2">
                <UInput v-model="asyncCode" class="min-w-0 flex-1 font-mono uppercase" placeholder="挑战码" maxlength="8" />
                <UButton size="lg" color="neutral" class="font-black" @click="startAsyncChallenge">开始</UButton>
              </div>
            </div>
            <div v-if="createdAsync" class="flex-none rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/30">
              <div class="text-xs font-black uppercase tracking-widest text-emerald-600">Challenge created</div>
              <div class="mt-2 break-all font-mono text-sm font-bold text-emerald-800 dark:text-emerald-200">{{ createdAsync.url }}</div>
            </div>
            <div v-if="play.state.value.run" class="async-board-shell board-shell">
              <div class="mb-4 flex items-center justify-between"><span class="text-sm font-black">{{ play.state.value.challenge?.id }}</span><span class="font-mono text-2xl font-black text-amber-500">{{ formatTime(timerMs) }}</span></div>
              <MineBoard :key="play.state.value.run.id" :play="play" />
            </div>
          </div>
        </article>
        <aside class="app-side">
          <div class="fold-panel panel">
            <button type="button" class="fold-panel__toggle" :aria-expanded="rulesOpen" @click="rulesOpen = !rulesOpen">
              <span>
                <span class="fold-panel__eyebrow">Rules</span>
                <span class="fold-panel__title">挑战规则</span>
              </span>
              <span class="fold-panel__meta">{{ rulesOpen ? '收起' : '展开' }}</span>
            </button>
            <div v-if="rulesOpen" class="fold-panel__body">
              <p class="text-sm font-medium leading-7 text-slate-500 dark:text-slate-400">每个挑战会记录你的最佳成绩。挑战码不会过期，双方可以多次尝试。</p>
            </div>
          </div>
        </aside>
      </section>

    </main>

    <Footer class="app-footer" />

    <AuthModal ref="authModal" :play="play" />
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { GamePlay } from '../assets/logic.js';

const toast = useToast();
const colorMode = useColorMode();
const authModal = ref(null);
const mode = ref('daily');
const daily = ref(null);
const roomCode = ref('');
const roomSize = ref(4);
const asyncCode = ref('');
const createdAsync = ref(null);
const dailyInfoOpen = ref(false);
const roomInfoOpen = ref(false);
const rulesOpen = ref(false);
const now = ref(Date.now());
let clock = null;
let compactViewport = null;

const tabs = [
  { id: 'daily', label: '每日挑战', icon: 'i-heroicons-calendar-days' },
  { id: 'versus', label: '实时对战', icon: 'i-heroicons-bolt' },
  { id: 'async', label: '异步挑战', icon: 'i-heroicons-link' },
];

const play = new GamePlay({
  notify(message, color = 'error') { toast.add({ title: message, color }); },
  onAuthRequired() { authModal.value?.open(); },
});

const timerMs = computed(() => {
  const run = play.state.value.run;
  if (!run) return 0;
  if (run.effectiveMs !== null && run.effectiveMs !== undefined) return run.effectiveMs;
  if (run.startedAt === null || run.startedAt === undefined) return 0;
  return Math.max(0, now.value + play.state.value.serverOffset - run.startedAt + run.penaltyMs);
});

const formatTime = (milliseconds) => {
  const total = Math.max(0, Math.floor(Number(milliseconds) || 0));
  const minutes = Math.floor(total / 60_000);
  const seconds = Math.floor((total % 60_000) / 1_000).toString().padStart(2, '0');
  const hundredths = Math.floor((total % 1_000) / 10).toString().padStart(2, '0');
  return `${minutes}:${seconds}.${hundredths}`;
};

const toggleTheme = () => { colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'; };

const createAsyncChallenge = async () => {
  if (!play.user.value) { authModal.value?.open(); return; }
  try {
    const result = await $fetch('/api/challenges/private', {
      method: 'POST',
      headers: { Authorization: `Bearer ${play.token.value}` },
    });
    createdAsync.value = result;
    asyncCode.value = result.code;
    play.showNotice('私人挑战已创建', 'success');
  } catch (error) {
    play.showNotice(error.data?.statusMessage || '创建挑战失败');
  }
};

const startAsyncChallenge = async () => {
  const code = asyncCode.value.trim().toUpperCase();
  if (!code) return;
  try {
    const result = await $fetch(`/api/challenges/private/${code}`);
    play.startAsync(result.id);
  } catch (error) {
    play.showNotice(error.data?.statusMessage || '挑战不存在');
  }
};

const syncPanelDefaults = () => {
  const nextCompactViewport = window.innerWidth < 1024;
  if (compactViewport === nextCompactViewport) return;
  compactViewport = nextCompactViewport;
  const open = !nextCompactViewport;
  dailyInfoOpen.value = open;
  roomInfoOpen.value = open;
  rulesOpen.value = open;
};

onMounted(async () => {
  clock = setInterval(() => { now.value = Date.now(); }, 50);
  syncPanelDefaults();
  window.addEventListener('resize', syncPanelDefaults, { passive: true });
  try {
    daily.value = await $fetch('/api/challenges/daily');
    play.state.value.challenge = daily.value;
    await play.refreshLeaderboard();
  } catch {
    play.showNotice('每日题目暂时无法加载，请检查数据库配置', 'warning');
  }
});

onUnmounted(() => {
  if (clock) clearInterval(clock);
  window.removeEventListener('resize', syncPanelDefaults);
  play.destroy();
});
</script>
