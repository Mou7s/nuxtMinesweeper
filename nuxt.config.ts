// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },
  modules: ['@vueuse/nuxt', '@nuxt/ui'],
  compatibilityDate: '2025-02-14',

  devServer: {
    port: 80,
  },
});
