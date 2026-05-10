<template>
  <UModal v-model:open="isOpen">
    <template #content>
      <div class="overflow-hidden">
        <!-- Top Brand Section -->
        <div class="relative h-40 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 flex flex-col items-center justify-center text-white overflow-hidden">
          <!-- Animated Background Blobs -->
          <div class="absolute inset-0 overflow-hidden pointer-events-none">
            <div class="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] rounded-full bg-white/20 blur-3xl animate-pulse"></div>
            <div class="absolute -bottom-[20%] -right-[10%] w-[60%] h-[60%] rounded-full bg-blue-400/20 blur-3xl animate-pulse" style="animation-delay: 1s;"></div>
          </div>
          
          <div class="relative z-10 flex flex-col items-center">
            <div class="text-5xl mb-3 drop-shadow-2xl transform hover:scale-110 transition-transform cursor-default">💣</div>
            <h2 class="text-2xl font-black tracking-tighter uppercase leading-none">Infinite Mines</h2>
            <div class="mt-2 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full border border-white/20 shadow-sm">
              <p class="text-[9px] font-black tracking-[0.3em] uppercase">Multiplayer Survival</p>
            </div>
          </div>
        </div>


        <div class="p-8 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl">
          <div class="flex flex-col mb-8">
            <h3 class="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {{ isLogin ? 'Welcome Back' : 'Create Agent' }}
            </h3>
            <p class="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
              {{ isLogin ? 'Login to sync your scores & achievements' : 'Join the infinite battlefield' }}
            </p>
          </div>


          <form @submit.prevent="handleSubmit" class="space-y-5">
            <UFormField label="用户名" size="lg">
              <UInput 
                v-model="form.username" 
                placeholder="你的昵称" 
                icon="i-heroicons-user" 
                required 
                class="w-full"
              />
            </UFormField>

            <UFormField label="密码" size="lg">
              <UInput 
                v-model="form.password" 
                type="password" 
                placeholder="••••••••" 
                icon="i-heroicons-lock-closed" 
                required 
                class="w-full"
              />
            </UFormField>
            
            <UFormField v-if="!isLogin" label="确认密码" size="lg">
              <UInput 
                v-model="form.confirmPassword" 
                type="password" 
                placeholder="••••••••" 
                icon="i-heroicons-lock-closed" 
                required 
                class="w-full"
              />
            </UFormField>

            <div v-if="!isLogin" class="space-y-3">
              <div class="flex items-center justify-between">
                <label class="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-tight">代表色</label>
                <span class="text-[10px] font-mono text-gray-400">{{ form.color }}</span>
              </div>
              <div class="flex flex-wrap gap-2.5 p-3 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50">
                <button
                  v-for="color in colors"
                  :key="color"
                  type="button"
                  class="w-7 h-7 rounded-full transition-all border-4 ring-offset-2 dark:ring-offset-gray-900"
                  :class="form.color === color ? 'ring-2 ring-primary-500 scale-110 shadow-lg' : 'ring-0 border-transparent hover:scale-110'"
                  :style="{ background: color, borderColor: form.color === color ? 'white' : 'transparent' }"
                  @click="form.color = color"
                />
              </div>
            </div>

            <div class="pt-4 flex flex-col gap-4">
              <UButton 
                type="submit" 
                block 
                size="xl"
                :loading="loading" 
                color="primary"
                class="font-black rounded-xl"
              >
                {{ isLogin ? '进入游戏' : '立即注册' }}
              </UButton>

              <div class="flex items-center justify-center gap-2">
                <div class="h-px flex-1 bg-gray-100 dark:bg-gray-800"></div>
                <span class="text-[10px] text-gray-400 font-bold uppercase tracking-widest">OR</span>
                <div class="h-px flex-1 bg-gray-100 dark:bg-gray-800"></div>
              </div>

              <UButton 
                variant="ghost" 
                block 
                color="neutral"
                class="font-bold"
                @click="isLogin = !isLogin"
              >
                {{ isLogin ? '没有账号？创建一个' : '已有账号？返回登录' }}
              </UButton>
            </div>
          </form>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';

const props = defineProps<{
  play: any
}>();

const isOpen = ref(false);
const isLogin = ref(true);
const loading = ref(false);

const colors = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', 
  '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#6366f1'
];

const form = reactive({
  username: '',
  password: '',
  confirmPassword: '',
  color: colors[Math.floor(Math.random() * colors.length)]
});

const open = () => {
  console.log('AuthModal open() called');
  isOpen.value = true;
};

const handleSubmit = async () => {
  if (!form.username || !form.password) {
    alert('请输入用户名和密码');
    return;
  }
  
  loading.value = true;
  let success = false;
  
  if (isLogin.value) {
    success = await props.play.login(form.username, form.password);
  } else {
    if (form.password !== form.confirmPassword) {
      alert('两次输入的密码不一致！');
      loading.value = false;
      return;
    }
    success = await props.play.register(form.username, form.password, form.color);
  }
  
  loading.value = false;
  if (success) {
    isOpen.value = false;
  }
};

defineExpose({ open });
</script>