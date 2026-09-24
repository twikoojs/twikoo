# twikoo-edgeone-makers

Twikoo 2.0 服务端适配器。业务逻辑在 `@twikoojs/common`，本包仅做平台入口与注入。

## 部署（腾讯云 EdgeOne Makers）

1. EdgeOne Makers 控制台 → Makers 函数 → 绑定本目录
2. `npm run build`（先 `tsdown` 产出 `dist/`，再生成 ip2region 内联数据；见下）
3. Blob KV：平台自动提供 `@edgeone/pages-blob`（name: twikoo, strong 一致性）
4. SMTP：Go SMTP Bridge（smtp.go）或 SendGrid / MailChannels 通道

### 构建步骤与 ip2region 数据

`npm run build` = `tsdown && node scripts/build-ip2region-data.mjs`。第二步产出
**gzip + base64 内联的 ip2region.db**：

| 阶段 | 大小 |
| --- | --- |
| `@imaegoo/node-ip2region` 的 `data/ip2region.db` | 8.33 MB |
| gzip -9 | 4.54 MB |
| base64（base64 有 4/3 膨胀） | 6.06 MB |

**为什么必须内联**：库的 `binarySearchSync` 靠 `fs` 随机读那个 db，而 EO Makers 的部署
产物是 JS bundle，没有可读的兄弟数据文件 —— 直接声明依赖只会把 8.5 MB 装进去却仍然读不到
db（IP 属地会被 `comment-dto` 的 `try/catch` 吞成空串，**站长和访客都看不到任何报错**）。
所以本包在运行时经 `setCustomLibs` 注入一个 fs-free 的内存查询器（`src/ip2region/`），
`lib-loader` 的覆写优先于能力门与动态加载，因此**运行时不会去解析
`@imaegoo/node-ip2region`**（它只作为 devDependency 存在于构建期，用来取 `.db`）。

生成物落在两处（都不进 git）：

- `src/ip2region/generated/ip2region-data.js`（源码相对路径的兄弟模块）
- `dist/generated/ip2region-data.js`（`dist/index.js` 按相对 specifier 懒加载它）

`inline.ts` 用**变量 specifier** 动态 import，因此 6.06 MB 不会被 rolldown 打进
`dist/index.js`（代码产物仅 ~29 KB），且只在真正要查 IP 属地时才加载。类型由同目录**入库**的
`ip2region-data.d.ts` 承担，所以生成物缺失时 `tsc --noEmit` 仍能通过，只是运行时跳过注入
（回落既有降级路径：属地为空）。

自检：

```sh
npm run check:ip2region   # 生成物存在、格式正确、能解压出合法 db 头部
npm run check:size        # 依赖清单 + 代码产物 ≤ 5MB + 数据分片在预期区间
```

> 首次部署前必须跑过 `npm run build`，否则 `check:size` 会因缺少数据分片而红。

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
- `test/ip2region-inline.test.ts`：生成物 → 懒加载 → 注入 → common 取用的整条链路
  （含 db 逐字节 sha256 比对、降级路径、进程级缓存）
- `test/main.test.ts`：契约核心事件 + 受限能力形态 + 体积门禁脚本

## 平台核对清单（查阅日期 2026-09-17）

- [x] Makers 云函数请求对象与 Blob KV API（EdgeOne Makers 官方文档）
- [x] 运行时版本（Node 20）与构建期可选版本差异
- [ ] EO Node 20 跑 ES2022 产物实测（人工项；残留）
- [ ] Go SMTP Bridge 协同构建实测（人工项）
