// https://nuxt.com/docs/api/configuration/nuxt-config
const isCloudflareBuild = process.env.MINESWEEPER_CLOUDFLARE_BUILD === '1';
const d1DatabaseId = process.env.CLOUDFLARE_D1_DATABASE_ID;
const localDatabasePath = process.env.LOCAL_DB_PATH || '.data/minesweeper.sqlite';

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
    db: isCloudflareBuild
      ? {
          dialect: 'sqlite',
          driver: 'd1',
          connection: d1DatabaseId ? { databaseId: d1DatabaseId } : undefined
        }
      : {
          dialect: 'sqlite',
          driver: 'libsql',
          connection: { url: `file:${localDatabasePath}` }
        }
  },
  nitro: {
    preset: isCloudflareBuild ? 'cloudflare-durable' : 'node-server',
    experimental: {
      websocket: true
    },
    cloudflare: {
      deployConfig: true,
      nodeCompat: true,
      wrangler: {
        name: 'minesweeper',
        routes: [
          {
            pattern: 'minesweeper.mou7s.com',
            custom_domain: true
          }
        ],
        d1_databases: [
          {
            binding: 'DB',
            database_name: 'minesweeper',
            ...(d1DatabaseId ? { database_id: d1DatabaseId } : {}),
            migrations_dir: 'server/db/migrations/sqlite'
          }
        ],
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
