// https://nuxt.com/docs/api/configuration/nuxt-config
const kvNamespaceId = process.env.CLOUDFLARE_KV_NAMESPACE_ID;
const isCloudflareBuild = process.env.NITRO_PRESET === 'cloudflare-durable';

export default defineNuxtConfig({
  devtools: { enabled: true },
  css: ['~/assets/style.css'],
  compatibilityDate: '2026-05-17',
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
    kv: isCloudflareBuild
      ? {
          driver: 'cloudflare-kv-binding',
          binding: 'KV',
          ...(kvNamespaceId ? { namespaceId: kvNamespaceId } : {})
        }
      : {
          driver: 'fs-lite',
          base: '.data/kv'
        }
  },
  nitro: {
    preset: 'cloudflare-durable',
    experimental: {
      websocket: true
    },
    cloudflare: {
      deployConfig: true,
      nodeCompat: true,
      wrangler: {
        name: 'nuxt-minesweeper',
        compatibility_flags: ['nodejs_compat'],
        durable_objects: {
          bindings: [
            {
              name: '$DurableObject',
              class_name: '$DurableObject'
            }
          ]
        },
        migrations: [
          {
            tag: 'v1',
            new_sqlite_classes: ['$DurableObject']
          }
        ]
      }
    }
  }
});
