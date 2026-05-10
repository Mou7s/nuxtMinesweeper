<template>
  <UModal v-model:open="isOpen">
    <template #content>
      <div class="overflow-hidden">
        <!-- Top Brand Section -->
        <div class="relative h-32 bg-gradient-to-br from-primary-500 to-blue-600 flex flex-col items-center justify-center text-white overflow-hidden">
          <div class="absolute inset-0 opacity-20 pointer-events-none">
            <div class="absolute -top-10 -left-10 w-40 h-40 bg-white rounded-full blur-3xl"></div>
            <div class="absolute -bottom-10 -right-10 w-40 h-40 bg-white rounded-full blur-3xl"></div>
          </div>
          <div class="text-4xl mb-1 transform hover:scale-110 transition-transform cursor-default">💣</div>
          <h2 class="text-2xl font-black tracking-tighter uppercase">Infinite Mines</h2>
          <p class="text-[10px] opacity-80 font-bold tracking-widest uppercase mt-1">Multiplayer Survival</p>
        </div>

        <div class="p-8">
          <div class="flex flex-col mb-6">
            <h3 class="text-xl font-bold text-gray-900 dark:text-white">
              {{ isLogin ? '欢迎回来' : '创建新玩家' }}
            </h3>
            <p class="text-sm text-gray-500">
              {{ isLogin ? '登录以同步你的分数和成就' : '选择一个独特的身份加入无限战场' }}
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