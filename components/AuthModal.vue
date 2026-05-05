<template>
  <UModal v-model="isOpen" prevent-close>
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
        <UFormGroup label="用户名" name="username">
          <UInput v-model="form.username" placeholder="输入你的昵称" icon="i-heroicons-user" />
        </UFormGroup>

        <UFormGroup label="密码" name="password">
          <UInput v-model="form.password" type="password" placeholder="••••••••" icon="i-heroicons-lock-closed" />
        </UFormGroup>

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

const form = reactive({
  username: '',
  password: ''
});

const open = () => {
  isOpen.value = true;
};

const handleSubmit = async () => {
  if (!form.username || !form.password) return;
  
  loading.value = true;
  let success = false;
  
  if (isLogin.value) {
    success = await props.play.login(form.username, form.password);
  } else {
    success = await props.play.register(form.username, form.password);
  }
  
  loading.value = false;
  if (success) {
    isOpen.value = false;
  }
};

defineExpose({ open });
</script>
