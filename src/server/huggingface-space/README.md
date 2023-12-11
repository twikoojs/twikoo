---
title: Twikoo Huggingface Space
emoji: 📚
colorFrom: yellow
colorTo: indigo
sdk: docker
pinned: false
app_port: 8080
---

# Twikoo Huggingface Space部署

## 安装

1.在Huggingface创建一个Space，可视化必须为Public
2.在Space中添加`MONGODB_URI`环境变量
3.clone Huggingface Space仓库
4.clone主仓库，进入该目录，将该目录下的所有文件（不包括.git文件夹）复制到Huggingface Space仓库中
5.push Huggingface Space仓库
6.在Huggingface Space页面中右键，选择查看框架源代码，获取真实部署url
7.前端url配置方式与其他部署方式相同（url末尾不要带有任何字符串）
8.开始享受Twikoo！

## 环境变量

| 名称 | 描述 | 默认值 |
| ---- | ---- | ---- |
| `MONGODB_URI` | MongoDB 数据库连接字符串 *必须 | `null` |
| `TWIKOO_THROTTLE` | IP 请求限流，当同一 IP 短时间内请求次数超过阈值将对该 IP 返回错误 | `250` |
| `TWIKOO_LOG_LEVEL` | 日志级别，支持 `verbose` / `info` / `warn` / `error` | `info` |
| `TWIKOO_IP_HEADERS` | 在一些特殊情况下使用，如使用了`CloudFlare CDN` 它会将请求 IP 写到请求头的 `cf-connecting-ip` 字段上，为了能够正确的获取请求 IP 你可以写成 `['headers.cf-connecting-ip']` | `[]` |

在构建前请确保已经添加`MONGODB_URI`环境变量，否则可能出现不可预估的错误