/**
 * demo 页 Vite dev server：端口 9820，同时提供
 *  ① demo 页（`/`、`/demo.html`，由本包根目录直供）
 *  ② 本地化 vendor 资产（`/bulma/*`、`/katex/*`，publicDir = `.vendor/`）
 *  ③ demo 自有样式与客户端构建产物（`/demo.css`、`/twikoo*.js`，见 ROOT_ASSETS）
 *
 * 路径推导放在本文件（Vite 会把配置打包到同级临时文件，相对推导仍然正确），
 * 不使用 `src/index.ts` 里的 `import.meta.url`（会被打包错位，见该文件头注释）。
 *
 * 注意：本地导入**必须带 `.ts` 扩展名**。Vite 计划把 `configLoader` 默认值切到
 * `'native'`（Node 原生加载 + 类型擦除），该模式下 ESM 解析不接受无扩展名导入，
 * Vite 8 会就此告警；带扩展名后两种 loader 均可加载（tsconfig 需开
 * `allowImportingTsExtensions`，本包 `noEmit` 已满足其前提）。
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import { CLIENT_PRODUCT_FILES, DEMO_PORT, VENDOR_DIR_NAME } from "./src/index.ts";

/** demo 包目录（`packages/demo`） */
const DEMO_ROOT = fileURLToPath(new URL(".", import.meta.url));
/** 客户端构建产物目录（`packages/client/dist`） */
const CLIENT_DIST = resolve(DEMO_ROOT, "../client/dist");
/** 本地化 vendor 资产目录（由 `scripts/prepare-assets.mjs` 产出） */
const VENDOR_DIR = resolve(DEMO_ROOT, VENDOR_DIR_NAME);

/** 根路径直供资源表：请求路径 → 磁盘文件与 Content-Type */
const ROOT_ASSETS = new Map<string, { file: string; type: string }>(
  [
    // demo 自有样式。必须由本中间件直供（而非交给 Vite 的 CSS 管线）：
    // Vite 会把 .css 请求按「CSS 模块」返回 text/javascript，浏览器会因 MIME
    // 不符拒绝应用该样式表，导致 demo 页样式丢失（实测）。
    { path: "/demo.css", file: resolve(DEMO_ROOT, "demo.css"), type: "text/css; charset=utf-8" },
    // 客户端产物：直供而非复制——客户端处于 watch 重建状态，页面刷新即取到最新产物
    ...CLIENT_PRODUCT_FILES.map((name) => ({
      path: `/${name}`,
      file: resolve(CLIENT_DIST, name),
      type: name.endsWith(".css") ? "text/css; charset=utf-8" : "text/javascript; charset=utf-8",
    })),
  ].map((asset) => [asset.path, { file: asset.file, type: asset.type }]),
);

/**
 * 按正确 MIME 直供根路径静态资源（demo 样式 + 客户端产物）。
 *
 * 该中间件在 Vite 内部中间件之前执行，因此能避免 CSS 被按模块处理。
 * @returns Vite 插件
 */
function serveRootAssets(): Plugin {
  return {
    name: "twikoo-demo:serve-root-assets",
    /**
     * 安装直供中间件（在 Vite 内部中间件之前执行，故 CSS 不会被按模块处理）。
     * @param server Vite dev server 实例
     */
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = (req.url ?? "").split("?")[0];
        const asset = ROOT_ASSETS.get(pathname);
        if (!asset) {
          next();
          return;
        }
        if (!existsSync(asset.file)) {
          res.statusCode = 404;
          res.setHeader("Content-Type", "text/plain; charset=utf-8");
          res.end(
            `资源缺失：${pathname}\n客户端产物请先执行 pnpm --filter twikoo build（或直接用 pnpm demo 一键启动）。\n`,
          );
          return;
        }
        res.setHeader("Content-Type", asset.type);
        res.end(readFileSync(asset.file));
      });
    },
  };
}

export default defineConfig({
  root: DEMO_ROOT,
  /** 本地化 vendor 资产目录（bulma / katex），dev 下按根路径直供 */
  publicDir: VENDOR_DIR,
  plugins: [serveRootAssets()],
  server: {
    port: DEMO_PORT,
    host: "0.0.0.0",
    /** 端口占用时直接失败，避免静默换端口导致「三进程」验收失真 */
    strictPort: true,
    fs: { allow: [DEMO_ROOT, CLIENT_DIST] },
  },
});
