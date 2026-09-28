/**
 * IP 属地数据源（Cloudflare 版，替代 `@imaegoo/node-ip2region` 的 8.33 MB db）。
 *
 * **为什么不能只靠 `request.cf`**：`request.cf` 只描述**当前这次请求**的来源地，
 * 而 Twikoo 的 DTO 层是按「评论落库时记下的 `ip`」逐条算属地的（`getIpRegion`）——
 * 博主看一条三天前的评论，需要的那个 IP 的属地根本不在本次请求里。
 *
 * **本模块的做法**（1.x twikoo-cloudflare 的 D1 schema 本就有 `ipRegion` 列）：
 * 1. 请求入口用 `request.cf` 记住「本次请求 IP → 属地」；
 * 2. 提交评论时把属地随评论落到 D1 或 MongoDB 的 `ipRegion` 字段；
 * 3. 读取评论时由对应数据库实现把已存的 `ipRegion` 回填进本表，
 *    于是 `binarySearchSync(ip)` 这条**同步**通路（`lib-loader` 的覆写接口形态）
 *    也能命中——包括 1.x 时期就已经存下的历史评论。
 *
 * 因此 `ip2region: true` 名副其实（走 `setCustomLibs` 覆写，不进依赖清单）：
 * 属地的**精度**取决于 Cloudflare 的 `cf` 字段（国家 / 一级行政区 / 城市，无运营商），
 * 这是拿不到 IP 库时的最优解，也是 1.x 的行为。
 */
import type { Ip2RegionLike } from "@twikoojs/common";

/** 属地缓存容量上限（isolate 长驻，必须封顶：每次请求都可能写入若干条） */
const MAX_GEO_ENTRIES = 512;

/** IP → ip2region 管道串（`国家|0|省|市|`，与 ip2region 形态一致）的进程内缓存 */
const regionByIp = new Map<string, string>();

/**
 * 归一化 IP（与 `@twikoojs/common` 的 `getIpRegion` 同一套清洗规则：
 * 去 IPv4-mapped IPv6 前缀、去端口号）。
 *
 * 两侧必须用同一归一化函数，否则「写入用 `1.2.3.4:8080`、查询用 `1.2.3.4`」这种
 * 错位会让属地静默为空。
 * @param ip 原始 IP
 * @returns 归一化后的 IP
 */
export function normalizeGeoIp(ip: string): string {
  return ip.replace(/^::ffff:/, "").replace(/:[0-9]*$/, "");
}

/**
 * `request.cf` → ip2region 管道串（1.x twikoo-cloudflare 逐字对齐：
 * `国家|0|省|市|`；运营商 Cloudflare 不提供，故留空）。
 * @param cf Cloudflare 请求地理信息（可能为 undefined）
 * @returns 管道串；无任何字段时返回空串
 */
export function cfRegionToIp2Region(cf: CfPropertiesLike | undefined): string {
  const country = cf?.country ?? "";
  const region = cf?.region ?? "";
  const city = cf?.city ?? "";
  if (!country && !region && !city) return "";
  return `${country}|0|${region}|${city}|`;
}

/**
 * 写入一条 IP → 属地映射（超出容量时按插入顺序淘汰最旧的一条）。
 * @param ip IP（空值忽略）
 * @param region ip2region 管道串（空值忽略）
 */
export function rememberRegion(ip: string | undefined, region: string | undefined): void {
  if (!ip || !region) return;
  const key = normalizeGeoIp(ip);
  if (!key) return;
  regionByIp.delete(key);
  regionByIp.set(key, region);
  while (regionByIp.size > MAX_GEO_ENTRIES) {
    const oldest = regionByIp.keys().next();
    if (oldest.done) break;
    regionByIp.delete(oldest.value);
  }
}

/**
 * 记住本次请求的地理信息（请求入口调用一次）。
 * @param ip 客户端 IP
 * @param cf Cloudflare 请求地理信息
 */
export function rememberRequestGeo(ip: string, cf: CfPropertiesLike | undefined): void {
  rememberRegion(ip, cfRegionToIp2Region(cf));
}

/**
 * 查询 IP 的属地管道串。
 * @param ip IP
 * @returns 管道串；未命中返回 undefined
 */
export function lookupRegion(ip: string | undefined): string | undefined {
  if (!ip) return undefined;
  return regionByIp.get(normalizeGeoIp(ip));
}

/**
 * 构造可注入 `setCustomLibs` 的 ip2region 覆写（fs-free：数据来自本模块缓存）。
 * @returns 满足 `Ip2RegionLike` 的查询器工厂
 */
export function createCloudflareIp2Region(): Ip2RegionLike {
  return {
    /**
     * 创建查询器（同步接口，故只能读进程内缓存——这也是必须把属地随评论落库的原因）
     * @returns 查询器实例
     */
    create() {
      return {
        /**
         * 按 IP 查属地
         * @param ip IP
         * @returns `{ city: 0, region }`；未命中返回 null
         */
        binarySearchSync(ip: string) {
          const region = lookupRegion(ip);
          return region ? { city: 0, region } : null;
        },
      };
    },
  };
}

/**
 * 清空属地缓存（测试复位用）。
 */
export function resetGeoStore(): void {
  regionByIp.clear();
}

/**
 * 当前缓存条数（测试断言容量上限用）。
 * @returns 条数
 */
export function geoStoreSize(): number {
  return regionByIp.size;
}

/**
 * Cloudflare `request.cf` 的最小结构面（只取属地相关字段，见 `binding.ts` 的同款取舍）。
 */
export interface CfPropertiesLike {
  /** 国家/地区代码（如 `US` / `CN`） */
  country?: string;
  /** 一级行政区（如 `California` / `广东`） */
  region?: string;
  /** 城市（如 `Seattle`） */
  city?: string;
}
