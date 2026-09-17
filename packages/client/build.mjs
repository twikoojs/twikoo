/**
 * twikoo 客户端四产物构建脚本（§5.2）：
 * twikoo.min.js / twikoo.all.min.js / twikoo.nocss.js / twikoo.all.nocss.js
 * UMD 全局名 twikoo；文件名与 1.7.24 完全一致（§1.2-4 不改产物文件名）。
 * all 变体内置云开发接入层（1.x webpack 多入口形态的 Vite 对应实现）。
 *
 * `--watch`（T35 demo 一键启动的客户端进程）：四产物各起一个 Rollup watcher，
 * 源码变更后自动重建到 dist/，进程常驻直到被外部终止（由 concurrently -k 统一清理）。
 */
import { build } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "node:path";

/** 是否进入 watch 模式（pnpm demo 的客户端进程使用） */
const WATCH = process.argv.includes("--watch");

/** 产物定义（入口 / 输出文件名） */
const PRODUCTS = [
  { entry: "src/main.ts", file: "twikoo.min.js" },
  { entry: "src/main.ts", file: "twikoo.nocss.js" },
  { entry: "src/main.all.ts", file: "twikoo.all.min.js" },
  { entry: "src/main.all.ts", file: "twikoo.all.nocss.js" },
];

/** 逐产物构建（Vite lib UMD 要求单入口，故循环四次构建） */
for (const { entry, file } of PRODUCTS) {
  const result = await build({
    configFile: false,
    plugins: [vue()],
    define: {
      "process.env.TWIKOO_LOG_LEVEL": "undefined",
      "process.env.NODE_ENV": JSON.stringify("production"),
    },
    build: {
      outDir: "dist",
      emptyOutDir: false,
      minify: true,
      target: "es2022",
      lib: {
        entry: resolve(entry),
        formats: ["umd"],
        name: "twikoo",
        /** 输出文件名（四产物同名产出，见 PRODUCTS 表） */
        fileName: () => file,
      },
      // 仅 --watch 时开启；null 表示显式关闭（Vite 语义）
      watch: WATCH ? {} : null,
    },
  });
  if (WATCH) {
    /** 每次重建结束打印一行，便于在 pnpm demo 的多进程日志里辨认客户端进度 */
    result.on("event", (event) => {
      if (event.code === "END") console.log(`[twikoo] rebuilt ${file}`);
      if (event.code === "ERROR") console.error(`[twikoo] build error in ${file}`);
    });
    console.log(`[twikoo] watching for ${file}`);
  } else {
    console.log(`[twikoo] built ${file}`);
  }
}
