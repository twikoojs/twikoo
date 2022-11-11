# Twikoo 私有部署服务端

## 安装

```
npm i -g tkserver
```

## 启动

```
tkserver
```

## 环境变量

| 名称 | 描述 | 默认值 |
| ---- | ---- | ---- |
| `TWIKOO_DATA` | 数据库存储路径 | `./data` |
| `TWIKOO_PORT` | 端口号 | `8080` |
| `TWIKOO_THROTTLE` | IP 请求限流，当同一 IP 短时间内请求次数超过阈值将对该 IP 返回错误 | `250` |
| `TWIKOO_LOCALHOST_ONLY` | 为`true`时只监听本地请求，使得 nginx 等服务器反代之后不暴露原始端口 | `null` |
