/**
 * 属地数据源测试（`request.cf` + 落库 `ipRegion` 的进程内缓存）。
 */
import { describe, expect, it } from "vitest";
import {
  cfRegionToIp2Region,
  createCloudflareIp2Region,
  geoStoreSize,
  lookupRegion,
  normalizeGeoIp,
  rememberRegion,
  rememberRequestGeo,
  resetGeoStore,
} from "../../src/geo/region-store";

describe("IP 归一化（与 common 的 getIpRegion 同一套清洗规则）", () => {
  it("去 IPv4-mapped IPv6 前缀与端口号", () => {
    expect(normalizeGeoIp("1.2.3.4")).toBe("1.2.3.4");
    expect(normalizeGeoIp("::ffff:1.2.3.4")).toBe("1.2.3.4");
    expect(normalizeGeoIp("1.2.3.4:8080")).toBe("1.2.3.4");
    expect(normalizeGeoIp("::ffff:1.2.3.4:8080")).toBe("1.2.3.4");
  });

  it("写入与查询用同一归一化（否则属地会静默为空）", () => {
    resetGeoStore();
    rememberRegion("1.2.3.4:8080", "CN|0|广东省|深圳市|");
    expect(lookupRegion("::ffff:1.2.3.4")).toBe("CN|0|广东省|深圳市|");
  });
});

describe("request.cf → ip2region 管道串", () => {
  it("1.x twikoo-cloudflare 的字段序（国家|0|省|市|）", () => {
    expect(cfRegionToIp2Region({ country: "US", region: "California", city: "Seattle" })).toBe(
      "US|0|California|Seattle|",
    );
  });

  it("字段缺失时留空；全缺返回空串（不写入缓存）", () => {
    expect(cfRegionToIp2Region({ country: "CN" })).toBe("CN|0|||");
    expect(cfRegionToIp2Region({})).toBe("");
    expect(cfRegionToIp2Region(undefined)).toBe("");
  });

  it("rememberRequestGeo：无 cf 信息时不产生缓存条目", () => {
    resetGeoStore();
    rememberRequestGeo("1.1.1.1", undefined);
    expect(lookupRegion("1.1.1.1")).toBeUndefined();
    rememberRequestGeo("1.1.1.1", { country: "CN", region: "广东省", city: "深圳市" });
    expect(lookupRegion("1.1.1.1")).toBe("CN|0|广东省|深圳市|");
  });
});

describe("ip2region 覆写（fs-free 同步查询器）", () => {
  it("命中返回 ip2region 形态的 region；未命中返回 null", () => {
    resetGeoStore();
    rememberRegion("8.8.8.8", "US|0|California|Seattle|");
    const searcher = createCloudflareIp2Region().create();
    expect(searcher.binarySearchSync("8.8.8.8")).toEqual({
      city: 0,
      region: "US|0|California|Seattle|",
    });
    expect(searcher.binarySearchSync("9.9.9.9")).toBeNull();
    expect(searcher.binarySearchSync("")).toBeNull();
  });

  it("缓存有容量上限（isolate 长驻，不能无限增长）", () => {
    resetGeoStore();
    for (let i = 0; i < 600; i += 1) {
      rememberRegion(`10.0.${Math.floor(i / 250)}.${i % 250}`, "CN|0|广东省|深圳市|");
    }
    expect(geoStoreSize()).toBeLessThanOrEqual(512);
    // 最早写入的被淘汰，最近的仍在（i=599 → 10.0.2.99）
    expect(lookupRegion("10.0.0.0")).toBeUndefined();
    expect(lookupRegion("10.0.2.99")).toBe("CN|0|广东省|深圳市|");
  });

  it("同一 IP 重复写入不占额外槽位（覆盖语义）", () => {
    resetGeoStore();
    for (let i = 0; i < 100; i += 1) rememberRegion("1.1.1.1", `CN|0|p${i}|c|`);
    expect(geoStoreSize()).toBe(1);
    expect(lookupRegion("1.1.1.1")).toBe("CN|0|p99|c|");
  });
});
