/**
 * EO Makers 的 ip2region 注入：内联数据 + 组装 fs-free 查询器。
 *
 * **为什么走 `setCustomLibs` 而不是声明依赖**：`@imaegoo/node-ip2region` 的
 * `binarySearchSync` 靠 `fs` 随机读 8.33 MB 的 db，EO Makers 的部署产物是 JS bundle，
 * 没有可读的兄弟数据文件；直接声明该依赖也只会把 8.5 MB 装进去却仍然读不到 db。
 * 因此把 db 内联进产物，并在运行时经 `customLibs` 注入一个内存查询器 ——
 * `lib-loader` 的 `getIpToRegion` 覆写优先，于是**运行时不会去解析
 * `@imaegoo/node-ip2region`**（它只作为本包的 devDependency 存在于构建期）。
 *
 * **为什么数据必须「静态可追踪」（2.0 的平台产物形态决定）**：平台的「构建产物」页实测
 * 只保留 `package.json` / `package-lock.json` —— `cloud-functions/` 目录下的**非入口文件
 * 不会落到运行时文件系统**，函数就是被打包器打成的那个单文件（运行时路径
 * `/var/user/index.mjs`）。所以 1.x「数据分片 + 变量 specifier 运行时懒加载」的做法在 2.0
 * 不成立：实测部署后 `ipRegion` 恒为空（降级路径静默生效）。
 * 因此 `getIp2RegionOverride` 里的 specifier 必须是**字面量**，让打包器把数据内联进单文件。
 */
import type { CustomLibs } from "@twikoojs/common";
import { createInMemoryIp2Region } from "./searcher";

/**
 * 从给定 specifier 加载生成的数据模块并构建覆写项。
 *
 * 用**变量 specifier** 动态 import 是为了让测试能指向不存在 / 损坏的模块来验证降级路径
 * （生产路径见 {@link getIp2RegionOverride}，那里必须用字面量）。
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
 *
 * 这里**刻意不复用** {@link loadIp2RegionOverride}：那条路径的 specifier 是函数形参，
 * 打包器无法静态追踪，数据就不会被内联进函数单文件（实测产物只有 ~975 KB，IP 属地静默为空）。
 * 生产路径必须让 `import()` 的 specifier **直接写字面量**。
 * @returns 可展开进 `setCustomLibs` 的覆写对象；不可用时为空对象
 */
export function getIp2RegionOverride(): Promise<CustomLibs> {
  overridePromise ??= (async () => {
    try {
      // 字面量 specifier 是硬性要求：打包器据此把 6 MB 数据内联进函数单文件
      const mod = (await import("./generated/ip2region-data.js")) as {
        getIp2RegionBuffer(): Buffer;
      };
      return { "@imaegoo/node-ip2region": createInMemoryIp2Region(mod.getIp2RegionBuffer()) };
    } catch (error) {
      console.warn(
        "ip2region 内联数据不可用，IP 属地将为空；请先执行 npm run build：",
        error instanceof Error ? error.message : String(error),
      );
      return {};
    }
  })();
  return overridePromise;
}

/**
 * 重置缓存的覆写项（测试用；生产路径不需要）。
 */
export function resetIp2RegionOverride(): void {
  overridePromise = null;
}
