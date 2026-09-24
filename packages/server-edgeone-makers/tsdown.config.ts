import { defineConfig } from "tsdown";
import { fileURLToPath } from "node:url";
import { BUILD_TARGET, outExtensions } from "@twikoojs/tsdown-config";

/** 重依赖占位桩的绝对路径（`alias` 的取值按绝对路径最稳） */
const LIB_STUB = fileURLToPath(new URL("./src/lib-stubs.ts", import.meta.url));

/**
 * 本适配器在 EdgeOne Makers 上**永不加载**的重依赖。
 *
 * 它们由 `setCustomLibs` 覆写（`nodemailer` / `dompurify` / `@imaegoo/node-ip2region`）
 * 或能力关闭（`akismet-api` / `tencentcloud-sdk-nodejs-tms` / `@xsai/generate-text`）而
 * 不参与运行；`mongodb` / `lokijs` 则被 BlobKV 数据库取代。
 */
const NEVER_LOADED_LIBS = [
  "@imaegoo/node-ip2region",
  "@xsai/generate-text",
  "akismet-api",
  "dompurify",
  "jsdom",
  "lokijs",
  "mongodb",
  "nodemailer",
  "tencentcloud-sdk-nodejs-tms",
];

/**
 * twikoo-edgeone-makers 构建配置：纯 ESM。
 *
 * **产物形态必须与平台契约一致**：入口是 `src/cloud-functions/index.ts`，产物固定在
 * `dist/cloud-functions/index.js` —— 这正是 EdgeOne Makers 识别函数的目录
 * （`cloud-functions/` 下的文件按目录生成路由，`cloud-functions/index.js` → `PATH: /`，
 * 2026-09-24 在真实项目实测确认）。
 *
 * **为什么不能沿用其它适配器的 `neverBundleDependencies()`**：平台侧「直接上传」不执行
 * `npm install`，部署包必须自包含，故除 `@edgeone/pages-blob`（平台不自带，由部署包随附
 * node_modules）以外一律打进产物，含 workspace 的 `@twikoojs/common` / `@twikoojs/shared`。
 */
export default defineConfig({
  entry: ["src/cloud-functions/index.ts"],
  format: ["esm"],
  /**
   * 不产出 `.d.ts`：本包的消费者是 EdgeOne Makers 平台而非 TS 工程，部署产物只需要
   * 可执行的 `index.js`。开启 dts 时 tsdown 会按 `entryFileNames` 推导出
   * `cloud-functions/index.ts` 这样的声明文件，混进 `cloud-functions/` 反而可能被平台
   * 当作候选函数文件扫描。
   */
  dts: false,
  sourcemap: true,
  clean: true,
  target: BUILD_TARGET,
  outExtensions: outExtensions(["esm"]),
  /**
   * 把「运行时永不加载的重依赖」别名到空桩。
   *
   * `@twikoojs/common` 的 `lib-loader` 用**字面量**动态 `import()` 引用它们，rolldown
   * 打包时会尝试解析；平台侧打包器（esbuild）更是解析不到就**直接构建失败**（实测）。
   * 别名到桩模块后，产物里不再有解析不到的路径，包体也不会被 jsdom / mongodb 撑爆。
   */
  alias: Object.fromEntries(NEVER_LOADED_LIBS.map((name) => [name, LIB_STUB])),
  deps: {
    /** 全量打包：平台侧不装依赖，产物必须自包含 */
    alwaysBundle: [/.*/],
    /** 平台不自带该包，且它以变量 specifier 动态加载，必须留在部署包的 node_modules 里 */
    neverBundle: ["@edgeone/pages-blob"],
  },
  outputOptions: {
    /**
     * 关闭代码分割：默认会把公共依赖拆成 `dist/*.js` 兄弟 chunk，而平台只认
     * `cloud-functions/` 目录下的文件，chunk 落在目录外就不会进部署包（实测踩到）。
     * 单入口场景下全部内联进一个文件即可。
     */
    codeSplitting: false,
    /**
     * 显式钉住产物路径：tsdown 默认把入口拍平成 `dist/index.js`，而平台要求
     * 函数文件位于 `cloud-functions/` 目录下才会注册路由（单入口场景下静态字符串即可）。
     */
    entryFileNames: "cloud-functions/index.js",
  },
});
