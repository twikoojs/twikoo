/**
 * `twikoo-pkg` 打包配置（1.x `src/server/pkg/tsdown.config.mjs` 的移植）。
 *
 * **基线**：SEA 的 `nodeVersion` 跟随仓库基线——1.x 曾写死 `26.8.1`，
 * 2.0 曾定为 `24`（且以主版本号形式，实际无法通过 `@tsdown/exe` 校验），
 * 现统一为 **`26.9.0`**（Node 26 线；与 `.nvmrc` / CI / Docker 同一基线）。
 *
 * 单配置、单产物：把 tkserver 及其全部依赖内联进一个文件，再交给 @tsdown/exe 生成
 * 四个平台的可执行文件（linux-x64 / darwin-arm64 / darwin-x64 / win-x64）。
 *
 * 四个必要插件（逐条说明原因）：
 * 1. **禁用 jsdom 的 xhr-sync-worker**：jsdom 只被用来给 DOMPurify 提供 window，
 *    整个依赖树没有任何同步 XHR 调用；不打包该 worker 可避免运行时 resolve 一个
 *    不存在的文件，产物体积更小。
 * 2. **内联 ip2region.db**：ip2region 用 `fs.openSync` 随机读取，必须是真实文件，
 *    故把数据库 base64 内联进产物，运行时按需落盘到系统临时目录固定路径。
 * 3. **内联 jsdom 的 default-stylesheet.css**：jsdom 在模块顶层读这个文件，
 *    而 SEA 里 `__dirname` 是可执行文件所在目录 → 解析成根目录下的路径，启动即 ENOENT。
 * 4. **css-tree 的 JSON 数据改为引用内联模块**：其 ESM 入口用
 *    `createRequire(...)` 运行时加载 `data/patch.json` 与 `mdn-data/css/*.json`，
 *    单文件产物里必然 MODULE_NOT_FOUND。
 *
 * ⚠️ **补丁依赖产物文本**：依赖升级会改写法——jsdom 30 就把 xhr-sync-worker 从三元表达式
 * 改成直接 `require.resolve`，1.x 的精确字符串匹配因此静默失效（构建成功、一启动就崩）。
 * 故这里一律用正则匹配 + 未命中告警，宁可构建时刷警告，也不要运行时才发现。
 */
import { readFileSync } from "node:fs";
import { defineConfig } from "tsdown";

/**
 * SEA 目标运行时版本（跟随仓库基线 Node 26 线）。
 *
 * **必须是完整版本号**（`x.y.z`）：`@tsdown/exe` 用 `node-v<version>-<platform>-<arch>`
 * 拼下载路径并做 `>= 25.7.0` 的 SEA 可用性校验（见其 `resolveNodeVersion`），
 * 传 `"26"` 会直接报 `Invalid Node.js version: 26`（实测；1.x 写 `26.8.1` 正是此因，
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
     * 而 SEA 产物的**目标运行时**由下面的 `nodeVersion` 决定（26，与宿主基线一致）。
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
        // jsdom 各版本写法不同（1.x 时代是三元表达式，30 起是直接 require.resolve），
        // 故只认变量名 + 文件名，避免随依赖升级静默失效
        const pattern = /const syncWorkerFile = [^\n]*"\.\/xhr-sync-worker\.js"[^\n]*;/;
        if (!pattern.test(code)) {
          console.warn(
            "[twikoo] 产物里没找到 xhr-sync-worker 的 require.resolve，同步 XHR 屏蔽可能失效",
          );
          return code;
        }
        return code.replace(
          pattern,
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
    {
      name: "twikoo-inline-jsdom-default-stylesheet",
      /**
       * 把 jsdom 的 default-stylesheet.css 内联进产物（替换顶层那次 readFileSync）。
       * @param code 待处理产物代码
       * @returns 替换后的代码
       */
      renderChunk(code: string) {
        // 不写死 `fs$2` 这类打包器生成的标识符，只认「整行 + 该 CSS 文件名」
        const pattern =
          /^([ \t]*)const defaultStyleSheet = [^\n]*readFileSync\([^\n]*default-stylesheet\.css[^\n]*;$/m;
        if (!pattern.test(code)) {
          console.warn(
            "[twikoo] 产物里没找到 jsdom 读取 default-stylesheet.css 的语句，SEA 可执行文件可能启动即 ENOENT",
          );
          return code;
        }
        const css = readFileSync(
          "./node_modules/jsdom/lib/jsdom/browser/default-stylesheet.css",
          "utf8",
        );
        return code.replace(pattern, (_match, indent: string) => `${indent}const defaultStyleSheet = ${JSON.stringify(css)};`);
      },
    },
    {
      name: "twikoo-inline-css-tree-data",
      /**
       * css-tree 的 ESM 入口用 `createRequire(...)` 在运行时加载 JSON 数据
       * （`data/patch.json`、`mdn-data/css/*.json`），单文件产物里必然 MODULE_NOT_FOUND；
       * 这些文件都已作为模块内联进产物，改为直接引用对应模块
       * （变量名规则：`require_` + 文件名去扩展名，连字符转下划线）。
       * @param code 待处理产物代码
       * @returns 替换后的代码
       */
      renderChunk(code: string) {
        /** 未找到内联模块的 spec（用于告警） */
        const missing: string[] = [];
        /** spec → 产物内联模块的调用表达式；找不到对应模块时返回 null */
        const useModule = (spec: string): string | null => {
          const name = `require_${spec.split("/").pop()!.replace(/\.json$/, "").replace(/-/g, "_")}`;
          if (!code.includes(`var ${name} = `)) {
            missing.push(spec);
            return null;
          }
          return `${name}()`;
        };
        // createRequire 就地调用：`patch = (0, x.createRequire)(... )("../data/patch.json")`
        let out = code.replace(
          /^([ \t]*)([\w$]+) = \(0, [\w$]+\.createRequire\)\([^\n]*?\)\("([^"]+\.json)"\);$/m,
          (match, indent: string, target: string, spec: string) => {
            const replacement = useModule(spec);
            return replacement ? `${indent}${target} = ${replacement};` : match;
          },
        );
        // 先建 require 再调用：`require$1("mdn-data/css/at-rules.json")`
        out = out.replace(/\brequire\$\d*\("([^"]+\.json)"\)/g, (match, spec: string) =>
          useModule(spec) ?? match,
        );
        if (missing.length > 0) {
          console.warn(
            `[twikoo] 产物里没有这些 JSON 的内联模块：${missing.join("、")}；SEA 可执行文件可能启动即 MODULE_NOT_FOUND`,
          );
        }
        return out;
      },
    },
  ],
});
