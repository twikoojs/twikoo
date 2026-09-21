# pushoo.js

> **本项目已并入 [Twikoo](https://github.com/twikoojs/twikoo) monorepo**（`packages/pushoo`）。
> 完整文档（支持平台、各平台 token 获取步骤、`NoticeOptions` 说明）已迁移至
> **<https://twikoo.js.org/pushoo.html>**，本 README 只保留 npm 页面必需的信息。

## ⚠️ 版本策略变更（2.0）

自 Twikoo 2.0 起，pushoo 迁入 Twikoo monorepo，**包名 `pushoo` 不变**，但：

- **版本号不再独立演进**：由 `0.1.12` 直接跳到 **`2.0.0`**，此后跟随 Twikoo 统一版本；
- **依赖升级**：`axios` 0.26 → 1.x、`marked` 4 → 18；
- **API 不变**：`notice()` 与 `NoticeOptions` 的签名与行为保持兼容。

对使用方的影响：如果您在 `package.json` 里写的是 `"pushoo": "^0.1.x"`，
**不会**自动升到 2.0.0（major 变更本就跨不过 `^0.1`）——需要手动改成
`"pushoo": "^2.0.0"` 后再安装。升级后原有 `notice()` 调用无需改动。

## 安装与使用

```bash
npm install pushoo
```

```js
const pushoo = require("pushoo").default;

const result = await pushoo("平台名称", {
  token: "平台用户身份标识",
  title: "消息标题",
  content: "Markdown 格式的推送内容",
});

console.log(result);
```

支持 `webhook`、`qmsg`、`serverchan`、`pushplus`、`dingtalk`、`wecom`、`bark`、`telegram`、
`feishu`、`lark`、`discord`、`wxpusher` 等 20 个平台，各平台的 token 获取方式见
**<https://twikoo.js.org/pushoo.html>**。

如果您是在 Twikoo 评论系统中使用，则无需自己调用，直接在 Twikoo 管理面板中配置平台名称和 token 即可。

## 许可

[MIT](https://github.com/twikoojs/twikoo/blob/main/packages/pushoo/LICENSE)
