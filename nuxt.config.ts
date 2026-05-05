// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },
  css: ['~/assets/style.css'],
  modules: ['@vueuse/nuxt', '@nuxt/ui'],
  ignore: ['data/**'],
  vite: {
    server: {
      watch: {
        ignored: ['**/data/**']
      }
    }
  },
  nitro: {
    storage: {
      data: {
        driver: 'fs',
        base: './data'
      }
    },
    experimental: {
      websocket: true
    }
  }
});
