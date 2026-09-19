/**
 * twikoo 客户端四产物构建脚本：
 * `twikoo.min.js` / `twikoo.all.min.js` / `twikoo.nocss.js` / `twikoo.all.nocss.js`
 *
 * - UMD 全局名 `twikoo`；文件名与 1.7.24 规范一致（不改产物文件名）；
 * - `all` 变体内置云开发 SDK（由 `src/main.all.ts` 静态 import，见该文件注释）；
 * - **样式行为对齐 1.x**：`.min.js` 两个产物把 `twikoo.css` 内联进 JS（1.x 的
 *   `extractCss: false` 构建，用 `vue-style-loader` 运行时注入）；`.nocss.js` 两个
 *   产物不含样式，需配合 `twikoo.css` 使用（1.x 的 `extractCss: true` 构建）。
 *
 * `--watch`（demo 一键启动的客户端进程）：四产物各起一个 Rollup watcher，
 * 源码变更后自动重建到 dist/；重建后再次执行样式内联，进程常驻直到被外部终止
 * （由 concurrently -k 统一清理）。
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { build } from "vite";
import vue from "@vitejs/plugin-vue";
import { VERSION } from "@twikoojs/shared";

/** 是否进入 watch 模式（pnpm demo 的客户端进程使用） */
const WATCH = process.argv.includes("--watch");

/** Vite lib 模式输出的样式文件名（与包名同名；1.x 亦为 `twikoo.css`） */
const CSS_FILE = "twikoo.css";

/** 产物定义（入口 / 输出文件名 / 是否内联样式） */
const PRODUCTS = [
  { entry: "src/main.ts", file: "twikoo.min.js", inlineCss: true },
  { entry: "src/main.all.ts", file: "twikoo.all.min.js", inlineCss: true },
  // 1.x 的 nocss 产物取自 main.all（体积 997KB > main 的 506KB，可证）
  { entry: "src/main.all.ts", file: "twikoo.nocss.js", inlineCss: false },
  // 第四个产物文件名（与上一个内容一致：同为 all 变体且不内联样式）
  { entry: "src/main.all.ts", file: "twikoo.all.nocss.js", inlineCss: false },
];

/** 内联样式注入代码的标记（用于识别产物是否已处理，避免 watch 模式重复注入） */
const CSS_MARKER = "/*! twikoo:inlined-css */";

/**
 * 需按需加载的语言（与 `src/i18n/index.ts` 的 `LAZY_LOCALES` 保持一致）。
 * `zh-CN` / `en` 内置进主产物，不在此列。
 */
const LAZY_LOCALES = ["zh-HK", "zh-TW", "uz-UZ", "ja-JP", "ko-KR", "vi-VN", "id-ID"];

/**
 * 构建语言分片：每个非内置语言产出 `dist/locales/<lang>.js`（ESM，default 导出词表）。
 *
 * 主产物是 UMD（不支持代码分割），故分片单独构建；运行时由 `i18n/index.ts` 以变量
 * specifier 动态 `import()` 按需拉取，失败回退英文。
 */
async function buildLocaleShards() {
  const result = await build({
    configFile: false,
    // 词表只需 default 导出；关掉具名导出可省掉 191 个键的导出映射（每片约 −5KB）
    json: { namedExports: false },
    build: {
      outDir: "dist/locales",
      emptyOutDir: true,
      minify: true,
      target: "es2022",
      lib: {
        entry: Object.fromEntries(
          LAZY_LOCALES.map((lang) => [lang, resolve(`src/i18n/locales/${lang}.json`)]),
        ),
        formats: ["es"],
        /**
         * 分片文件名 = 语言标识（`i18n/index.ts` 按 `<lang>.js` 拼接 URL）。
         * @param _format 输出格式（恒为 es）
         * @param entryName 入口名（语言标识）
         * @returns 文件名
         */
        fileName: (_format, entryName) => `${entryName}.js`,
      },
      // 与下方产物构建一致：仅 --watch 时开启。缺了它，`--watch` 下这次 build 返回
      // 的是一次性的 RollupOutput（没有 `.on`），下面的 watcher 监听会直接抛错，
      // 导致 `pnpm demo` 的客户端进程退出。null 表示显式关闭（Vite 语义）。
      watch: WATCH ? {} : null,
    },
  });
  if (WATCH) {
    result.on("event", (event) => {
      if (event.code === "END") console.log("[twikoo] rebuilt locales/*.js");
      if (event.code === "ERROR") console.error("[twikoo] build error in locales");
    });
    console.log("[twikoo] watching for locales/*.js");
  } else {
    console.log(`[twikoo] built locales/*.js（${LAZY_LOCALES.length} 个分片）`);
  }
}

await buildLocaleShards();

/**
 * 生成「运行时注入 <style>」的代码片段（1.x `vue-style-loader` 行为的等价物）。
 * @param css 样式文本
 * @returns 注入用 JS 片段
 */
function cssInjectionCode(css) {
  return (
    `${CSS_MARKER}\n` +
    "(function(){if(typeof document==='undefined')return;" +
    "var s=document.createElement('style');s.setAttribute('data-twikoo','');" +
    `s.appendChild(document.createTextNode(${JSON.stringify(css)}));` +
    "document.head.appendChild(s);})();\n"
  );
}

/**
 * 把 `twikoo.css` 内联进指定 JS 产物（幂等）。
 * @param file 产物文件名
 */
function inlineCssInto(file) {
  const cssPath = resolve("dist", CSS_FILE);
  const jsPath = resolve("dist", file);
  if (!existsSync(cssPath) || !existsSync(jsPath)) return;
  const code = readFileSync(jsPath, "utf8");
  if (code.startsWith(CSS_MARKER)) return;
  writeFileSync(jsPath, cssInjectionCode(readFileSync(cssPath, "utf8")) + code);
}

/** 逐产物构建（Vite lib UMD 要求单入口，故循环四次构建） */
for (const { entry, file, inlineCss } of PRODUCTS) {
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
        /**
         * 输出文件名（四产物同名产出，见 PRODUCTS 表）。
         * @returns 当前产物的文件名
         */
        fileName: () => file,
      },
      rollupOptions: {
        output: {
          // 入口同时有命名导出（init / version …）与默认导出（`export default init`），
          // 显式声明 named：UMD 全局 `twikoo` 即导出命名空间（`twikoo.init(...)`、
          // `twikoo.version`，默认导出落在 `twikoo.default`）——这正是 1.x 的调用形态，
          // 也让 `check:products` 的 `window.twikoo.init` 断言成立。
          // 不写则会由 `auto` 推断出同样结果，但每次构建打印两条 [MIXED_EXPORTS] 告警。
          exports: "named",
          // 语言分片靠运行时动态 `import()` 拉取，而 UMD 产物是在浏览器里跑的：
          // Rollup 对 CJS/UMD 输出默认会把 `import()` 改写成 `require()` 包装，
          // 浏览器没有 `require` 会直接失败（分片永远加载不到、只能一直兜底英文）。
          // 显式关闭，保证产物里保留原生 `import()`。
          dynamicImportInCjs: false,
          // 1.x 的 BannerPlugin 等价物（版本号取自 @twikoojs/shared 的构建期注入值）。
          // 必须是块注释：Rollup 原样插入，`/*!` 前缀可在压缩中保留。
          banner:
            `/*! Twikoo v${VERSION}\n` +
            ` * (c) 2020-${new Date().getFullYear()} iMaeGoo\n` +
            " * Released under the MIT License.\n" +
            " */",
        },
      },
      // 仅 --watch 时开启；null 表示显式关闭（Vite 语义）
      watch: WATCH ? {} : null,
    },
  });
  if (WATCH) {
    /**
     * 每次重建结束后内联样式并打印一行，便于在 pnpm demo 的多进程日志里辨认客户端进度。
     * @param event Rollup watcher 事件
     */
    result.on("event", (event) => {
      if (event.code === "END") {
        if (inlineCss) inlineCssInto(file);
        console.log(`[twikoo] rebuilt ${file}`);
      }
      if (event.code === "ERROR") console.error(`[twikoo] build error in ${file}`);
    });
    console.log(`[twikoo] watching for ${file}`);
  } else {
    if (inlineCss) inlineCssInto(file);
    console.log(`[twikoo] built ${file}`);
  }
}
