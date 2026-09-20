# Twikoo 2.0 自托管镜像（D-13 / §4.3.3）
#
# 与 1.x 的差异：**从 workspace 构建**（pnpm install + 构建本仓 tkserver），
# 而不是 `npm install tkserver@latest` 拉取 npm 上的已发布版本——保证镜像内的
# 代码与本次 Release 的 tag 一致（publish.yml 的 docker job 会先覆写版本号再 build）。
#
# 多阶段：build 阶段装依赖并构建；runtime 阶段只保留运行所需内容。
# 镜像体积优化（`pnpm deploy --prod` / 裁剪 devDependencies）留待容器冒烟时验证。

ARG NODE_IMAGE=node

# ---- 构建阶段 ----
FROM ${NODE_IMAGE}:26-alpine AS build
WORKDIR /app
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable pnpm
# 先只复制清单，利用层缓存（源码变更不会重装依赖）
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages ./packages
COPY docs/package.json ./docs/package.json
RUN pnpm install --frozen-lockfile
# 构建 tkserver 及其依赖（@twikoojs/common、@twikoojs/shared、pushoo）
RUN pnpm --filter "tkserver..." build

# ---- 运行阶段 ----
FROM ${NODE_IMAGE}:26-alpine
WORKDIR /app
ENV NODE_ENV=production
# 运行期只需要 workspace 的 node_modules 链接结构与已构建的产物
COPY --from=build /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
RUN mkdir -p /app/data
ENV TWIKOO_DATA=/app/data
EXPOSE 8080
CMD ["node", "packages/server-self-hosted/dist/server.js"]
