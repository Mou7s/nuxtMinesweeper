# Infinite Minesweeper

一个基于 **Nuxt 4、Vue 3、Canvas 与 WebSocket** 的无限地图多人扫雷游戏。

线上体验：[infiniteminesweeper.mou7s.com](https://infiniteminesweeper.mou7s.com)

## 特性

- 坐标哈希生成雷区，可向任意方向探索的无限世界
- Canvas 2D 棋盘渲染，支持高 DPI 屏幕
- 按视野订阅 32×32 世界区块，只同步附近格子和玩家光标
- 支持鼠标、触摸、拖拽、滚轮缩放、双指缩放和长按插旗
- 注册与登录、JWT 身份识别、`scrypt` 密码哈希
- NuxtHub KV 持久化用户、积分和世界状态
- Web Audio API 合成翻格、插旗、失误和爆炸音效
- 内置操作帮助、音效开关、明暗主题和可分享的坐标链接
- HUD 显示已认证在线玩家数和 WebSocket 心跳延迟
- 已配置 Cloudflare Workers、Durable Object 与 Workers KV 部署

## 游戏规则

登录后才能操作棋盘和广播光标。服务端是雷区和积分的唯一权威：

- 安全翻开一个格子：`+1` 分
- 踩中地雷：`-10` 分
- 在非雷格上插旗：该格会被揭示，并扣 `3` 分
- 对已揭示数字格执行自动展开时，若相邻旗帜数等于数字，会翻开其余相邻格

世界没有传统的“通关”或全局结束状态；点击顶部表情按钮会随机传送到新区域，而不是清空世界。

## 技术栈

| 层级 | 技术 |
| --- | --- |
| 应用框架 | Nuxt 4、Vue 3 |
| UI | Nuxt UI、Tailwind CSS 4 |
| 棋盘 | Canvas 2D |
| 实时通信 | Nitro WebSocket |
| 认证 | 自实现 HS256 JWT、Node.js `crypto` |
| 存储 | NuxtHub KV；本地 `fs-lite` / 线上 Cloudflare KV |
| 部署 | Cloudflare Workers、Durable Object |

## 快速开始

### 环境要求

- Node.js 20 或更高版本
- pnpm

### 安装与运行

```bash
pnpm install
cp .env.example .env
pnpm dev
```

打开 [http://localhost:3000](http://localhost:3000)。建议同时打开两个浏览器窗口测试多人同步。

本地开发不需要 Cloudflare 账号：NuxtHub 会把 KV 数据写入 `.data/kv`。首次运行可以暂时留空 `CLOUDFLARE_KV_NAMESPACE_ID`，但建议在 `.env` 中设置开发用 `JWT_SECRET`。

```env
CLOUDFLARE_KV_NAMESPACE_ID=
WORLD_STATE_KEY=
LOCAL_KV_BASE=
JWT_SECRET=replace_with_a_long_random_secret
```

可用以下命令生成随机密钥：

```bash
openssl rand -base64 32
```

## 操作方式

| 动作 | 桌面端 | 触屏端 |
| --- | --- | --- |
| 翻开格子 | 左键点击 | 短按 |
| 插旗/取消插旗 | 右键点击 | 长按约 400 ms |
| 自动展开数字格 | 再次左键点击 | 再次短按 |
| 移动地图 | 左键或中键拖拽 | 单指拖动 |
| 缩放地图 | 鼠标滚轮或右下角按钮 | 双指缩放 |
| 随机传送 | 点击顶部表情 | 点击顶部表情 |
| 坐标传送 | 点击顶部坐标栏 | 点击顶部坐标栏 |

相机坐标、登录 token 和用户摘要保存在浏览器 `localStorage` 中。开发环境会自动显示性能面板；其他环境可在 URL 后添加 `?debug=perf`。

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `pnpm dev` | 启动 Nuxt 开发服务器并监听所有网卡 |
| `pnpm build` | 构建普通 Nuxt 产物 |
| `pnpm preview` | 预览普通构建产物 |
| `pnpm build:cloudflare` | 使用 `cloudflare-durable` preset 构建 |
| `pnpm preview:cloudflare` | 构建后使用 Wrangler 本地预览 |
| `pnpm cf:kv:create` | 创建 KV namespace 并写入 `.env` |
| `pnpm deploy` | 构建并部署到 Cloudflare |
| `pnpm test` | 运行坐标分块、雷区生成和输入校验测试 |
| `pnpm test:smoke` | 在隔离 KV 中启动服务并运行双客户端端到端测试 |

修改普通前端代码后至少运行 `pnpm test && pnpm build`；修改 WebSocket、存储、认证或 Cloudflare 配置后运行 `pnpm test && pnpm build:cloudflare`，并进行双窗口手动验证。

> 不要使用 `pnpm generate` 部署本项目；多人同步、认证和 KV 都依赖服务端运行时。

## 项目结构

```text
.
├── assets/
│   ├── audio.js                 # Web Audio API 音效
│   ├── logic.js                 # 客户端状态与 WebSocket 协议
│   └── style.css                # 全局样式和设计变量
├── components/
│   ├── AuthModal.vue            # 登录/注册弹窗
│   └── MineBoard.vue            # Canvas 棋盘与交互
├── pages/index.vue              # 游戏主页面和 HUD
├── server/
│   ├── api/auth/                # 注册、登录 HTTP API
│   ├── routes/ws.js             # WebSocket 入口
│   └── utils/
│       ├── gameLogic.js         # 权威游戏逻辑和世界状态
│       ├── gameProtocol.mjs     # 区块、视野和消息参数约束
│       ├── mineGenerator.mjs    # 确定性雷区生成
│       ├── jwt.js               # JWT 签发与验证
│       └── userStore.js         # 用户及积分存储
├── tests/                        # Node.js 单元测试和多人冒烟测试
├── scripts/create-cloudflare-kv.mjs
├── .env.example
├── DEPLOY_CLOUDFLARE.md
└── nuxt.config.js
```

`MineCell.vue`、`MineBlock.vue` 和 `Footer.vue` 是目前未接入主 Canvas 渲染路径的遗留组件。

## 数据流与持久化

```text
浏览器操作
   │  viewport / action / cursor / identify
   ▼
/ws (Nitro WebSocket)
   │
   ▼
GameServer（校验动作、生成雷区、计分）
   ├── 广播 init / update / cursor 给客户端
   └── 通过 NuxtHub KV 保存世界、用户和积分
```

- 前端不会决定地雷分布，只会显示当前视野区块内服务端返回的已揭示或已插旗格子。
- 本地世界默认使用 KV 键 `world-dev.json`，Cloudflare 构建默认使用 `world.json`。
- 可用 `WORLD_STATE_KEY` 显式指定世界键，避免不同环境共享同一世界。
- 每个世界在独立的 `world-v2:<世界键>` 命名空间中使用一个元数据记录和多个 `32×32` 区块记录；旧版单文件世界会在首次加载时自动迁移，旧记录暂时保留用于回退。
- 只写入本次变更过的区块，写入有约 2 秒防抖；积分增量约 500 ms 批量持久化。
- 服务端最多缓存 256 个干净区块，客户端在视野快照切换时回收远处格子。
- 单次动作最多广播 500 个格子；遇到被截断的零区，可再次点击已揭示格继续展开。
- 视野快照按每批两个区块分片发送，格子增量使用 `compact-v1` 数组格式，避免大世界产生单条超大消息。
- 客户端每 10 秒发送一次轻量心跳；HUD 的在线人数只统计已登录并完成身份识别的玩家，不包含游客连接。
- 活跃多人状态目前仍由进程级 `globalGameServer` 单例维护。WebSocket 在 Cloudflare Durable Object 中运行，但长期状态尚未完全迁移到 Durable Object 存储。

测试时可设置 `LOCAL_KV_BASE` 指向临时目录，从而不污染日常开发账号和世界：

```bash
LOCAL_KV_BASE=/tmp/minesweeper-test pnpm dev
```

## Cloudflare 部署

```bash
pnpm exec wrangler login
cp .env.example .env
pnpm cf:kv:create
pnpm preview:cloudflare
pnpm deploy
```

部署前请确认：

- `.env` 中有正确的 `CLOUDFLARE_KV_NAMESPACE_ID`
- Worker 环境已设置强随机 `JWT_SECRET`
- Cloudflare KV binding 名称为 `KV`
- `nuxt.config.js` 中的 Worker 名称和自定义域名符合你的账号配置

完整步骤、GitHub Actions secrets 和故障排查见 [DEPLOY_CLOUDFLARE.md](./DEPLOY_CLOUDFLARE.md)。

## 安全提示

- 不要提交 `.env`、JWT 密钥、Cloudflare 凭据或 `.data/kv`。
- `server/utils/jwt.js` 中的回退密钥仅供本地开发；生产环境必须提供 `JWT_SECRET`。
- JWT 有效期为 7 天，浏览器会把 token 保存到 `localStorage`。

## 参与开发

自动化编码代理和贡献者请先阅读 [AGENTS.md](./AGENTS.md)，其中说明了项目的权威状态边界、验证要求和性能约束。

本仓库当前未包含许可证文件；在添加明确许可证前，请勿假定代码可按某个开源许可证再分发。
