/**
 * ip2region 纯内存查询器（fs-free）。
 *
 * 移植自 1.x `src/server/eo-makers/cloud-functions/ip2region-searcher.js`（原作者 Mintimate），
 * 2.0 改为「接收 db Buffer 的工厂」形态，与生成物解耦，因而可独立单测。
 *
 * **为什么需要它**：`@imaegoo/node-ip2region` 的 `binarySearchSync` 靠 `fs` 随机读
 * 8.33 MB 的 `data/ip2region.db`。EO Makers 的部署产物是 JS bundle，没有可读的兄弟数据文件，
 * 所以 1.x 的做法是把 db 内联成 gzip+base64 模块（见 `inline.ts`），查询器则改为在内存
 * Buffer 上做同一套二分查找。
 *
 * **与 1.x 的两处刻意差异**（均已用真实库逐条对照验证，见 `test/ip2region.test.ts`）：
 *
 * 1. `totalBlocks` 用 `(last - first) / 12 + 1`（与库的 `binarySearchSync` 一致）。
 *    1.x 写的是 `((last - first) / 12) | 0 + 1` —— 因 `+` 优先级高于 `|`，实际是 `| 1`，
 *    这是**从库的 `memorySearchSync` 原样抄来的**（库自身在 `ip2region.js:512` 也这么写）。
 *    实测：当前 db 的 `(last-first)/12 = 683590` 为偶数，`| 1` 恰好等于 `+ 1`；
 *    进一步把 `+ 1` 整个去掉，85000+ 个 IP 仍与库 100% 一致 —— 即该右界的 off-by-one
 *    **没有可观测影响**（二分查找的右界有冗余）。此处仍按正确写法实现，是为对齐库语义、
 *    不留下「碰巧能跑」的隐患，而非修一个真实 bug。
 * 2. 未命中时显式返回 `null`。库的 `binarySearchSync` 在循环退出后会用**残留的** `sip`
 *    去读数据（`ReadDataSync` 只在 `dataPos === 0` 时才返回 null），存在读到无关块的风险；
 *    1.x 已加了这层保护，本实现保留。
 */
import type { Ip2RegionLike } from "@twikoojs/common";

/** ip2region 索引块长度（12 字节：sip 4 + eip 4 + dataPtr/dataLen 4） */
const INDEX_BLOCK_LENGTH = 12;

/** db 头部的字节数（firstIndexPtr 4 + lastIndexPtr 4） */
const SUPER_BLOCK_LENGTH = 8;

/** 单次查询结果（对齐 `@imaegoo/node-ip2region` 的 SearchResult） */
export interface Ip2RegionSearchResult {
  /** city 数字码 */
  city: number;
  /** 管道分隔的地域串，如 `中国|0|广东省|深圳市|电信` */
  region: string;
}

/** 内存查询器实例（形态对齐 `Ip2RegionLike.create()` 的返回值） */
export interface InMemorySearcher {
  /**
   * 二分查找 IP 属地。
   * @param ip IPv4 地址
   * @returns 查询结果；IP 非法或未命中返回 null
   */
  binarySearchSync(ip: string): Ip2RegionSearchResult | null;
}

/**
 * IPv4 点分十进制 → 32 位无符号整数。
 * @param ip IPv4 地址
 * @returns 长整型；格式非法返回 null
 */
export function ip2long(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    const n = Number(part);
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
    value = value * 256 + n;
  }
  return value;
}

/**
 * 从 Buffer 读取 32 位无符号整数（小端序）。
 * @param buffer db Buffer
 * @param offset 偏移
 * @returns 无符号整数
 */
function getLong(buffer: Uint8Array, offset: number): number {
  const value =
    (buffer[offset] & 0x000000ff) |
    ((buffer[offset + 1] << 8) & 0x0000ff00) |
    ((buffer[offset + 2] << 16) & 0x00ff0000) |
    ((buffer[offset + 3] << 24) & 0xff000000);
  return value < 0 ? value >>> 0 : value;
}

/**
 * 校验 db 头部是否可用（生成步骤出错时给出可读错误，而不是静默查空）。
 * @param db db Buffer
 * @param totalBlocks 解析出的索引块数
 */
function assertPlausibleHeader(db: Uint8Array, totalBlocks: number): void {
  if (db.length < SUPER_BLOCK_LENGTH) {
    throw new Error(`ip2region db 过短（${db.length} 字节），疑似生成步骤未完成`);
  }
  if (!Number.isFinite(totalBlocks) || totalBlocks <= 0) {
    throw new Error(`ip2region db 头部索引块数异常（${totalBlocks}），疑似 db 损坏`);
  }
  const lastIndexPtr = getLong(db, 4);
  if (lastIndexPtr >= db.length) {
    throw new Error(
      `ip2region db 头部越界（lastIndexPtr=${lastIndexPtr} ≥ db 长度 ${db.length}），疑似 db 被截断`,
    );
  }
}

/**
 * 由 db Buffer 构建内存查询器。
 *
 * 头部的解析结果在构建时一次性完成（1.x 是首次查询时惰性初始化，等价）。
 * @param db ip2region.db 的完整内容
 * @returns 查询器实例
 */
export function createInMemorySearcher(db: Uint8Array): InMemorySearcher {
  const firstIndexPtr = getLong(db, 0);
  const lastIndexPtr = getLong(db, 4);
  // 与库的 binarySearchSync 一致（`+ 1`，不是 1.x 抄自 memorySearchSync 的 `| 0 + 1`）
  const totalBlocks = (lastIndexPtr - firstIndexPtr) / INDEX_BLOCK_LENGTH + 1;
  assertPlausibleHeader(db, totalBlocks);

  return {
    /**
     * 二分查找 IP 属地。
     * @param ip IPv4 地址
     * @returns 查询结果；IP 非法或未命中返回 null
     */
    binarySearchSync(ip: string): Ip2RegionSearchResult | null {
      const ipLong = ip2long(ip);
      if (ipLong === null) return null;

      let low = 0;
      let high = totalBlocks;
      while (low <= high) {
        const mid = (low + high) >> 1;
        const pos = (firstIndexPtr + mid * INDEX_BLOCK_LENGTH) | 0;

        if (ipLong < getLong(db, pos)) {
          high = mid - 1;
          continue;
        }
        if (ipLong > getLong(db, pos + 4)) {
          low = mid + 1;
          continue;
        }
        // 命中区间：块内第 8 字节起是 dataPtr/dataLen 打包值（高 8 位长度、低 24 位偏移）
        const packed = getLong(db, pos + 8);
        // 未命中（含库会读到无关块的边界情况，见文件头注释第 2 点）
        if (packed === 0) return null;

        const dataLen = (packed >> 24) & 0xff;
        const dataPtr = (packed & 0x00ffffff) | 0;
        const city = getLong(db, dataPtr);
        const region = Buffer.from(db.subarray(dataPtr + 4, dataPtr + dataLen)).toString("utf8");
        return { city, region };
      }
      return null;
    },
  };
}

/**
 * 由 db Buffer 构建可注入 `lib-loader` 的查询器（形态对齐 {@link Ip2RegionLike}）。
 *
 * `create()` 返回同一个实例（库按 dbPath 缓存实例，语义一致）。
 * @param db ip2region.db 的完整内容
 * @returns 带 `create()` 工厂的查询器
 */
export function createInMemoryIp2Region(db: Uint8Array): Ip2RegionLike {
  const searcher = createInMemorySearcher(db);
  return {
    /**
     * @returns 内存查询器实例
     */
    create: () => searcher,
  };
}
