# Deploy to Cloudflare Workers

This project is configured for Cloudflare Workers with Nitro's `cloudflare-durable` preset:

- NuxtHub KV is bound as `KV`.
- WebSocket traffic is routed through Nitro's Durable Object binding `$DurableObject`.
- Node compatibility is enabled for the current `node:crypto` usage.

## 1. Install dependencies

```bash
bun install
```

## 2. Log in to Cloudflare

```bash
bun x wrangler login
```

## 3. Create a KV namespace

```bash
cp .env.example .env
```

Then create the namespace and write the returned id to `.env`:

```bash
bun run cf:kv:create
```

Or create it manually:

```bash
bun x wrangler kv namespace create KV
```

Copy the returned `id` into `.env`:

```env
CLOUDFLARE_KV_NAMESPACE_ID=your_namespace_id
WORLD_STATE_KEY=
JWT_SECRET=replace_with_a_long_random_secret
```

Generate a production secret with:

```bash
openssl rand -base64 32
```

## 4. Preview locally with the Cloudflare runtime

```bash
bun run preview:cloudflare
```

## 5. Deploy

```bash
bun run deploy
```

Wrangler deploys from `.output`; Nitro writes the generated `wrangler.json` under `.output/server` and points Wrangler to it.

## GitHub Actions deploy

This repository includes `.github/workflows/deploy-cloudflare.yml`. Every push to `main` will build and deploy to Cloudflare.

Add these GitHub repository secrets before using it:

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_KV_NAMESPACE_ID
JWT_SECRET
```

`CLOUDFLARE_API_TOKEN` needs permission to deploy Workers and read/write Workers KV for the target account.

## Notes

- Do not use `bun run generate`; NuxtHub needs a server runtime.
- The Worker name is set to `infinite-minesweeper` in `nuxt.config.js`.
- Plain `bun run dev` uses local `.data/kv` storage. Cloudflare builds and deployments use the real `KV` binding.
- World board state is stored in Cloudflare KV. By default, `bun run dev` derives its namespace from `world-dev.json` and Cloudflare builds derive it from `world.json`, so development and production worlds do not overwrite each other.
- World data is stored as v2 metadata plus 32×32 chunk records under a separate `world-v2:<world key>` namespace. Existing single-record worlds are migrated automatically on first load; the legacy record is retained for rollback safety.
- Clients subscribe only to chunks around their viewport, and only dirty chunks are persisted after actions.
- To force a specific world key, set `WORLD_STATE_KEY` in `.env` or in the Worker environment.
- The current game server still keeps active multiplayer state in a process-level singleton. The `cloudflare-durable` preset makes WebSocket sessions work through a Durable Object instance, but long-term world state should still be moved fully into Durable Object storage, D1, or another explicit persistent model.
- If registration fails online, check that the generated Worker has a KV binding named `KV` and that `JWT_SECRET` is set.
