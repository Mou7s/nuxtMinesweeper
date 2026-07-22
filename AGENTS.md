# AGENTS.md

本文件为在此仓库中工作的自动化编码代理提供项目约定。除非用户明确要求，否则请遵循以下规则。

## 项目概览

Infinite Minesweeper 是一个 Nuxt 4 / Vue 3 全栈应用。浏览器使用 Canvas 绘制无限棋盘，通过 `/ws` 与 Nitro WebSocket 服务端同步操作、排行榜和玩家光标。账号、积分和世界状态通过 NuxtHub KV 存储；Cloudflare 构建使用 Workers KV，本地开发使用 `.data/kv`。

## 关键文件

- `pages/index.vue`：主页面、HUD、传送、登录入口和性能面板。
- `components/MineBoard.vue`：Canvas 渲染、坐标换算、拖拽、缩放和触摸交互。
- `assets/logic.js`：客户端状态、WebSocket 协议、重连、认证和音效触发。
- `assets/audio.js`：Web Audio API 合成音效。
- `server/routes/ws.js`：WebSocket 连接、鉴权和广播入口。
- `server/utils/gameLogic.js`：服务端权威游戏规则、地图生成、计分及世界持久化。
- `server/utils/userStore.js`：用户和积分的 KV 读写。
- `server/utils/jwt.js`：JWT 签发与校验。
- `nuxt.config.js`：NuxtHub、Nitro、Cloudflare Workers、Durable Object 和 KV 配置。
- `DEPLOY_CLOUDFLARE.md`：线上部署细节。

`MineCell.vue`、`MineBlock.vue` 和 `Footer.vue` 当前不在主 Canvas 渲染路径中。修改前先确认是否仍有引用，不要把旧 DOM 实现误当成当前架构。

## 开发命令

使用 Bun；不要无故改用 npm 或 yarn，也不要手工编辑 `bun.lock`。

```bash
bun install
bun run dev
bun run build
bun run build:cloudflare
bun run preview:cloudflare
bun run test
```

仓库目前没有 `lint` 或独立 `typecheck` 脚本，但有 Node.js 核心单元测试。最小验证要求：

- 所有逻辑改动：运行 `bun run test`。
- 普通 UI 或客户端改动：运行 `bun run build`，并在浏览器中检查相关交互。
- WebSocket、存储、认证、Nitro 或 Cloudflare 配置改动：运行 `bun run build:cloudflare`；可用 `tests/multiplayer-smoke.mjs` 对隔离的本地 KV 做双客户端验证。
- 多人同步改动：至少用两个浏览器窗口验证连接、广播和重连。
- 触摸或坐标换算改动：同时验证点击、拖拽、滚轮/双指缩放、长按和负坐标。

不要用 `bun run generate` 验证部署；本项目依赖服务端运行时和 WebSocket。

## 架构约束

### 服务端是游戏状态权威

- 客户端只发送 `click`、`rightclick`、`autoexpand` 等动作，不能在浏览器端决定雷区、分数或最终格子状态。
- 地雷由服务端基于世界 seed 和坐标确定。修改生成算法会改变未探索区域，并可能破坏已有世界的一致性。
- WebSocket 消息格式同时由 `assets/logic.js`、`server/routes/ws.js` 和 `server/utils/gameProtocol.mjs` 使用；改动协议时必须同步更新，并兼容初始化、视野快照、增量更新、状态、光标和错误消息。
- 格子增量和视野快照使用 `compact-v1` 编码；不要只改编码端或解码端。视野快照必须保持分片，避免恢复全量大消息。
- 未登录用户可以查看地图，但动作与光标广播需要经过 JWT 身份识别。

### 坐标与渲染

- 逻辑坐标键统一使用 `${x},${y}` 字符串格式。
- `MineBoard.vue` 的 `screenToWorld`、`normalizeCamera`、`jumpTo` 和 Canvas transform 互相依赖；不要只改其中一处。
- 棋盘主体应继续使用 Canvas。不要为可见格子恢复大规模 Vue DOM 渲染。
- 高频路径应避免逐格动画、深层响应式结构、无界 DOM 节点或每帧分配大量临时对象。
- 保留 `requestAnimationFrame` 合并拖拽和绘制更新的方式，并关注高 DPI 画布尺寸。

### 状态与持久化

- 本地 KV 位于 `.data/kv`；它是运行时数据，不应提交。
- 本地默认旧世界键为 `world-dev.json`，Cloudflare 默认为 `world.json`，可通过 `WORLD_STATE_KEY` 覆盖；v2 数据位于独立的 `world-v2:<世界键>` 命名空间，避免 `fs-lite` 文件/目录冲突。
- 旧版单键世界会自动迁移为 v2 区块，修改加载逻辑时必须保留迁移和回退安全性。
- 脏区块保存有 2 秒防抖，积分保存有 500 毫秒批处理。修改异步保存逻辑时要避免丢失增量、重复计分和并发覆盖。
- `LOCAL_KV_BASE` 可为测试指定隔离目录；不要让自动化测试写入默认 `.data/kv`。
- `globalGameServer` 是进程级单例。Cloudflare WebSocket 由 Durable Object 承载，但不要假设所有长期活跃状态已经完整迁移到 Durable Object 存储。
- 不要提交 `.env`、真实 KV namespace ID、JWT 密钥、令牌或用户数据。新增环境变量时同步更新 `.env.example` 和相关文档。

### 安全

- 密码必须继续以 `scrypt` 哈希形式存储；不要记录密码、哈希、JWT 或认证请求正文。
- 生产环境必须设置强随机 `JWT_SECRET`，不能依赖开发回退值。
- 对来自 HTTP、WebSocket、localStorage 和环境变量的数据做边界校验，尤其是用户名、坐标、动作类型和 token。

## 代码风格

- 延续现有 JavaScript 和 Vue SFC 风格：Composition API、`<script setup>`、单引号、分号及清晰的早返回。
- 优先做小而集中的改动；不要在功能修复中顺便重写 UI 或协议。
- 用户可见文本目前中英文混用。修改现有流程时保持该区域的语言一致，不要无目的地全局翻译。
- 样式优先使用现有 Tailwind / Nuxt UI 模式和 `assets/style.css` 中的设计变量。
- 如果行为、命令、环境变量或部署流程变化，同步更新 `README.md`、`.env.example` 或 `DEPLOY_CLOUDFLARE.md`。

## 手动验收清单

涉及核心流程时，按改动范围检查：

1. 注册、登录、刷新后恢复登录和退出。
2. WebSocket 在线状态、断线后约 3 秒重连、初始快照加载。
3. 翻格、插旗/取消插旗、错误插旗、数字格自动展开及积分变化。
4. 两个窗口之间的格子、排行榜和光标同步。
5. 拖拽、缩放、随机传送、坐标传送和相机位置恢复。
6. `?debug=perf` 性能面板及浏览器控制台是否出现大消息或慢操作警告。
