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
| `MONGODB_URI` | MongoDB 数据库连接字符串，不传则使用 lokijs | `null` |
| `MONGO_URL` | MongoDB 数据库连接字符串，不传则使用 lokijs | `null` |
| `TWIKOO_DATA` | lokijs 数据库存储路径 | `./data` |
| `TWIKOO_PORT` | 端口号 | `8080` |
| `TWIKOO_THROTTLE` | IP 请求限流，当同一 IP 短时间内请求次数超过阈值将对该 IP 返回错误 | `250` |
| `TWIKOO_LOCALHOST_ONLY` | 为`true`时只监听本地请求，使得 nginx 等服务器反代之后不暴露原始端口 | `null` |
| `TWIKOO_LOG_LEVEL` | 日志级别，支持 `verbose` / `info` / `warn` / `error` | `info` |
| `TWIKOO_IP_HEADERS` | 在一些特殊情况下使用，如使用了`CloudFlare CDN` 它会将请求 IP 写到请求头的 `cf-connecting-ip` 字段上，为了能够正确的获取请求 IP 你可以写成 `['headers.cf-connecting-ip']` | `[]` |

## 语音上传功能

自托管部署现在支持语音上传功能，需要配置以下参数：

### 前端配置

在 `twikoo.init` 中添加以下配置：

```javascript
twikoo.init({
  envId: 'http://localhost:8080', // 自托管服务器地址
  el: '#tcomment',
  config: {
    SHOW_VOICE: 'true',
    VOICE_CDN: 'qcloud',
    VOICE_CDN_TOKEN: '您的腾讯云SecretId',
    VOICE_CDN_SECRET: '您的腾讯云SecretKey',
    VOICE_CDN_DOMAIN: 'cos.ap-nanjing.myqcloud.com',
    VOICE_CDN_REGION: 'ap-shanghai',
    VOICE_CDN_BUCKET: '您的存储桶名称',
    VOICE_CDN_PATH: '/twikoo'
  }
})
```

### 腾讯云对象存储配置

1. 登录 [腾讯云控制台](https://console.cloud.tencent.com/)，创建对象存储（COS）存储桶
2. 获取存储桶的访问密钥（SecretId 和 SecretKey）
3. 配置跨域访问（CORS）：
   - 来源（Origin）：`*`
   - 操作（Methods）：`GET`, `PUT`, `POST`, `HEAD`, `DELETE`
   - 头部（Headers）：`*`
   - 超时（Max Age）：`86400`

### 配置参数说明

| 参数 | 描述 | 示例 |
| ---- | ---- | ---- |
| `VOICE_CDN` | 语音上传服务提供商，目前仅支持 `qcloud` | `qcloud` |
| `VOICE_CDN_TOKEN` | 腾讯云 SecretId | `AKIDxxxxxxxx` |
| `VOICE_CDN_SECRET` | 腾讯云 SecretKey | `xxxxxxxx` |
| `VOICE_CDN_DOMAIN` | 腾讯云 COS 域名 | `cos.ap-nanjing.myqcloud.com` |
| `VOICE_CDN_REGION` | 腾讯云 COS 地域 | `ap-shanghai` |
| `VOICE_CDN_BUCKET` | 腾讯云 COS 存储桶名称 | `my-bucket-1250000000` |
| `VOICE_CDN_PATH` | 语音文件存储路径 | `/twikoo` |
