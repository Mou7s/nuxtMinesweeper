# 🚩 Infinite Multiplayer Minesweeper

> 一个基于 **Nuxt 4 + Vue 3 + WebSocket** 构建的无限地图多人在线扫雷游戏。

Demo: [nuxtminesweeper.netlify.app](https://nuxtminesweeper.netlify.app/)

## ✨ 核心特性

- 🌌 **无限地图** — 基于坐标哈希的程序化生成，地图向四面八方无限延展，永无边界。
- ⚔️ **多人实时联机** — WebSocket 全双工通讯，多名玩家在同一张地图上实时协作扫雷。
- 🛡️ **服务端防作弊** — 前端仅负责渲染和发送指令，所有地雷判定与分数计算在服务端完成。
- 💀 **永动生存模式** — 没有 Game Over！踩雷扣 10 分，安全翻开 +1 分，存活即正义。
- 🔊 **程序化音效** — 零资源文件，纯 Web Audio API 合成的挖雷、插旗、爆炸音效。
- 🗺️ **实时坐标显示** — 拖拽平移地图时实时显示当前视口坐标。
- 🎯 **重生传送** — 点击笑脸随机传送至新大陆，积分不清零。

## 🛠️ 技术栈

| 层级 | 技术 |
| --- | --- |
| 框架 | Nuxt 4 + Vue 3 (Composition API) |
| UI | Nuxt UI + TailwindCSS |
| 通讯 | Nitro WebSocket (`defineWebSocketHandler`) |
| 音效 | Web Audio API (程序化合成) |
| 工具库 | VueUse (`@vueuse/nuxt`) |
| 包管理 | pnpm |

## 📁 项目结构

```
nuxtMinesweeper/
├── assets/
│   ├── logic.js          # 前端 WebSocket 客户端控制器
│   ├── audio.js          # 程序化音效合成器 (Web Audio API)
│   └── style.css         # 全局样式
├── components/
│   ├── MineBoard.vue     # 无限地图视口 + 拖拽引擎
│   ├── MineCell.vue      # 单个方块的渲染与交互
│   ├── MineBlock.vue     # 方块内容显示（数字/旗帜/地雷）
│   └── Footer.vue        # 页脚
├── pages/
│   └── index.vue         # 游戏主页面（积分面板 + 坐标显示）
├── server/
│   ├── routes/ws.ts      # WebSocket 路由（连接/广播/消息处理）
│   └── utils/gameLogic.ts # 服务端游戏核心引擎（全局单例）
├── nuxt.config.ts        # Nuxt 配置（含 Nitro WebSocket 开关）
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
│  (渲染 + 指令) │                    └──────────────────┘
└──────────────┘
```

- **前端** 只发送操作指令 (`click` / `rightclick` / `autoexpand`)，不做任何逻辑计算。
- **服务端** 持有唯一的游戏状态，计算结果后通过 WebSocket 向所有玩家广播。

## 🚀 快速开始

```bash
# 安装依赖
pnpm install

# 启动开发服务器（含 WebSocket）
pnpm dev

# 构建生产版本
pnpm build
```

启动后访问 `http://localhost:3000`，再开一个浏览器窗口访问同一地址即可体验多人联机。

## 📋 开发计划

### 阶段一：单机基础版 ✅
- [x] 核心扫雷逻辑（布雷、计数、泛洪展开）
- [x] 用户交互（左键翻开、右键插旗、双击自动展开）

### 阶段二：无限地图 ✅
- [x] 视口渲染 + 鼠标拖拽平移
- [x] 基于随机种子 (Seed) 的坐标哈希程序化生成

### 阶段三：多人联机 🔧
- [x] 永动生存模式（废除 Game Over，积分惩罚制）
- [x] 服务端核心引擎迁移 (`server/utils/gameLogic.ts`)
- [x] WebSocket 实时通讯通道 (`server/routes/ws.ts`)
- [x] 前端降级为纯渲染器（100% 防作弊）
- [x] 程序化音效系统
- [ ] 服务端数据持久化（Nitro `unstorage`）
- [ ] 多玩家光标实时显示

## 📄 License

MIT
