---
title: Twikoo Huggingface Space
emoji: 📚
colorFrom: yellow
colorTo: indigo
sdk: docker
pinned: false
app_port: 8080
---

# Twikoo Hugging Face Space（自定义域名用）

把本目录内容复制进 Hugging Face Space 仓库即可：`Dockerfile` 装全局 `tkserver`（跟随 `latest`）
并拉起 `cloudflared` tunnel（令牌走环境变量 `CF_ZERO_TRUST_TOKEN`），`start.sh` 负责同时启动两者。

完整步骤见文档站「Hugging Face 部署 → 如果你需要自定义域名」。
