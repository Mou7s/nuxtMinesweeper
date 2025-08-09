# 使用 Node.js 20 Alpine 版本作为基础镜像
FROM node:20-alpine AS base

# 安装PNPM
RUN npm install -g pnpm

# 设置工作目录
WORKDIR /app

# 复制 package.json 文件
COPY package*.json ./
COPY pnpm-lock.yaml ./

# 安装依赖
RUN pnpm install --prod

# 复制应用代码
COPY . .

# 构建应用
RUN pnpm run build

# 暴露端口
EXPOSE 3000

# 启动应用
CMD ["pnpm", "start"]

