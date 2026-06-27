# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 常用命令

```bash
yarn dev          # 启动开发服务器 (localhost:9820)，使用 demo/demo.html 预览
yarn build        # 生产构建，输出 dist/twikoo.all.min.js 和 dist/twikoo.all.nocss.js
yarn lint         # ESLint 检查 (plugin:vue/essential + standard)
yarn analyze      # 包体积分析

# CloudBase 部署
yarn login        # tcb login
yarn deploy       # tcb fn deploy twikoo --force
```

开发后端时需先 `cd src/server/self-hosted && yarn install && yarn link twikoo-func`，再 `node server.js` 启动本地服务端。前端通过 `yarn dev` 启动，envId 填写 `http://localhost:8080`。

## 项目架构

Twikoo 是一个静态网站评论系统，分为**客户端**和**服务端**两部分。

### 客户端 (`src/client/`)

Vue 2 + Element UI 组件，Webpack 5 构建为 UMD 库。两个入口：
- `main.js`：不含 CloudBase SDK（用户通过 `<script>` 标签自行引入）
- `main.all.js`：内置 CloudBase SDK（发布为 `twikoo.all.min.js`）

客户端通过 `src/client/utils/api.js` 的 `call()` 函数与服务端通信：
- 当 `envId` 为 URL 时，使用 HTTP POST 请求
- 当 `envId` 为 CloudBase 环境 ID 时，使用 `_tcb.app.callFunction()` RPC 调用

### 服务端 (`src/server/`)

核心业务逻辑在 `src/server/function/twikoo/`（发布为 npm 包 `twikoo-func`），其他后端均为平台适配层：

| 后端 | 包名 | 数据库 | 说明 |
|---|---|---|---|
| CloudBase | `twikoo-func` | 腾讯云开发数据库 | 主后端，入口 `exports.main` |
| Self-hosted | `tkserver` | LokiJS（默认）/ MongoDB | Node.js HTTP 服务器，入口 `server.js` |
| Vercel | `twikoo-vercel` | MongoDB | Serverless 函数，入口 `api/index.js` |
| EdgeOne Makers | `twikoo-edgeone-makers` | EdgeOne Blob | Cloud Functions（Node.js + Go） |
| Netlify / AWS Lambda / Deta | — | MongoDB | 均通过 `twikoo-vercel` 适配 |

**重要**：修改后端共用逻辑时，需同时确保所有后端变体都能正常工作。各后端的 `handlePost` switch 语句应保持一致的事件处理分支（如 `GET_QQ_NICK`、`EMAIL_TEST` 等）。

### 事件驱动模型

前端发送事件名（如 `COMMENT_SUBMIT`、`GET_QQ_NICK`、`GET_CONFIG`），服务端 `handlePost` 中的 switch 语句分发到对应处理函数。新增功能时需在前端 `api.js` 和所有后端的 switch 中同步添加。

## 代码规范

- ESLint 配置：`.eslintrc.js`，使用 `plugin:vue/essential` + `standard`
- 编辑器配置：`.editorconfig`，2 空格缩进，LF 换行，UTF-8
- 无 TypeScript，无 Prettier，无测试框架
- 提交信息格式：`fix(scope): description` / `feat(scope): description`（参考 Conventional Commits）

## 国际化

翻译文件在 `src/client/utils/i18n/i18n.js`（约 88KB，包含所有语言）。新增 UI 文本需同步添加翻译。

## 注意事项

- 构建目标兼容 ES5（IE8 / Safari 10），使用 Babel + Terser
- `twikoo-func` 是服务端各后端共用的核心包，修改其 `utils/` 会影响所有部署方式
- CloudBase 部署配置在 `cloudbaserc.json`，函数运行时 Node.js 16.13
