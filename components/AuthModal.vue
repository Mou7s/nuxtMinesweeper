<template>
  <UModal v-model:open="isOpen">
    <UCard :ui="{ ring: '', divide: 'divide-y divide-gray-100 dark:divide-gray-800' }">
      <template #header>
        <div class="flex items-center justify-between">
          <h3 class="text-xl font-bold text-gray-900 dark:text-white">
            {{ isLogin ? '登录账户' : '注册新玩家' }}
          </h3>
          <p class="text-xs text-gray-500">PVP 模式需要身份标识</p>
        </div>
      </template>

      <form @submit.prevent="handleSubmit" class="space-y-4 py-2">
        <UFormField label="用户名" name="username">
          <UInput v-model="form.username" placeholder="输入你的昵称" icon="i-heroicons-user" required />
        </UFormField>

        <UFormField label="密码" name="password">
          <UInput v-model="form.password" type="password" placeholder="••••••••" icon="i-heroicons-lock-closed" required />
        </UFormField>
        
        <UFormField v-if="!isLogin" label="确认密码" name="confirmPassword">
          <UInput v-model="form.confirmPassword" type="password" placeholder="••••••••" icon="i-heroicons-lock-closed" required />
        </UFormField>

        <UFormField v-if="!isLogin" label="选择你的代表色">
          <div class="flex flex-wrap gap-3 py-1">
            <button
              v-for="color in colors"
              :key="color"
              type="button"
              class="w-8 h-8 rounded-full transition-all border-2"
              :class="form.color === color ? 'border-gray-800 scale-110 shadow-lg' : 'border-transparent hover:scale-105'"
              :style="{ background: color }"
              @click="form.color = color"
            />
          </div>
        </UFormField>

        <div class="pt-2 flex flex-col gap-3">
          <UButton 
            type="submit" 
            block 
            :loading="loading" 
            color="primary"
            class="py-2.5 font-bold"
          >
            {{ isLogin ? '进入游戏' : '立即注册' }}
          </UButton>

          <UButton 
            variant="ghost" 
            block 
            size="xs"
            @click="isLogin = !isLogin"
          >
            {{ isLogin ? '没有账号？去注册' : '已有账号？去登录' }}
          </UButton>
        </div>
      </form>
    </UCard>
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
