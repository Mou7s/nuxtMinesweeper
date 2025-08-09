# 基础阶段：设置环境和 Corepack
FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# 复制项目文件并设置工作目录
COPY . /app
WORKDIR /app

# 生产依赖阶段：仅安装生产依赖
FROM base AS prod-deps
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile

# 构建阶段：安装所有依赖并构建应用
FROM base AS build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm run build

# 最终生产阶段：复制必要文件并运行
FROM base
COPY --from=prod-deps /app/node_modules /app/node_modules
COPY --from=build /app/.output /app/.output  # Nuxt 3 的构建输出
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]  # 直接运行 Nitro 服务器
