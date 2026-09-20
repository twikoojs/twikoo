# Twikoo 2.0 自托管镜像：装 npm 上已发布的 tkserver，与 1.x 一致。
# 版本由 publish.yml 的 docker job 以 TWIKOO_VERSION build-arg 传入（docker 构建排在
# npm verify 之后，镜像内容即该版本在 npm 上的产物）；不传则装 latest。

ARG NODE_IMAGE=node

# 装依赖（npm 缓存留在本阶段，不进运行镜像）
FROM ${NODE_IMAGE}:26-alpine AS build
WORKDIR /app
ARG TWIKOO_VERSION=latest
RUN set -eux; npm install --omit=dev "tkserver@${TWIKOO_VERSION}"

FROM ${NODE_IMAGE}:26-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV TWIKOO_DATA=/app/data
COPY --from=build /app .
RUN mkdir -p /app/data
EXPOSE 8080
CMD ["/app/node_modules/.bin/tkserver"]
