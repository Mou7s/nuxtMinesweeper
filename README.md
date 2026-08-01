# Minesweeper

一个基于 Nuxt 4、Vue 3、Canvas 和 WebSocket 的每日挑战扫雷游戏。

线上地址：[minesweeper.mou7s.com](https://minesweeper.mou7s.com)

## 游戏模式

- **每日挑战**：UTC 每天刷新一张固定的 16×16、40 雷棋盘，所有玩家共享同一张题目和排行榜。
- **实时对战**：创建 1v1 或 2–8 人房间，统一倒计时后开始，先完成清盘者获胜。
- **异步挑战**：创建永久有效的挑战码或链接，玩家分别完成同一张私人棋盘并比较最佳成绩。

游客可以试玩每日题目；登录后才能保存成绩、参加房间和显示账号排名。

## 规则

- 首次有效操作开始计时，棋盘不保证首击安全。
- 旗帜只是标记，不会直接触发失误或计时惩罚。
- 踩到雷后继续游戏：第一次不加罚，第二次及之后每次增加 10 秒。
- 完成所有安全格后，服务端计算最终有效用时：实际用时 + 罚时。
- 每个账号可以重复挑战每日题目，但排行榜只保留个人最佳成绩。
- 客户端不能提交时间、seed 或最终结果，服务端记录动作日志并完成结算。

## 技术架构

| 层级 | 技术 |
| --- | --- |
| 应用框架 | Nuxt 4、Vue 3 |
| 棋盘 | 固定尺寸 Canvas 2D |
| 实时通信 | Nitro WebSocket |
| 房间 | Cloudflare Durable Objects / 本地单进程房间管理 |
| 认证 | HS256 JWT、scrypt 密码哈希 |
| 数据库 | NuxtHub Drizzle；本地 SQLite、线上 Cloudflare D1 |
| 部署 | Cloudflare Workers Builds |

## 快速开始

环境要求：Node.js 20+、Bun 1.3+。

```bash
bun install
cp .env.example .env
bun run db:migrate
bun run dev
```

本地默认数据库为 `.data/minesweeper.sqlite`，不需要 Cloudflare 账号。

环境变量：

```env
CLOUDFLARE_D1_DATABASE_ID=
LOCAL_DB_PATH=.data/minesweeper.sqlite
JWT_SECRET=replace_with_a_long_random_secret
```

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `bun run dev` | 本地开发服务器和 SQLite |
| `bun run db:migrate` | 应用本地数据库迁移 |
| `bun run db:generate` | 根据 Drizzle schema 生成迁移 |
| `bun run test` | 运行棋盘和计时规则测试 |
| `bun run build` | 构建 Node.js 服务器产物 |
| `bun run build:cloudflare` | 构建 Cloudflare Durable Workers 产物 |
| `bun run preview:cloudflare` | 使用 Wrangler 预览 Cloudflare 产物 |
| `bun run deploy` | 构建并部署 Worker |

不要使用 `bun run generate` 部署。每日题、成绩、认证和 WebSocket 都依赖服务端运行时。

## 项目结构

```text
.
├── assets/
│   ├── audio.js                 # Web Audio 音效
│   ├── logic.js                 # 客户端运行状态和 WebSocket 客户端
│   └── style.css                # 全局样式
├── components/
│   ├── AuthModal.vue            # 登录与注册
│   ├── Footer.vue               # GitHub 链接
│   └── MineBoard.vue             # 固定 16×16 Canvas 棋盘
├── pages/index.vue              # 每日、实时、异步三种模式
├── server/
│   ├── api/auth/                # 注册和登录
│   ├── api/challenges/          # 每日题和私人挑战 API
│   ├── api/leaderboards/        # 排行榜 API
│   ├── db/schema/               # Drizzle schema
│   ├── db/migrations/           # SQLite/D1 迁移
│   ├── routes/ws.js             # 运行和房间 WebSocket 协议
│   └── utils/
│       ├── challengeEngine.mjs  # 服务端权威棋盘、计时和罚时
│       ├── appDataStore.js      # D1/SQLite 数据访问
│       ├── userStore.js         # 账号与密码
│       └── jwt.js               # JWT 签发与校验
└── tests/                       # 规则测试
```

## WebSocket 消息

客户端使用以下消息：`identify`、`run:start`、`run:resume`、`run:action`、`room:create`、`room:join`、`room:ready`、`room:action` 和 `ping`。

服务端返回 `hello`、`auth`、`run:init`、`run:update`、`room:created`、`room:state`、`room:countdown`、`room:started`、`pong` 或 `error`。

所有动作都带有递增 `seq`。服务端会检查坐标、动作类型、频率和序号，并只向客户端返回当前可见的格子状态。

## 数据边界

- 本地 SQLite 和线上 D1 是完全不同的数据环境。
- 本次重构不迁移旧 KV 中的无限世界、旧账号或旧积分。
- `.data/`、`.env`、D1 ID、JWT 密钥和用户数据都不能提交。
- 生产环境必须设置强随机 `JWT_SECRET`。

## Cloudflare 与 GitHub

Cloudflare 配置使用 Worker `minesweeper`、D1 binding `DB`、Durable Object 房间和自定义域名 `minesweeper.mou7s.com`。部署细节见 [DEPLOY_CLOUDFLARE.md](./DEPLOY_CLOUDFLARE.md)。

GitHub 仓库目标地址为 `https://github.com/Mou7s/minesweeper`。仓库重命名需要在 GitHub 项目设置中完成，代码不会自动修改远程仓库名称。
