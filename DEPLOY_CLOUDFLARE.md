# Deploy Minesweeper to Cloudflare

本项目使用 Nuxt 的 `cloudflare-durable` preset，线上运行在 Cloudflare Workers，数据库使用 D1，实时房间使用 Durable Objects。

## 1. 创建 D1

```bash
bun x wrangler login
bun x wrangler d1 create minesweeper
```

记录命令返回的 database id，并写入 `.env`：

```env
CLOUDFLARE_D1_DATABASE_ID=your_database_id
JWT_SECRET=replace_with_a_long_random_secret
```

本地迁移：

```bash
bun run db:migrate
```

生产 D1 迁移可以使用生成产物中的迁移目录，或通过 NuxtHub/ Wrangler 按项目部署流程应用 `server/db/migrations/sqlite/0000_initial.sql`。

## 2. 本地预览 Cloudflare 运行时

```bash
bun run preview:cloudflare
```

如果本地预览需要读取线上 D1，请确认 `.env` 中存在正确的 `CLOUDFLARE_D1_DATABASE_ID`，并使用已登录的 Wrangler 账号。

## 3. 部署 Worker

```bash
bun run deploy
```

生成配置包含：

- Worker：`minesweeper`
- 自定义域名：`minesweeper.mou7s.com`
- D1 binding：`DB`
- Durable Object binding：`$DurableObject`
- Durable Object 类：`$DurableObject`

Cloudflare Builds 可以直接使用仓库中的 `bun run build:cloudflare` 和 `bun run deploy`。当前仓库没有实际的 `.github/workflows`，不要按旧文档配置不存在的 GitHub Actions workflow。

## 4. 切换旧部署

新 Worker 和 D1 验证通过后，再执行以下外部操作：

1. 将自定义域名切换到新 Worker。
2. 确认每日题、登录、排行榜和房间 WebSocket 正常。
3. 移除旧的 `infinite-minesweeper` Worker 和旧 KV namespace。
4. 移除旧域名 `infiniteminesweeper.mou7s.com` 路由。

新版本不会读取旧 KV 数据，也不会迁移旧账号和无限世界。

## 5. GitHub 仓库改名

在 GitHub 仓库设置中将 `Mou7s/infinite-minesweeper` 直接重命名为 `Mou7s/minesweeper`，保留历史记录，然后更新本地远程地址：

```bash
git remote set-url origin https://github.com/Mou7s/minesweeper.git
```

仓库改名和 Cloudflare 账号操作需要项目所有者权限，代码构建不会自动执行这些外部变更。

## 故障排查

- D1 绑定缺失：检查构建输出中的 `d1_databases` 和 `CLOUDFLARE_D1_DATABASE_ID`。
- 登录失败：检查生产 Worker secret 中的 `JWT_SECRET`。
- WebSocket 失败：确认部署使用 `cloudflare-durable` preset，且 Durable Object migration 已生成。
- 本地数据库异常：删除本地 `.data/minesweeper.sqlite` 后重新运行 `bun run db:migrate`。这只会删除本地测试数据。
