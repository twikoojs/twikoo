/**
 * EO ip2region 内联链路测试：生成脚本产物 → 懒加载 → `customLibs` 注入 → common 取用。
 *
 * 这条链路跨越三层（生成脚本 / 适配器注入 / common 的 lib-loader），且**无法在本地复现
 * EO 运行时**，所以逐层都要有断言：
 *
 * 1. 生成物能加载，且解压出的 db 与真实 `ip2region.db` **逐字节一致**（sha256 比对）；
 * 2. 注入后 `getIpToRegion` 拿到的是内联查询器，结果与真实库一致；
 * 3. 注入生效时**不会**去解析 `@imaegoo/node-ip2region`（这正是本方案存在的理由）；
 * 4. 生成物缺失时优雅降级（返回空覆写 + 告警），不阻断请求。
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getDomPurify,
  getIpToRegion,
  resetCustomLibs,
  setCustomLibs,
  setLibImporter,
} from "@twikoojs/common";
import type { BlobKvStoreLike, Ip2RegionLike, LibImporter } from "@twikoojs/common";
import { eoCapabilities, prepareEoRuntime } from "../src/main";
import {
  getIp2RegionOverride,
  loadIp2RegionOverride,
  resetIp2RegionOverride,
} from "../src/ip2region/inline";

const require_ = createRequire(import.meta.url);

/** 包根目录 */
const PACKAGE_ROOT = fileURLToPath(new URL("..", import.meta.url));

/**
 * 生成物 specifier。
 *
 * 生产路径用的是相对 specifier `./generated/ip2region-data.js`（相对 dist/index.js 解析），
 * 但测试文件位于 `test/`，相对路径会解析到 `test/generated/…` 而落空，
 * 故这里显式指向 `src/ip2region/generated/` —— 生成脚本同时写这里与 dist。
 */
const DATA_SPECIFIER = pathToFileURL(
  join(PACKAGE_ROOT, "src/ip2region/generated/ip2region-data.js"),
).href;

/** 指向不存在模块的 specifier（验证降级路径） */
const MISSING_SPECIFIER = pathToFileURL(
  join(PACKAGE_ROOT, "src/ip2region/generated/does-not-exist.js"),
).href;

/** 指向非模块文件的 specifier（验证降级路径） */
const NOT_A_MODULE_SPECIFIER = pathToFileURL(
  join(PACKAGE_ROOT, "src/ip2region/generated/ip2region-data.d.ts"),
).href;

/** 真实库的 db（生成脚本的输入，也是比对基准） */
const REAL_DB = readFileSync(require_.resolve("@imaegoo/node-ip2region/data/ip2region.db"));

/** 真实库实例（oracle） */
const oracle = (require_("@imaegoo/node-ip2region") as {
  create(): { binarySearchSync(ip: string): { city: number; region: string } | null };
}).create();

/**
 * 最小 BlobKV store 桩（本文件只验证注入接线，不落库，故不实现行为）。
 * @returns 可传给 prepareEoRuntime 的 store
 */
function makeBlobStore(): BlobKvStoreLike {
  return {
    /**
     * @returns 恒为 null
     */
    async get() {
      return null;
    },
    /**
     *
     */
    async setJSON() {
      /* 空实现 */
    },
    /**
     *
     */
    async delete() {
      /* 空实现 */
    },
  } as unknown as BlobKvStoreLike;
}

afterEach(() => {
  resetCustomLibs();
  resetIp2RegionOverride();
  vi.restoreAllMocks();
});

describe("内联数据生成脚本", () => {
  it("产物可加载，且解压出的 db 与真实 ip2region.db 逐字节一致", async () => {
    // 先确保生成物存在（已是最新则脚本会跳过；CI 里 pnpm build 已生成）
    execFileSync(process.execPath, ["scripts/build-ip2region-data.mjs"], {
      cwd: PACKAGE_ROOT,
      stdio: "pipe",
    });

    const mod = (await import(DATA_SPECIFIER)) as { getIp2RegionBuffer(): Buffer };
    const buffer = mod.getIp2RegionBuffer();
    const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");
    expect(buffer.length).toBe(REAL_DB.length);
    expect(sha(buffer)).toBe(sha(REAL_DB));
  });

  it("--check 自检通过（部署前可用来确认生成物可用）", () => {
    const out = execFileSync(process.execPath, ["scripts/build-ip2region-data.mjs", "--check"], {
      cwd: PACKAGE_ROOT,
      encoding: "utf8",
    });
    expect(out).toContain("生成物可用");
  });
});

describe("内联查询器经 common 取用", () => {
  it("注入后 getIpToRegion 拿到内联查询器，结果与真实库一致", async () => {
    setCustomLibs(await loadIp2RegionOverride(DATA_SPECIFIER));
    const ip2region = await getIpToRegion(eoCapabilities);
    const searcher = ip2region.create();
    for (const ip of ["223.104.3.1", "183.14.30.1", "8.8.8.8", "0.0.0.0", "255.255.255.255"]) {
      expect(searcher.binarySearchSync(ip), `${ip} 应与真实库一致`).toEqual(
        oracle.binarySearchSync(ip),
      );
    }
  });

  it("注入生效时不会解析 @imaegoo/node-ip2region（本方案存在的理由）", async () => {
    /** 一旦被调用就说明覆写没生效 */
    const spy: LibImporter = vi.fn(async () => {
      throw new Error("不应解析 @imaegoo/node-ip2region");
    });
    setLibImporter(spy);
    setCustomLibs(await loadIp2RegionOverride(DATA_SPECIFIER));
    await getIpToRegion(eoCapabilities);
    expect(spy).not.toHaveBeenCalled();
  });

  it("覆写项形状正确：键为包名，值为可 create() 的查询器", async () => {
    const override = await loadIp2RegionOverride(DATA_SPECIFIER);
    expect(Object.keys(override)).toEqual(["@imaegoo/node-ip2region"]);
    const ip2region = override["@imaegoo/node-ip2region"] as Ip2RegionLike;
    expect(typeof ip2region.create().binarySearchSync).toBe("function");
  });
});

describe("经 prepareEoRuntime 的端到端接线", () => {
  it("适配器入口注入的查询器确实能被 common 取到，且不解析 @imaegoo/node-ip2region", async () => {
    /** 一旦被调用即说明覆写没生效（EO 上没有这个包） */
    const spy: LibImporter = vi.fn(async () => {
      throw new Error("EO 运行时不应解析 @imaegoo/node-ip2region");
    });
    setLibImporter(spy);
    // 走真实入口：prepareEoRuntime 内部 setCustomLibs
    await prepareEoRuntime(makeBlobStore());
    const ip2region = await getIpToRegion(eoCapabilities);
    const searcher = ip2region.create();
    expect(spy).not.toHaveBeenCalled();
    expect(searcher.binarySearchSync("223.104.3.1")).toEqual(oracle.binarySearchSync("223.104.3.1"));
  });

  it("prepareEoRuntime 仍注入直通 DOMPurify（未被 ip2region 注入覆盖掉）", async () => {
    await prepareEoRuntime(makeBlobStore());
    expect((await getDomPurify(eoCapabilities)).sanitize("<b>x</b>")).toBe("<b>x</b>");
  });
});

describe("生成物缺失时的降级", () => {
  it("模块不存在 → 返回空覆写并告警，不抛异常；取用时回落既有路径", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    // 固定 importer，让「回落路径」的断言不依赖其他用例留下的状态
    setLibImporter(async () => {
      throw new Error("Cannot find module '@imaegoo/node-ip2region'");
    });
    const override = await loadIp2RegionOverride(MISSING_SPECIFIER);
    expect(override).toEqual({});
    expect(warn).toHaveBeenCalled();
    // 不注入 → getIpToRegion 回落能力门 + 动态加载（ip2region=true，故会尝试解析并失败）
    setCustomLibs(override);
    await expect(getIpToRegion(eoCapabilities)).rejects.toThrow(/@imaegoo\/node-ip2region/);
  });

  it("模块加载不了或缺少导出 → 同样降级（不把异常抛给调用方）", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    // .d.ts 不是可执行模块：无论解析失败还是解析成空模块，都应落进 catch
    const override = await loadIp2RegionOverride(NOT_A_MODULE_SPECIFIER);
    expect(override).toEqual({});
    expect(warn).toHaveBeenCalled();
  });

  it("getIp2RegionOverride 做进程级缓存：两次调用同一次加载", async () => {
    const first = getIp2RegionOverride();
    const second = getIp2RegionOverride();
    expect(first).toBe(second);
    // 重置后是新的 Promise
    resetIp2RegionOverride();
    expect(getIp2RegionOverride()).not.toBe(first);
  });
});
