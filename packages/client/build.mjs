/**
 * twikoo 客户端四产物构建脚本（§5.2）：
 * twikoo.min.js / twikoo.all.min.js / twikoo.nocss.js / twikoo.all.nocss.js
 * UMD 全局名 twikoo；文件名与 1.7.24 完全一致（§1.2-4 不改产物文件名）。
 * all 变体内置云开发接入层（1.x webpack 多入口形态的 Vite 对应实现）。
 */
import { build } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "node:path";

/** 产物定义（入口 / 输出文件名） */
const PRODUCTS = [
  { entry: "src/main.ts", file: "twikoo.min.js" },
  { entry: "src/main.ts", file: "twikoo.nocss.js" },
  { entry: "src/main.all.ts", file: "twikoo.all.min.js" },
  { entry: "src/main.all.ts", file: "twikoo.all.nocss.js" },
];

/** 逐产物构建（Vite lib UMD 要求单入口，故循环四次构建） */
for (const { entry, file } of PRODUCTS) {
  await build({
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
    },
  });
  console.log(`[twikoo] built ${file}`);
}
