# Nuxt 3 Minesweeper game

A minesweeper game made by vue 3 & nuxt 3 & nuxt ui

demo website:[https://nuxtMinesweeper.netlify.app](https://nuxtminesweeper.netlify.app/)

## 项目结构 (Project Structure)

当前项目基于 **Nuxt 4** 与 **Vue 3** 构建，结合了 Tailwind CSS。主要目录和文件的作用如下：

- **`app.vue`**: 应用的主入口。定义了网页全局骨架、背景颜色适配以及网站的 SEO Meta 标题等信息。
- **`nuxt.config.ts`**: Nuxt 核心配置文件。配置了全局 CSS，并注册了 `@nuxt/ui` (现成 UI 组件库) 和 `@vueuse/nuxt` (强大的交互辅助函数库) 等模块。
- **`package.json`**: 项目的依赖清单。记录了开发所需的所有第三方包（如用于胜利庆祝的 `vue-confetti-explosion`）。
- **`TODO.md`**: 我们规划的开发计划书。记录了扫雷项目从单机 MVP 走向无限地图与多人联机的演进路线。
- **`pages/`**: 页面路由目录。存放各个网页，我们稍后要开发的扫雷游戏界面（如 `index.vue`）将存放在这里。
- **`components/`**: 组件目录。存放可随意组合复用的 Vue 组件（例如我们可以把每一个扫雷格子、或者是雷区面板抽离放在这里）。
- **`server/`**: 服务端目录。为项目第三阶段的“多人联机”预留，未来后端的 API 接口和 WebSocket 逻辑会放在这里。
- **`assets/` & `public/`**: 静态资源库。`assets` 存放需要框架编译的文件 (比如你的 `style.css`)，`public` 存放供浏览器直接访问的文件（比如 favicon.ico 图片）。

## Setup

Make sure to install the dependencies:

```bash

# pnpm
pnpm install

``` 

## Development Server

Start the development server on `http://localhost:3000`:

```bash

# pnpm
pnpm dev

```
