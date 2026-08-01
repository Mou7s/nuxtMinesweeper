# AGENTS.md

本仓库是 Minesweeper，每日挑战和多人竞速扫雷应用。工作时遵循以下边界。

## 核心架构

- `components/MineBoard.vue` 使用 Canvas 绘制固定的 16×16 棋盘，不要恢复无限地图或大规模可见格子 DOM。
- `assets/logic.js` 负责客户端状态、认证、计时显示和 WebSocket 消息。
- `server/utils/challengeEngine.mjs` 是服务端权威规则：雷区、揭示、旗帜、计时、罚时和完成判定都在服务端执行。
- `server/routes/ws.js` 负责单人运行和实时房间；客户端不能提交最终时间、seed 或结果。
- `server/db/schema/index.ts`、`server/db/migrations/` 是 D1/SQLite 数据模型来源。

## 规则不变量

- 每日题目使用 UTC 日期生成稳定 seed，棋盘固定 16×16、40 雷。
- 首次有效操作开始计时，不保证首击安全。
- 第一次踩雷不加罚，之后每次增加 10 秒。
- 旗帜只是标记，不会因为错误旗帜直接揭示或扣分。
- 每个账号的每日排行榜只保留最佳有效用时。
- 生产环境必须设置 `JWT_SECRET`，不能依赖开发回退密钥。

## 数据与部署

- 本地使用 `.data/minesweeper.sqlite`，线上使用 Cloudflare D1。
- 实时房间依赖 Durable Objects；不使用旧 KV、`WORLD_STATE_KEY`、`world-v2` 或无限世界数据。
- 不迁移旧账号、旧积分和旧世界。不要重新接回旧 `server/utils/gameLogic.js` 或区块协议。
- Worker 名称为 `minesweeper`，域名为 `minesweeper.mou7s.com`。

## 命令

```bash
bun install
bun run db:migrate
bun run test
bun run build
bun run build:cloudflare
git diff --check
```

数据库或 WebSocket 改动至少运行 `bun run test` 和 `bun run build:cloudflare`。涉及房间时用两个以上浏览器窗口验证倒计时、同步、完成顺序和断线重连。

保留用户已有未提交的依赖升级；不要手工回退 `package.json` 或 `bun.lock`。
