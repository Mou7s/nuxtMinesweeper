# 🚩 Infinite Multiplayer Minesweeper

> 一个基于 **Nuxt 4 + Vue 3 + WebSocket** 构建的无限地图多人在线扫雷游戏。

[![Nuxt](https://img.shields.io/badge/Nuxt-4-00DC82?logo=nuxt.js)](https://nuxt.com)
[![Vue](https://img.shields.io/badge/Vue-3-42b883?logo=vue.js)](https://vuejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript)](https://www.typescriptlang.org)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4-06B6D4?logo=tailwindcss)](https://tailwindcss.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

🌐 **Demo**: [nuxtminesweeper.netlify.app](https://nuxtminesweeper.netlify.app/)

---

## ✨ 核心特性

- 🌌 **无限地图** — 基于坐标哈希的程序化生成，地图向四面八方无限延展，永无边界。
- ⚔️ **多人实时联机** — WebSocket 全双工通讯，多名玩家在同一张地图上实时协作扫雷。
- 🛡️ **服务端防作弊** — 前端仅负责渲染和发送指令，所有地雷判定与分数计算在服务端完成。
- 💀 **永动生存模式** — 没有 Game Over！踩雷扣 10 分，安全翻开 +1 分，存活即正义。
- 🔊 **程序化音效** — 零资源文件，纯 Web Audio API 合成的挖雷、插旗、爆炸音效。
- 🗺️ **实时坐标显示** — 拖拽平移地图时实时显示当前视口坐标。
- 🎯 **重生传送** — 点击笑脸随机传送至新大陆，积分不清零。
- 🏆 **实时排行榜** — 在线玩家分数实时排名，竞技感拉满。
- 🔐 **用户系统** — 注册/登录体系，JWT 身份验证，玩家数据 AES-256-GCM 加密存储。
- 📱 **触屏支持** — 单指滑动拖拽地图、短按翻开、长按插旗。

## 🛠️ 技术栈

| 层级 | 技术 |
| --- | --- |
| 框架 | Nuxt 4 + Vue 3 (Composition API) |
| UI | Nuxt UI + TailwindCSS |
| 通讯 | Nitro WebSocket (`defineWebSocketHandler`) |
| 认证 | JWT (HS256) + `crypto.scrypt` 密码哈希 |
| 加密 | AES-256-GCM 用户数据加密 |
| 音效 | Web Audio API (程序化合成) |
| 持久化 | Nitro `unstorage` (文件系统) |
| 工具库 | VueUse (`@vueuse/nuxt`) |
| 包管理 | pnpm |

## 📁 项目结构

```
nuxtMinesweeper/
├── assets/
│   ├── logic.ts          # 前端 WebSocket 客户端控制器 (GamePlay 类)
│   ├── audio.js          # 程序化音效合成器 (Web Audio API)
│   └── style.css         # 全局样式 & CSS 变量
├── components/
│   ├── MineBoard.vue     # 无限地图视口 + 拖拽引擎（鼠标 + 触屏）
│   ├── MineCell.vue      # 单个方块的渲染与交互（长按插旗）
│   ├── MineBlock.vue     # 方块内容显示（数字/旗帜/地雷）
│   ├── AuthModal.vue     # 登录/注册弹窗
│   └── Footer.vue        # 页脚
├── composables/          # Vue 组合式函数
├── pages/
│   └── index.vue         # 游戏主页面（HUD 面板 + 排行榜 + 坐标显示）
├── layouts/
│   └── default.vue       # 默认布局
├── server/
│   ├── api/auth/
│   │   ├── login.post.ts    # 登录 API（返回 JWT token）
│   │   └── register.post.ts # 注册 API（返回 JWT token）
│   ├── routes/
│   │   └── ws.ts            # WebSocket 路由（JWT 验证 + 消息处理）
│   └── utils/
│       ├── gameLogic.ts     # 服务端游戏核心引擎（全局单例）
│       ├── jwt.ts           # JWT token 签发与验证 (HS256)
│       └── userStore.ts     # 用户数据存储 (AES-256-GCM 加密 + scrypt)
├── data/
│   └── world.json           # 世界数据持久化文件
├── nuxt.config.ts           # Nuxt 配置（含 Nitro WebSocket 开关）
├── app.config.ts            # 应用配置
├── tailwindcss.config.js    # TailwindCSS 配置
└── package.json
```

## 🏗️ 架构说明

```
┌──────────────┐     WebSocket      ┌──────────────────┐
│   Browser A  │ ◄════════════════► │                  │
│  (渲染 + 指令) │                    │  Nitro Server    │
└──────────────┘                    │                  │
                                    │  GameServer 单例  │
┌──────────────┐     WebSocket      │  (内存中运行)      │
│   Browser B  │ ◄════════════════► │                  │
│  (渲染 + 指令) │                    │  + UserStore     │
└──────────────┘                    └──────────────────┘
         │                                   │
         │          ┌───────────┐            │
         └──────────│ Auth API  │────────────┘
                    │ (RESTful) │
                    └───────────┘
```

- **前端** 只发送操作指令 (`click` / `rightclick` / `autoexpand`)，不做任何逻辑计算。
- **服务端** 持有唯一的游戏状态，计算结果后通过 WebSocket 向所有广播。
- **认证** 登录/注册通过 RESTful API + JWT token，WebSocket 连接通过 JWT 验证身份。
- **地雷密度**: 15%（`rand < 0.15`），基于 Mulberry32 伪随机数生成器 + 坐标哈希种子。
- **持久化**: 通过 Nitro `unstorage` 将世界数据（已翻开/已插旗的格子）写入 `data/world.json`，延迟 2 秒防抖保存。

## 🔒 安全性

> ⚠️ 本项目处于**演示/开发阶段**，不建议在生产环境中使用。

| 已修复 | 措施 |
| --- | --- |
| ✅ | 密码哈希：`crypto.scrypt` + 16 字节随机盐 + `timingSafeEqual` |
| ✅ | 身份验证：HS256 JWT token（7 天有效期） |
| ✅ | 数据加密：用户数据 AES-256-GCM 加密后写入文件系统 |
| ✅ | WebSocket：连接时验证 JWT token，无 token 拒绝操作 |

| 待修复 | 说明 |
| --- | --- |
| 🔴 | 无 HTTPS — 部署到 Netlify/Vercel 后自动解决 |
| 🟡 | 无登录速率限制 — 可通过中间件添加 |
| 🟡 | JWT 密钥随机生成（重启后失效）— 生产环境需设置 `ENCRYPTION_KEY` 环境变量 |

## 🚀 快速开始

### 环境要求

- **Node.js** >= 18.x
- **pnpm** >= 8.x

### 安装 & 运行

```bash
# 克隆仓库
git clone https://github.com/Mou7s/nuxtMinesweeper.git
cd nuxtMinesweeper

# 安装依赖
pnpm install

# 启动开发服务器（含 WebSocket）
pnpm dev

# 构建生产版本
pnpm build

# 预览生产版本
pnpm preview
```

启动后访问 `http://localhost:3000`，再开一个浏览器窗口访问同一地址即可体验多人联机。

## 🎮 游戏玩法

| 操作（桌面端） | 操作（触屏） | 效果 |
| --- | --- | --- |
| 左键点击 | 短按 | 翻开格子（踩雷 -10 分，安全 +1 分） |
| 右键点击 | 长按 | 插旗 / 取消插旗 |
| 双击已翻开格子 | — | 自动展开（周围旗帜数 = 地雷数时） |
| 鼠标拖拽空白区域 | 单指滑动 | 平移地图视口 |
| 点击 😊 笑脸 | 点击 😊 笑脸 | 随机传送到新大陆重生 |

## 📋 开发计划

### 已完成 ✅

- [x] 核心扫雷逻辑（布雷、计数、泛洪展开）
- [x] 用户交互（左键翻开、右键插旗、双击自动展开）
- [x] 无限地图（视口渲染 + 鼠标拖拽 + 坐标哈希种子生成）
- [x] 多人实时联机（WebSocket 全双工 + 服务端状态同步）
- [x] 永动生存模式（踩雷扣分 + 安全翻开奖分）
- [x] 用户系统（注册/登录 + JWT 认证 + AES-256-GCM 加密存储）
- [x] 程序化音效（Web Audio API 合成）
- [x] 实时排行榜
- [x] 触屏设备支持（单指滑动拖拽、短按翻开、长按插旗）

### 接下来建议做 🔜

> 按 **投入产出比** 排序，推荐优先完成前 3 项。

#### 🏆 P0 — 高价值、低投入（建议本周完成）

1. **部署到 Netlify** — 配置 `netlify.toml`，设置 `ENCRYPTION_KEY` 环境变量，让 Demo 始终可用
2. **音效开关 & 音量控制** — 添加一个静音按钮到 HUD 面板，移动端友好
3. **登录速率限制** — 服务端中间件限制每 IP 每分钟最多 5 次登录尝试

#### 🎯 P1 — 高价值、中等投入（建议 1-2 周）

4. **多玩家光标实时显示** — WebSocket 广播鼠标位置，其他玩家可见带颜色标注的光标
5. **地图缩放功能** — 支持 Ctrl+滚轮 / 双指捏合缩放，小屏也能看清全局
6. **已翻开格子归属美化** — 用渐变色/图案标识不同玩家翻开的区域

#### 🔮 P2 — 大功能、长期规划（按需推进）

7. **房间系统** — 创建/加入私人房间，独立地图和排行
8. **聊天系统** — 全局/房间内文字消息
9. **成就系统** — 首次踩雷、连续安全翻开 100 格等
10. **世界热力图** — 可视化所有已探索区域的密度分布
11. **数据库迁移** — SQLite / PostgreSQL 替换文件存储，支持更大规模

## 🤝 参与贡献

欢迎提交 Issue 和 Pull Request！

```bash
# Fork 本仓库
# 创建功能分支
git checkout -b feature/your-feature

# 提交更改
git commit -m "feat: add your feature"

# 推送到远程
git push origin feature/your-feature

# 创建 Pull Request
```

## 📄 License

MIT