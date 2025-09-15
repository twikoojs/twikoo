# Twikoo Docker镜像
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 复制package.json和yarn.lock
COPY package.json yarn.lock ./

# 安装生产依赖
RUN yarn install --production --frozen-lockfile

# 复制必要的文件
COPY src/ ./src/
COPY dist/ ./dist/

# 创建数据目录
RUN mkdir -p /app/data

# 暴露端口
EXPOSE 8080

# 设置环境变量
ENV NODE_ENV=production
ENV TWIKOO_DATA_PATH=/app/data

# 启动命令
CMD ["node", "src/server/self-hosted/server.js"]