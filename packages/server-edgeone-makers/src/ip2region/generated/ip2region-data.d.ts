/**
 * `ip2region-data.js`（生成物）的类型声明。
 *
 * 生成物本身**不进 git** —— 它是 8.33 MB 的 db 经 gzip + base64 内联后的 6.06 MB 文本，
 * 由 `scripts/build-ip2region-data.mjs` 在构建期产出（见包内 `.gitignore`）。
 *
 * 这份 `.d.ts` 是**手写并入库**的，作用是让 `tsc --noEmit` 在生成物缺失时依然通过：
 * 生成物只在 `pnpm build`（tsdown 之后）与部署前产生，而类型检查/单测都不该依赖它。
 * 运行时由 `inline.ts` 用**变量 specifier** 懒加载，因此 rolldown 也不会把它打进 bundle。
 */

/**
 * 取得（并缓存）解压后的 db Buffer。
 * @returns ip2region.db 内容
 */
export function getIp2RegionBuffer(): Buffer;

export default getIp2RegionBuffer;
