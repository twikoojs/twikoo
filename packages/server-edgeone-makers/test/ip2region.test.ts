/**
 * fs-free ip2region 查询器测试。
 *
 * **核心证据**：以真实 `@imaegoo/node-ip2region` 的 `create().binarySearchSync()` 为 **oracle**，
 * 对大量 IP 逐条比对 `region` 与 `city`，要求 100% 一致。
 *
 * 这是「内联实现没有偏离库语义」唯一可信的证明方式：EO Makers 运行时无法在本地复现
 * （需要真实 EdgeOne 环境），所以只能靠**与库的等价性** + 注入路径的端到端测试来立论。
 * 样本覆盖随机 IP、区间边界、内网段、各省代表 IP 与未命中区间。
 *
 * oracle 需要 `@imaegoo/node-ip2region`（本包 devDependency，仅构建期与测试用；
 * EO 运行时并不加载它 —— 那正是本文件要替代的东西）。
 */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  createInMemoryIp2Region,
  createInMemorySearcher,
  ip2long,
} from "../src/ip2region/searcher";

const require_ = createRequire(import.meta.url);

/** 真实库的 db 路径（oracle 与内联实现必须读同一份 db） */
const DB_PATH = require_.resolve("@imaegoo/node-ip2region/data/ip2region.db");

/** 真实库实例（oracle） */
const oracle = (require_("@imaegoo/node-ip2region") as {
  create(): { binarySearchSync(ip: string): { city: number; region: string } | null };
}).create();

/** db Buffer（内联实现的数据来源） */
const db = readFileSync(DB_PATH);

/** 被测实现 */
const searcher = createInMemorySearcher(db);

/**
 * 确定性伪随机（mulberry32）：样本可复现，失败能原地重跑。
 * @param seed 种子
 * @returns [0, 1) 随机数生成器
 */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 构造 IPv4 样本集。
 * @param count 随机样本数
 * @returns 去重后的 IP 列表
 */
function buildSample(count: number): string[] {
  const rand = mulberry32(20260921);
  const ips = new Set<string>();

  // 1) 均匀随机（覆盖全 32 位空间）
  for (let i = 0; i < count; i++) {
    const n = Math.floor(rand() * 4294967296);
    ips.add([(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff].join("."));
  }

  // 2) 全部 /8 块首（256 条）：覆盖每一段地址空间的起点
  for (let a = 0; a < 256; a++) ips.add(`${a}.0.0.0`);

  // 3) 全部 /16 块首（65536 条）：逐块验证索引定位，能抓出「只差一个块」的 off-by-one
  for (let a = 0; a < 256; a++) {
    for (let b = 0; b < 256; b++) ips.add(`${a}.${b}.0.0`);
  }

  // 4) 区间边界与特殊值
  for (const ip of [
    "0.0.0.0",
    "0.0.0.1",
    "255.255.255.255",
    "255.255.255.254",
    "1.0.0.0",
    "127.0.0.1",
    "10.0.0.1",
    "192.168.1.1",
    "172.16.0.1",
    "169.254.0.1",
    "224.0.0.1",
    "8.8.8.8",
    "1.1.1.1",
    "114.114.114.114",
    "223.5.5.5",
    "180.101.49.11",
  ]) {
    ips.add(ip);
  }

  // 5) 各省/各国代表性 IP（真实库中能命中的）
  for (const ip of [
    "223.104.3.1", // 中国|0|北京|北京市|移动
    "183.14.30.1", // 中国|0|广东省|深圳市|电信
    "101.226.4.6", // 中国|0|上海|上海市|电信
    "202.108.22.5", // 中国|0|北京|北京市|联通
    "157.55.39.10", // 美国
    "13.107.42.12", // 美国
    "104.16.132.229", // 美国
    "133.242.0.1", // 日本
    "5.9.0.1", // 德国
    "200.160.0.1", // 巴西
  ]) {
    ips.add(ip);
  }

  return [...ips];
}

describe("fs-free ip2region 查询器 vs 真实库（oracle 等价性）", () => {
  const sample = buildSample(20000);

  it("大样本逐条比对：region 与 city 与库 100% 一致", () => {
    /** 不一致明细（最多留 10 条，便于定位） */
    const mismatches: string[] = [];
    let hits = 0;
    for (const ip of sample) {
      const expected = oracle.binarySearchSync(ip);
      const actual = searcher.binarySearchSync(ip);
      if (expected !== null) hits++;
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        if (mismatches.length < 10) {
          mismatches.push(`${ip}: 期望 ${JSON.stringify(expected)}，实得 ${JSON.stringify(actual)}`);
        } else {
          mismatches.push("…");
        }
      }
    }
    expect(mismatches, `样本 ${sample.length} 条，命中 ${hits} 条，存在不一致`).toEqual([]);
  });

  it("样本量与命中率断言：确认比对不是「两边都返回 null」的空转", () => {
    // 含全部 65536 个 /16 块首 + 20000 随机 + 边界/代表 IP
    expect(sample.length).toBeGreaterThan(85000);
    const hitCount = sample.filter((ip) => searcher.binarySearchSync(ip) !== null).length;
    // db 覆盖绝大部分 IPv4 空间，命中率必须足够高，否则上一条用例是假绿
    expect(hitCount / sample.length).toBeGreaterThan(0.9);
  });

  it("返回形态与库一致：命中项含数字 city 与管道分隔 region", () => {
    const result = searcher.binarySearchSync("223.104.3.1");
    expect(result).not.toBeNull();
    expect(typeof result?.city).toBe("number");
    expect(result?.region.split("|").length).toBeGreaterThanOrEqual(5);
  });
});

describe("fs-free ip2region 查询器的边界行为", () => {
  it("非法/可疑 IP：与库行为一致（库抛异常 ↔ 本实现返回 null，在 comment-dto 的 try/catch 下等价）", () => {
    for (const ip of [
      "",
      "not-an-ip",
      "1.2.3",
      "1.2.3.4.5",
      "256.1.1.1",
      "1.2.3.-1",
      "a.b.c.d",
      "::ffff:223.104.3.1",
      "223.104.3.1:8080",
      "2001:db8::1",
    ]) {
      let oracleResult: unknown;
      let oracleThrew = false;
      try {
        oracleResult = oracle.binarySearchSync(ip);
      } catch {
        oracleThrew = true;
      }
      const actual = searcher.binarySearchSync(ip);
      if (oracleThrew) {
        expect(actual, `${JSON.stringify(ip)}：库抛异常，本实现应返回 null`).toBeNull();
      } else {
        expect(actual, `${JSON.stringify(ip)}：应与库返回一致`).toEqual(oracleResult);
      }
    }
  });

  it("尾随空格：Number() 会 trim，库与本实现都接受（沿用库语义，不额外收紧）", () => {
    // 记在这里是为了说明「本实现不打算比库更严格」——ip2long 的数值解析与库逐字一致
    expect(ip2long("1.2.3.4 ")).toBe(16909060);
    expect(searcher.binarySearchSync("1.2.3.4 ")).toEqual(oracle.binarySearchSync("1.2.3.4 "));
  });

  it("IPv6 映射前缀与端口号：由 common 归一化，查询器只接 IPv4", () => {
    // common 的 comment-dto 会先做 `::ffff:` 前缀剥离与端口剥离，再交给查询器
    expect(searcher.binarySearchSync("::ffff:223.104.3.1")).toBeNull();
    expect(searcher.binarySearchSync("223.104.3.1:8080")).toBeNull();
    expect(searcher.binarySearchSync("223.104.3.1")).not.toBeNull();
  });

  it("ip2long：边界值与非法值", () => {
    expect(ip2long("0.0.0.0")).toBe(0);
    expect(ip2long("255.255.255.255")).toBe(4294967295);
    expect(ip2long("1.0.0.0")).toBe(16777216);
    expect(ip2long("1.2.3.4")).toBe(16909060);
    for (const bad of ["1.2.3", "1.2.3.4.5", "a.b.c.d", "256.0.0.1", "1.2.3.-1", "01.2.3.4.5"]) {
      expect(ip2long(bad), `${bad} 应判非法`).toBeNull();
    }
  });

  it("db 损坏时给出可读错误，而不是静默查空", () => {
    expect(() => createInMemorySearcher(new Uint8Array(4))).toThrow(/过短/);
    // 头部声称的 lastIndexPtr 超出实际长度 → 截断
    const truncated = Buffer.from(db.subarray(0, 1024));
    expect(() => createInMemorySearcher(truncated)).toThrow(/越界|截断/);
  });

  it("create() 返回同一实例（库按 dbPath 缓存实例，语义一致）", () => {
    const ip2region = createInMemoryIp2Region(db);
    expect(ip2region.create()).toBe(ip2region.create());
    expect(ip2region.create().binarySearchSync("223.104.3.1")).toEqual(
      oracle.binarySearchSync("223.104.3.1"),
    );
  });
});
