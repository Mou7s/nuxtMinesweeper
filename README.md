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
- 🔐 **用户系统** — 注册/登录体系，玩家数据持久化存储。

## 🛠️ 技术栈

| 层级 | 技术 |
| --- | --- |
| 框架 | Nuxt 4 + Vue 3 (Composition API) |
| UI | Nuxt UI + TailwindCSS |
| 通讯 | Nitro WebSocket (`defineWebSocketHandler`) |
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
│   ├── MineBoard.vue     # 无限地图视口 + 拖拽引擎
│   ├── MineCell.vue      # 单个方块的渲染与交互
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
│   │   ├── login.post.ts    # 登录 API
│   │   └── register.post.ts # 注册 API
│   ├── routes/
│   │   └── ws.ts            # WebSocket 路由（连接/广播/消息处理）
│   └── utils/
│       ├── gameLogic.ts     # 服务端游戏核心引擎（全局单例）
│       └── userStore.ts     # 用户数据存储管理
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
- **地雷密度**: 15%（`rand < 0.15`），基于 Mulberry32 伪随机数生成器 + 坐标哈希种子。
- **持久化**: 通过 Nitro `unstorage` 将世界数据（已翻开/已插旗的格子）写入 `data/world.json`，延迟 2 秒防抖保存。

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

| 操作 | 效果 |
| --- | --- |
| **左键点击** | 翻开格子（踩雷 -10 分，安全 +1 分） |
| **右键点击** | 插旗 / 取消插旗 |
| **双击已翻开格子** | 自动展开（当周围旗帜数 = 地雷数时） |
| **鼠标拖拽** | 平移地图视口 |
| **点击 😊 笑脸** | 随机传送到新大陆重生 |

## 📋 开发计划

### 阶段一：单机基础版 ✅
- [x] 核心扫雷逻辑（布雷、计数、泛洪展开）
- [x] 用户交互（左键翻开、右键插旗、双击自动展开）

### 阶段二：无限地图 ✅
- [x] 视口渲染 + 鼠标拖拽平移
- [x] 基于随机种子 (Seed) 的坐标哈希程序化生成

### 阶段三：多人联机 ✅
- [x] 永动生存模式（废除 Game Over，积分惩罚制）
- [x] 服务端核心引擎迁移 (`server/utils/gameLogic.ts`)
- [x] WebSocket 实时通讯通道 (`server/routes/ws.ts`)
- [x] 前端降级为纯渲染器（100% 防作弊）
- [x] 程序化音效系统
- [x] 用户注册/登录系统
- [x] 服务端数据持久化（Nitro `unstorage`）
- [x] 实时排行榜

### 阶段四：体验优化 🚧
- [ ] 多玩家光标实时显示
- [ ] 触屏设备支持（移动端手势操作）
- [ ] 地图缩放功能
- [ ] 已翻开格子的归属高亮 / 足迹轨迹
- [ ] 音效开关 & 音量控制

### 阶段五：高级功能 🔮
- [ ] 房间系统（创建/加入私人房间）
- [ ] 区域占领模式（按翻开面积计算领地）
- [ ] 成就系统（首次踩雷、连续安全翻开等）
- [ ] 聊天系统（全局/房间内消息）
- [ ] 世界地图热力图（可视化已探索区域）
- [ ] 数据库迁移（SQLite / PostgreSQL 替换文件存储）

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