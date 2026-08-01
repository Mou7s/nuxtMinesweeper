<template>
  <UModal v-model:open="isOpen">
    <template #content>
      <div class="auth-modal">
        <header class="auth-modal__header">
          <div class="auth-modal__mark" aria-hidden="true">MS</div>
          <div>
            <div class="auth-modal__brand">Minesweeper</div>
            <div class="auth-modal__caption">每日挑战 · 实时对战</div>
          </div>
        </header>

        <div class="auth-modal__body">
          <div class="auth-modal__intro">
            <h2 class="auth-modal__title">
              {{ isLogin ? 'Welcome Back' : 'Create Account' }}
            </h2>
            <p class="auth-modal__subtitle">
              {{ isLogin ? '登录后保存成绩并参加对战' : '创建你的 Minesweeper 账号' }}
            </p>
          </div>

          <form @submit.prevent="handleSubmit" class="auth-modal__form">
            <UFormField label="用户名" size="lg">
              <UInput
                v-model="form.username"
                placeholder="你的昵称"
                required
                minlength="2"
                maxlength="24"
                class="auth-modal__input w-full"
              />
            </UFormField>

            <UFormField label="密码" size="lg">
              <UInput
                v-model="form.password"
                type="password"
                placeholder="••••••••"
                required
                :minlength="isLogin ? 1 : 6"
                maxlength="128"
                class="auth-modal__input w-full"
              />
            </UFormField>

            <UFormField v-if="!isLogin" label="确认密码" size="lg">
              <UInput
                v-model="form.confirmPassword"
                type="password"
                placeholder="••••••••"
                required
                class="auth-modal__input w-full"
              />
            </UFormField>

            <div v-if="!isLogin" class="auth-modal__colors">
              <div class="auth-modal__color-label">
                <label>代表色</label>
                <span>{{ form.color }}</span>
              </div>
              <div class="auth-modal__swatches">
                <button
                  v-for="color in colors"
                  :key="color"
                  type="button"
                  class="auth-modal__swatch"
                  :class="{ 'auth-modal__swatch--active': form.color === color }"
                  :style="{ background: color }"
                  :aria-label="`选择代表色 ${color}`"
                  @click="form.color = color"
                />
              </div>
            </div>

            <div class="auth-modal__actions">
              <UButton
                type="submit"
                block
                size="xl"
                :loading="loading"
                color="primary"
                class="auth-modal__submit font-black"
              >
                {{ isLogin ? '进入游戏' : '立即注册' }}
              </UButton>

              <div class="auth-modal__divider">
                <span></span>
                <small>OR</small>
                <span></span>
              </div>

              <UButton
                variant="ghost"
                block
                color="neutral"
                class="auth-modal__switch font-bold"
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

<script setup>
import { reactive, ref } from 'vue';

const props = defineProps({ play: Object });

const isOpen = ref(false);
const isLogin = ref(true);
const loading = ref(false);

const colors = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#6366f1',
];

const form = reactive({
  username: '',
  password: '',
  confirmPassword: '',
  color: colors[Math.floor(Math.random() * colors.length)],
});

const open = () => {
  isOpen.value = true;
};

const handleSubmit = async () => {
  if (!form.username || !form.password) {
    props.play.showNotice('请输入用户名和密码', 'warning');
    return;
  }

  loading.value = true;
  let success = false;

  if (isLogin.value) {
    success = await props.play.login(form.username, form.password);
  } else {
    if (form.password !== form.confirmPassword) {
      props.play.showNotice('两次输入的密码不一致', 'warning');
      loading.value = false;
      return;
    }
    success = await props.play.register(form.username, form.password, form.color);
  }

  loading.value = false;
  if (success) {
    isOpen.value = false;
    props.play.showNotice(isLogin.value ? '登录成功' : '注册成功', 'success');
  }
};

defineExpose({ open });
</script>
