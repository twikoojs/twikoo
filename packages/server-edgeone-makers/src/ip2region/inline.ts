/**
 * EO Makers 的 ip2region 注入：懒加载内联数据 + 组装 fs-free 查询器。
 *
 * **为什么走 `setCustomLibs` 而不是声明依赖**：`@imaegoo/node-ip2region` 的
 * `binarySearchSync` 靠 `fs` 随机读 8.33 MB 的 db，EO Makers 的部署产物是 JS bundle，
 * 没有可读的兄弟数据文件；直接声明该依赖也只会把 8.5 MB 装进去却仍然读不到 db。
 * 因此把 db 内联成独立模块（见 `scripts/build-ip2region-data.mjs`），并在运行时经
 * `customLibs` 注入一个内存查询器 —— `lib-loader` 的 `getIpToRegion` 覆写优先，
 * 于是**运行时不会去解析 `@imaegoo/node-ip2region`**（它只作为本包的 devDependency
 * 存在于构建期）。
 */
import type { CustomLibs } from "@twikoojs/common";
import { createInMemoryIp2Region } from "./searcher";

/** 生成物的运行时 specifier（相对 dist/index.js，也相对 src/ip2region/inline.ts） */
const DATA_SPECIFIER = "./generated/ip2region-data.js";

/**
 * 从给定 specifier 加载生成的数据模块并构建覆写项。
 *
 * 用**变量 specifier** 动态 import，有两个理由：
 *
 * 1. 生成物不进 git，静态 import 会让 `tsc`/rolldown 在未生成时直接失败；
 * 2. 6.06 MB 的 base64 因此不会被 rolldown 打进 `dist/index.js` —— dist 里它是独立的
 *    兄弟模块，只在真正要查 IP 属地时才加载（冷启动不为它付出代价）。
 *
 * 形参化是为了让测试能指向不存在/损坏的模块来验证降级路径。
 * @param specifier 数据模块的 specifier
 * @returns 覆写对象；不可用时为空对象
 */
export async function loadIp2RegionOverride(specifier: string): Promise<CustomLibs> {
  try {
    const mod = (await import(/* @vite-ignore */ specifier)) as {
      getIp2RegionBuffer(): Buffer;
    };
    return { "@imaegoo/node-ip2region": createInMemoryIp2Region(mod.getIp2RegionBuffer()) };
  } catch (error) {
    // 不注入 → 回落 lib-loader 的能力门 + 动态加载路径（EO 上会得到 LibLoadError，
    // 被 comment-dto 的 try/catch 吞成「属地为空」，与既有降级行为一致）
    console.warn(
      "ip2region 内联数据不可用，IP 属地将为空；请先执行 npm run build：",
      error instanceof Error ? error.message : String(error),
    );
    return {};
  }
}

/** 内联查询器的进程级缓存（避免每次请求都重新解压 8.33 MB） */
let overridePromise: Promise<CustomLibs> | null = null;

/**
 * 取得 ip2region 的 `customLibs` 覆写项（懒加载 + 缓存）。
 * @returns 可展开进 `setCustomLibs` 的覆写对象；不可用时为空对象
 */
export function getIp2RegionOverride(): Promise<CustomLibs> {
  overridePromise ??= loadIp2RegionOverride(DATA_SPECIFIER);
  return overridePromise;
}

/**
 * 重置缓存的覆写项（测试用；生产路径不需要）。
 */
export function resetIp2RegionOverride(): void {
  overridePromise = null;
}
