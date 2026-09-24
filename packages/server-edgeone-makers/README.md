# @twikoojs/edgeone-makers

Twikoo 2.0 服务端适配器。业务逻辑在 `@twikoojs/common`，本包仅做平台入口与注入。

## 部署（腾讯云 EdgeOne Makers）

**面向用户的方式**：下载 [`templates/edgeone-makers/twikoo-edgeone-makers.zip`](../../templates/edgeone-makers/twikoo-edgeone-makers.zip)，
在控制台「创建项目 → 直接上传」时上传该 ZIP 即可。完整步骤（含自定义域名与 HTTPS 证书）
见[文档站](https://twikoo.js.org/backend)。

那个 ZIP 是**最小部署包**（三个文件，约 5 KB），只声明依赖 + 一个 Go 桥接源码：

| ZIP 内路径 | 内容 |
| --- | --- |
| `cloud-functions/index.js` | 一行转发：`export { onRequest } from "@twikoojs/edgeone-makers"` |
| `cloud-functions/smtp.go` | SMTP 桥接（Go 函数，映射到 `/smtp`），供自建 SMTP 通道使用 |
| `package.json` | `dependencies: { "@twikoojs/edgeone-makers": "latest" }` |

`package.json` 的 `files` 白名单写的是 `dist/cloud-functions/index.js`（而不是整个 `dist`）：
本包唯一要交付的就是那个入口，**sourcemap 不进 npm 包**（7.9 MB，对平台无意义）。
注意 npm 在 `files` 存在时会忽略根 `.npmignore`，所以排除只能靠白名单本身。

**数据库零配置**：评论数据存在平台自动提供的 **Blob KV**（`@edgeone/pages-blob`，强一致读取）中，
首次写入时平台自动创建命名空间，用户不需要配置任何东西，也不需要自备数据库。

**本包在流水线中的角色**：`npm run build` 产出 `dist/`（发布到 npm 的实现）与上面那个 ZIP。
两者分工的依据是两条**实测确认**的平台行为（2026-09-24，真实项目）：

1. 部署包声明了依赖时，平台会执行 `npm install`
   （构建日志：`[builder] InstallCommand: npm install` / `changed 1 package`）；
2. 平台的函数构建用打包器把函数打成**单文件**，能解析到的 `node_modules` 依赖会被内联
   （构建日志：`[cli] ✨ Node functions build completed successfully`）。

因此依赖写 `latest` 后，**升级 Twikoo 只需在项目里点「重新部署」**，无需重新下载部署包。

### 平台契约（2026-09-24 在真实项目实测）

- 函数目录 `cloud-functions/`，入口导出 `onRequest(context)`，**必须返回 Web 标准 `Response`**
- `context` 实测键：`clientIp` / `env` / `geo` / `params` / `request` / `server` / `uuid`
- `context.clientIp` 可用；环境变量 `context.env` 与 `process.env` 高度重叠，入口以
  `context.env` 为准合并进 `process.env`（`@twikoojs/common` 按 Node 惯例读后者）
- 运行时 **Node v20.19.3**；构建环境默认 Node v22.21.1，可在「项目设置 → Node.js 版本」调整
  （文档站部署步骤要求设为 **24.18.0**；该项变更需再部署一次才生效）
- 默认域名（`*.edgeone.cool`）**仅 3 小时限时预览**，不带校验参数直接访问返回 401，
  故生产必须绑定自定义域名
- **静态资源与函数路由冲突时静态资源优先**：根目录存在 `index.html` 时 `/` 返回网页而非函数
- **「构建产物」页只保留 `package.json` / `package-lock.json`** —— `cloud-functions/` 下的
  非入口文件不会落到运行时文件系统（函数运行时路径是 `/var/user/index.mjs`）
- 平台侧打包器**解析不到任何裸导入就直接构建失败**（实测报
  `✘ [ERROR] Could not resolve "nodemailer"`）

### 自建 SMTP 通道

Node 侧无法直连 SMTP，故由**同项目**的 Go 函数 `cloud-functions/smtp.go`（路由 `/smtp`）承担
「HTTP → SMTP」转发 —— **不需要另外部署一个桥接服务**。Node 侧的客户端在
`src/mail/smtp-bridge.ts`，两侧的请求/响应字段必须一致。

桥接地址由客户端自行推断（`createMailBridgeContext`）：按「请求体里的 `envId` → `Origin` 头 →
`Host` 头」依次取候选，再统一规范到路径 `/smtp`，逐个探测直到有一个通过校验。
**没有需要用户填写的桥接地址配置**。

实测（2026-09-24）三个候选的真实取值：

| 候选 | 实际值 | 可用性 |
| --- | --- | --- |
| 请求体 `envId` | 前端配置的 Twikoo 地址（如 `https://twikooeo.imaegoo.com`） | ✅ 正确，且**前端必带**（`client/src/utils/api.ts` 每次请求都塞 `envId`） |
| `Origin` 头 | 博客站点自己的域名 | ❌ 不是 Makers 域名，`<blog>/smtp` 不存在 |
| `Host` 头 | 平台内部域名（如 `pages-pro-13-…qcloudteo.com`） | ❌ 平台会改写 `Host` |

也就是说**桥接发现实际依赖 `envId`**；前两者只是 1.x 遗留的兜底。真实场景下前端必带 `envId`，
故可用；但若某个调用方不带 `envId`，会看到「自动发现失败」并列出那个内部域名候选 —— 属预期行为。

启用步骤：

1. 在项目环境变量中配置 `TWIKOO_SMTP_BRIDGE_TOKEN`（随机长字符串，**不是** SMTP 密码），
   可用 `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` 生成
2. 在 Twikoo 管理面板配置 `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` / `SENDER_EMAIL`
3. **不要**同时配置 `SMTP_SERVICE` —— 配了会走 SendGrid / MailChannels 的 HTTP 通道，不经过 Go 桥接

> 已实测（2026-09-24）：Go 桥接随部署包编译并注册 `/smtp` 路由（控制台「函数」页显示
> `{ routePath: "/smtp", runtime: "Go" }`），且**真实投递成功** —— 详见下方核对清单。

## 构建

```sh
npm run build   # = node scripts/build-ip2region-data.mjs && tsdown && node scripts/build-zip.mjs
```

**顺序不能换**：ip2region 数据必须在 tsdown **之前**生成，否则 `inline.ts` 的字面量
specifier 解析不到。

| 步骤 | 产物 |
| --- | --- |
| `build-ip2region-data.mjs` | `src/ip2region/generated/ip2region-data.js`（**不进 git**） |
| `tsdown` | `dist/cloud-functions/index.js`（单文件，约 7.4 MB，含内联数据） |
| `build-zip.mjs` | `templates/edgeone-makers/twikoo-edgeone-makers.zip`（入口 + `smtp.go` + `package.json`） |

### 为什么 ip2region 数据必须内联

`@imaegoo/node-ip2region` 的 `binarySearchSync` 靠 `fs` 随机读 8.33 MB 的 db，而平台上
没有可读的兄弟数据文件。1.x 的做法是把 db gzip + base64 成独立模块、运行时按相对路径
**懒加载**；2.0 改成**内联进函数单文件**，理由有两条：

1. **平台「构建产物」页只列出 `package.json` / `package-lock.json`**，`cloud-functions/`
   下的兄弟文件不在其中（函数运行时是打包器打出的单文件 `/var/user/index.mjs`）。
   兄弟文件能否落到运行时目录属**未文档化行为**，且失效时是**静默的**
   —— `comment-dto` 的 `try/catch` 会把异常吞成「属地为空」，站长和访客都看不到报错。
2. **最小部署包形态要求如此**：函数实现来自 npm 上的本包，无法携带兄弟文件。

内联后不再依赖平台是否复制非入口文件。代价是产物从 ~950 KB 涨到 ~7.4 MB
（gzip 后约 226 KB），换来的是确定性。

> 顺带记一条排查经验：`ipRegion` 为空**未必**是数据没加载 —— `comment-dto` 里
> `ipRegion: showRegion ? … : ""`，配置项 `SHOW_REGION` 未开启时一律为空。
> 判断数据是否可用要先把 `SHOW_REGION` 打开（实测开启后返回 `河南`，说明内联数据可用）。

| 阶段 | 大小 |
| --- | --- |
| `data/ip2region.db` | 8.33 MB |
| gzip -9 | 4.54 MB |
| base64（4/3 膨胀） | 6.06 MB |

`getIp2RegionOverride()` 里的 specifier 必须是**字面量**，改成变量就会静默失去 IP 属地
（`src/ip2region/inline.ts` 里有详细说明；`loadIp2RegionOverride(specifier)` 那条参数化
路径只服务于降级测试）。

自检：

```sh
npm run check:ip2region   # 生成物存在、格式正确、能解压出合法 db 头部
npm run check:bundle      # 依赖清单 + 产物自包含（裸导入）+ 体积区间
```

## 能力限制（能力矩阵）

- mail：受限（仅上述三通道；`restricted` 声明）
- domPurify：false（适配器启动时注入直通实现，内容原样存储）
- akismet / tencentTms：false
- ip2region：可用（**由 `setCustomLibs` 覆写满足**，依赖不必声明，见上）
- imageUpload / qqAvatar：可用

## 测试

```sh
npm test
```

- `test/ip2region.test.ts`：内联查询器 vs 真实库的**大样本等价性**（85,000+ 个 IP，
  含全部 /16 块首地址、区间边界、各省代表性 IP，要求 100% 一致）
- `test/ip2region-inline.test.ts`：生成物 → 加载 → 注入 → common 取用的整条链路
  （含 db 逐字节 sha256 比对、降级路径、进程级缓存）
- `test/main.test.ts`：契约核心事件 + 受限能力形态 + 产物门禁脚本

## 平台核对清单（查阅日期 2026-09-24，除注明外均为真实部署实测）

- [x] 函数目录与路由规则：`cloud-functions/index.js` → `PATH: /`（控制台「函数」页路由表确认）
- [x] 静态资源优先：根目录存在 `index.html` 时 `/` 返回网页而非函数
- [x] `onRequest(context)` 契约与 Web `Response` 返回值
- [x] `context` 实际键：`clientIp` / `env` / `geo` / `params` / `request` / `server` / `uuid`
- [x] `context.clientIp` 可用（实测取到公网 IP）
- [x] 运行时 Node **v20.19.3**（构建环境为 v22.21.1）
- [x] 平台会 `npm install` 部署包声明的依赖，并把函数打成单文件
- [x] 「构建产物」只列出 `package.json` / `package-lock.json`（`cloud-functions/` 下的兄弟文件不在其中）
- [x] `@edgeone/pages-blob` **平台不自带**，需由依赖提供
- [x] 默认域名仅 3 小时限时预览，生产必须绑定自定义域名
- [x] 端到端：`GET /` 健康检查、`GET_FUNC_VERSION`、`COMMENT_SUBMIT` 写入、`GET_COMMENTS_COUNT` 读取
- [x] IP 属地：`SHOW_REGION=true` 时返回真实属地（如 `河南`），内联数据可用
- [x] 最小部署包（ZIP 仅 `cloud-functions/index.js` + `cloud-functions/smtp.go` + `package.json`）真实部署跑通
- [x] Go SMTP Bridge：随部署包编译（构建日志 `Go functions build completed: 1 functions (handler mode)`）、
      路由注册为 `{ routePath: "/smtp", runtime: "Go" }`、**真实投递成功**
      （正确密码 → `{"result":{"ok":true,"message":"ok"}}`；错误密码 → `SMTP auth failed`，非假阳性）
