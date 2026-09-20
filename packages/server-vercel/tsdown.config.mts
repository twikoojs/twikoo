import { defineConfig } from "tsdown";
import { BUILD_TARGET, neverBundleDependencies, outExtensions } from "@twikoojs/tsdown-config";

/**
 * twikoo-vercel 构建配置：ESM + CJS 双格式 + 类型声明。
 * dependencies 全部 external（运行时由 Vercel 环境安装提供）。
 *
 * `outputOptions.exports`：入口 `src/index.ts` 同时有命名导出（createVercelFunc /
 * toTkRequest / fromTkResponse）与 `export default`，CJS 侧不显式声明时 rolldown 会打印
 * `[MIXED_EXPORTS]`。声明为 `"named"` 只是把 `auto` 的既有推断结果写实（CJS 产物
 * 逐字节不变）。仅对 CJS 生效——ESM 格式恒为命名导出，无需该选项。
 */
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: BUILD_TARGET,
  outExtensions: outExtensions(["esm", "cjs"]),
  deps: { neverBundle: neverBundleDependencies() },
  /**
   * CJS 侧显式声明命名导出（消除 `[MIXED_EXPORTS]`，理由见文件头注释）。
   * @param options rolldown 默认输出选项
   * @param format 当前产物格式（rolldown 内部把 ES 规范化为 `es`，故只判 `cjs`）
   * @returns 输出选项
   */
  outputOptions: (options, format) =>
    format === "cjs"
      ? {
          ...options,
          exports: "named",
          /**
           * 1.7.x 的包是 `module.exports = <handler>`，部署壳 `require("twikoo-vercel")`
           * 拿到函数后直接调用；2.0 的 CJS 产物是 `exports.default` + 命名导出，旧壳会拿到对象
           * （报 `require(...) is not a function`）。末尾把 default 提为 module.exports，
           * 并把命名导出挂回函数上，两代写法都成立。
           */
          footer: "module.exports = Object.assign(module.exports.default, module.exports);",
        }
      : options,
});
