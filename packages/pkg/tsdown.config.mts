/**
 * `twikoo-pkg` 打包配置（1.x `src/server/pkg/tsdown.config.mjs` 的移植，D-13）。
 *
 * **D-13 基线**：SEA 的 `nodeVersion` 跟随仓库基线——1.x 曾写死 `26.8.1`，
 * 2.0 曾定为 `24`（且以主版本号形式，实际无法通过 `@tsdown/exe` 校验），
 * 现统一为 **`26.9.0`**（Node 26 线；与 `.nvmrc` / CI / Docker 同一基线）。
 *
 * 单配置、单产物：把 tkserver 及其全部依赖内联进一个文件，再交给 @tsdown/exe 生成
 * 四个平台的可执行文件（linux-x64 / darwin-arm64 / darwin-x64 / win-x64）。
 *
 * 两个必要插件（1.x 已验证，逐条保留原因）：
 * 1. **禁用 jsdom 的 xhr-sync-worker**：jsdom 只被用来给 DOMPurify 提供 window，
 *    整个依赖树没有任何同步 XHR 调用；不打包该 worker 可避免运行时 resolve 一个
 *    不存在的文件，产物体积更小。
 * 2. **内联 ip2region.db**：ip2region 用 `fs.openSync` 随机读取，必须是真实文件，
 *    故把数据库 base64 内联进产物，运行时按需落盘到系统临时目录固定路径。
 *
 * ⚠️ **2.0 现状（T41 实测）**：这两个补丁都依赖「重依赖被静态引入产物」——
 * 2.0 的 `@twikoojs/common` 改经**变量间接**的 `await import(specifier)` 惰性加载重依赖
 * （D-2 依赖外部化），打包器无法静态解析，因此 1.x 的这两处字符串替换在 2.0 产物里
 * **不会命中**（实测 `grep syncWorkerFile` / `grep ip2region.db` 均为 0）。
 * 后果：SEA 单文件产物运行时缺少 jsdom / dompurify / mongodb / nodemailer / ip2region 等
 * 重依赖，`COMMENT_SUBMIT` 等能力会报「缺少依赖」。**修复方向**：在 pkg 入口静态 import
 * 全部重依赖并经 `setLibImporter` 注入（等价于 1.x 的打包结果），已登记为 T45 的
 * 打包链路验证项；本任务不擅自改动（属打包链路专项）。
 */
import { readFileSync } from "node:fs";
import { defineConfig } from "tsdown";

/**
 * SEA 目标运行时版本（D-13：跟随仓库基线 Node 26 线）。
 *
 * **必须是完整版本号**（`x.y.z`）：`@tsdown/exe` 用 `node-v<version>-<platform>-<arch>`
 * 拼下载路径并做 `>= 25.7.0` 的 SEA 可用性校验（见其 `resolveNodeVersion`），
 * 传 `"26"` 会直接报 `Invalid Node.js version: 26`（T47 实测；1.x 写 `26.8.1` 正是此因，
 * 2.0 曾写 `"24"` 从未被真正执行到，属潜伏配置错误）。
 * 这里钉住基线线的具体补丁版本以保证产物可复现（升级时同步 `.nvmrc` 与 CI）。
 */
const NODE_VERSION = "26.9.0";

export default defineConfig({
  dts: false,
  entry: ["./src/index.ts"],
  format: ["cjs"],
  clean: ["dist", "build"],
  deps: {
    onlyBundle: false,
    /** 打包所有依赖，全部内联进单个输出文件 */
    alwaysBundle: [/.*/],
  },
  exports: false,
  platform: "node",
  /** 禁用压缩：压缩会改变字段名，影响 SEA 资源替换的字符串匹配 */
  minify: false,
  outputOptions: {
    comments: false,
    /** 将动态 import() 的 chunk 也内联进主文件，保证只输出单个文件 */
    codeSplitting: false,
    entryFileNames: "[name].js",
  },
  outDir: "build",
  exe: {
    /**
     * SEA 生成开关。`tsdown` 的 `exe` 选项要求**宿主** Node ≥ 25.7（用到较新的 SEA API），
     * 而 SEA 产物的**目标运行时**由下面的 `nodeVersion` 决定（D-13 = 26，与宿主基线一致）。
     * 宿主低于 25.7 时可设 `TWIKOO_PKG_BUNDLE_ONLY=1` 只验证打包链路
     * （单文件产物 + 两个插件替换），不生成可执行文件。
     */
    enabled: process.env.TWIKOO_PKG_BUNDLE_ONLY !== "1",
    fileName: "twikoo",
    outDir: "dist",
    targets: [
      { platform: "linux", arch: "x64", nodeVersion: NODE_VERSION },
      { platform: "darwin", arch: "arm64", nodeVersion: NODE_VERSION },
      { platform: "darwin", arch: "x64", nodeVersion: NODE_VERSION },
      { platform: "win", arch: "x64", nodeVersion: NODE_VERSION },
    ],
    seaConfig: {
      assets: {
        ".env": ".env",
        "web.config": "web.config",
      },
    },
  },
  plugins: [
    {
      name: "twikoo-disable-xhr-sync-worker",
      /**
       * 把 jsdom 内的 `require.resolve("./xhr-sync-worker.js")` 置为 null。
       * @param code 待处理产物代码
       * @returns 替换后的代码（未命中则原样返回）
       */
      renderChunk(code: string) {
        const target =
          'const syncWorkerFile = require.resolve ? require.resolve("./xhr-sync-worker.js") : null;';
        if (!code.includes(target)) return code;
        return code.replace(
          target,
          "const syncWorkerFile = null; // xhr-sync-worker 未打包: 同步 XHR 不可用",
        );
      },
    },
    {
      name: "twikoo-inline-ip2region-db",
      /**
       * 把 ip2region.db 内联进产物（替换 DEFAULT_DB_PATH 定义）。
       * @param code 待处理产物代码
       * @returns 替换后的代码（未命中则原样返回）
       */
      renderChunk(code: string) {
        const target =
          'const DEFAULT_DB_PATH = require("path").join(__dirname, "./data/ip2region.db");';
        if (!code.includes(target)) return code;
        const dbBase64 = readFileSync(
          "./node_modules/@imaegoo/node-ip2region/data/ip2region.db",
        ).toString("base64");
        return code.replace(
          target,
          `\
const __TWIKOO_IP2REGION_DB__ = ${JSON.stringify(dbBase64)};
const DEFAULT_DB_PATH = (() => {
  const fs = require("fs");
  const path = require("path");
  const bundled = path.join(__dirname, "./data/ip2region.db");
  try {
    if (fs.statSync(bundled).isFile()) return bundled; // 优先使用部署目录里的文件
  } catch {}
  // 固定路径而非每次启动新建临时目录，避免可执行文件反复重启时累积数据库副本；
  // 文件大小与内联内容不一致（首次写入被中断或版本升级）时重新生成
  const dbBuffer = Buffer.from(__TWIKOO_IP2REGION_DB__, "base64");
  const tmpFile = path.join(require("os").tmpdir(), "twikoo-ip2region.db");
  try {
    if (fs.statSync(tmpFile).size === dbBuffer.length) return tmpFile;
  } catch {}
  fs.writeFileSync(tmpFile, dbBuffer);
  return tmpFile;
})();`,
        );
      },
    },
  ],
});
