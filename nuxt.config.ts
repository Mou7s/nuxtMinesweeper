// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },
  css: ['~/assets/style.css'],
  modules: ['@vueuse/nuxt', '@nuxt/ui', '@nuxthub/core'],
  ignore: ['data/**'],
  vite: {
    server: {
      watch: {
        ignored: ['**/data/**']
      }
    }
  },
  hub: {
    kv: true
  },
  nitro: {
    experimental: {
      websocket: true
    }
  }
});
