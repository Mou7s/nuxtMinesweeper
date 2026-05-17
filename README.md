# Infinite Multiplayer Minesweeper

一个基于 **Nuxt 4 + Vue 3 + Canvas + WebSocket** 的无限地图多人扫雷游戏。

线上地址：[https://nuxt-minesweeper.mou7s.workers.dev](https://nuxt-minesweeper.mou7s.workers.dev)

## 功能

- **无限地图**：通过坐标哈希生成地雷，地图可以向任意方向延展。
- **Canvas 棋盘渲染**：棋盘主体使用 Canvas 绘制，减少大量 DOM 方块带来的渲染压力。
- **多人同步**：通过 Nitro WebSocket 同步玩家操作、排行榜和其他玩家光标。
- **账号系统**：支持注册、登录，密码使用 `scrypt` 哈希存储。
- **JWT 登录状态**：登录后使用 JWT 识别玩家身份。
- **排行榜**：安全翻开格子加 1 分，踩雷扣 10 分，排行榜实时更新。
- **玩家代表色**：用户注册时选择代表色，已翻开格子和插旗会显示对应玩家颜色。
- **基础音效**：使用 Web Audio API 合成翻开、插旗、爆炸音效。
- **地图操作**：支持拖拽移动、滚轮缩放、触屏拖动、双指缩放、长按插旗。
- **坐标传送**：可以输入坐标跳转到指定地图位置。
- **Cloudflare 部署**：项目已配置 Cloudflare Workers、Durable Object 和 KV。

## 技术栈

| 层级 | 技术 |
| --- | --- |
| 前端 | Nuxt 4, Vue 3, Nuxt UI, Tailwind CSS |
| 棋盘 | Canvas 2D |
| 实时通信 | Nitro WebSocket |
| 部署 | Cloudflare Workers |
| WebSocket 运行时 | Cloudflare Durable Object |
| 存储 | NuxtHub KV / Cloudflare KV |
| 认证 | JWT + `node:crypto` |
| 音效 | Web Audio API |

## 项目结构

```text
nuxtMinesweeper/
├── assets/
│   ├── audio.js          # Web Audio API 音效
│   ├── logic.ts          # 前端 WebSocket 与游戏状态
│   └── style.css         # 全局样式
├── components/
│   ├── AuthModal.vue     # 登录/注册弹窗
│   ├── MineBoard.vue     # Canvas 棋盘
│   ├── MineCell.vue      # 旧 DOM 单元组件
│   └── Footer.vue
├── pages/
│   └── index.vue         # 游戏主页面
├── server/
│   ├── api/auth/         # 登录/注册接口
│   ├── routes/ws.ts      # WebSocket 入口
│   └── utils/
│       ├── gameLogic.ts  # 服务端游戏逻辑
│       ├── jwt.ts        # JWT 签发与校验
│       └── userStore.ts  # 用户存储
├── scripts/
│   └── create-cloudflare-kv.mjs
├── DEPLOY_CLOUDFLARE.md
├── nuxt.config.ts
└── package.json
```

## 本地开发

环境要求：

- Node.js 18 或更高版本
- pnpm

安装依赖：

```bash
pnpm install
```

启动开发服务器：

```bash
pnpm dev
```

访问：

```text
http://localhost:3000
```

建议打开两个浏览器窗口测试多人同步。

## Cloudflare 部署

第一次部署前先登录 Cloudflare：

```bash
pnpm exec wrangler login
```

创建环境变量文件：

```bash
cp .env.example .env
```

生成并填写 `JWT_SECRET`：

```bash
openssl rand -base64 32
```

创建 Cloudflare KV，并自动写入 `.env`：

```bash
pnpm cf:kv:create
```

把 `JWT_SECRET` 上传到 Cloudflare Worker：

```bash
node - <<'NODE' | pnpm exec wrangler secret put JWT_SECRET --name nuxt-minesweeper
const fs = require('fs')
const env = fs.readFileSync('.env', 'utf8')
const match = env.match(/^JWT_SECRET=(.*)$/m)
if (!match || !match[1]) throw new Error('JWT_SECRET is missing in .env')
process.stdout.write(match[1].trim())
NODE
```

部署：

```bash
pnpm deploy
```

更详细的说明见 [DEPLOY_CLOUDFLARE.md](./DEPLOY_CLOUDFLARE.md)。

## 常用命令

```bash
pnpm dev                # 本地开发
pnpm build              # 普通 Nuxt 构建
pnpm build:cloudflare   # Cloudflare Workers 构建
pnpm preview:cloudflare # 使用 Wrangler 本地预览 Cloudflare 构建
pnpm deploy             # 构建并部署到 Cloudflare
pnpm cf:kv:create       # 创建 Cloudflare KV namespace 并写入 .env
```

## 交互

| 动作 | 桌面端 | 触屏端 |
| --- | --- | --- |
| 翻开格子 | 左键点击 | 短按 |
| 插旗/取消插旗 | 右键点击 | 长按 |
| 自动展开 | 左右键同时点击数字格 | 暂无 |
| 地图移动 | 鼠标拖拽 | 单指拖动 |
| 地图缩放 | 鼠标滚轮 | 双指缩放 |
| 随机传送 | 点击表情按钮 | 点击表情按钮 |
| 坐标传送 | 点击坐标栏后输入坐标 | 点击坐标栏后输入坐标 |

## 说明

- 前端不会保存地雷分布；点击、插旗和自动展开都通过 WebSocket 发送给服务端处理。
- 线上世界状态、玩家信息和积分通过 Cloudflare KV 持久化；本地开发使用 `.data/kv` 文件存储，避免普通 `pnpm dev` 依赖 Cloudflare Worker 的 `KV` binding。
- 世界棋盘状态通过 `WORLD_STATE_KEY` 区分：本地开发默认使用 `world-dev.json`，Cloudflare 部署默认使用 `world.json`。
- 当前项目没有测试套件，修改核心游戏逻辑后建议至少运行一次 `pnpm build:cloudflare`。

## License

MIT
