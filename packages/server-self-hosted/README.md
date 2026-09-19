# tkserver

Twikoo 2.0 服务端适配器。业务逻辑在 `@twikoojs/common`，本包仅做平台入口与注入。

## 部署（自托管 / Docker / pkg）

```bash
npm i -g tkserver
tkserver            # 默认监听 ::8080
```

Docker：`docker run -d -p 8080:8080 -v /data:/app/data imaegoo/twikoo`
数据目录：`TWIKOO_DATA`（缺省 ./data，LokiJS 文件库 db.json）

## 平台核对清单（查阅日期 2026-09-17）

- [x] HTTP server 与信号处理（SIGTERM/SIGINT 优雅退出，关闭期间 503）——nodejs.org/api
- [x] 容器内环境变量与数据目录挂载（TWIKOO_DATA）
- [x] 限流计数定时清理（TWIKOO_REQ_TIMES_CLEAR_TIME 缺省 10 分钟）
- [ ] Docker arm32v7 镜像实测（人工项）
- [ ] pkg/SEA 单文件运行时实测（人工项）

## 环境

- `TWIKOO_PORT`（8080）、`TWIKOO_HOST`（::）、`TWIKOO_LOCALHOST_ONLY`
- `MONGODB_URI`（可选，设置后改用 Mongo）
- `TWIKOO_DATA`（Loki 数据目录）、`TWIKOO_SHUTDOWN_TIMEOUT`
- `TWIKOO_SEED=1`（demo 数据）
