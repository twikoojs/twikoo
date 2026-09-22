/**
 * 库加载器测试。
 *
 * 三种加载路径：能力支持 / 能力不支持 / setCustomLibs 覆写；
 * 动态 import 失败 → 错误消息含包名与安装提示（非裸 MODULE_NOT_FOUND）；
 * 外：eo-makers 直通 DOMPurify 注入场景（capability=false 时覆写仍生效）。
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Capabilities } from "../../src/ports/capabilities";
import {
  CapabilityError,
  LibLoadError,
  defineCapabilities,
  getAkismetClient,
  httpPost,
  getDomPurify,
  getGenerateText,
  getIpToRegion,
  getNodemailer,
  getXml2js,
  resetCustomLibs,
  setCustomLibs,
  setLibImporter,
  type Ip2RegionLike,
  type LibImporter,
} from "../../src/utils/lib-loader";

afterEach(() => {
  resetCustomLibs();
  vi.restoreAllMocks();
});

/** 全能力平台声明（cloudbase/vercel/self-hosted 形态） */
const fullCaps: Capabilities = defineCapabilities({
  mail: true,
  domPurify: true,
  ip2region: true,
  akismet: true,
  tencentTms: true,
  imageUpload: true,
  qqAvatar: true,
  ai: false,
});

/** eo-makers 形态：mail 受限、domPurify/akismet/tencentTms 关闭 */
const eoCaps: Capabilities = defineCapabilities({
  mail: false,
  domPurify: false,
  ip2region: true,
  akismet: false,
  tencentTms: false,
  imageUpload: true,
  qqAvatar: true,
  ai: false,
});

/** 静默 importer（不应被调用的路径用它断言零调用） */
const silentImporter: LibImporter = vi.fn(async () => ({}));

describe("库加载器三路径", () => {
  it("路径一（能力支持）：动态 import 成功 → 返回模块本体（CJS default 解包）", async () => {
    const fakeNodemailer = {
      /** 创建传输器（结构对齐 NodemailerLike 使用面） */
      createTransport: () => ({
        /** 发送邮件（恒成功） */
        sendMail: async () => ({}),
      }),
    };
    const importerFn: LibImporter = vi.fn(async (specifier) => {
      expect(specifier).toBe("nodemailer");
      return { default: fakeNodemailer };
    });
    setLibImporter(importerFn);
    const mod = await getNodemailer(fullCaps);
    expect(mod).toBe(fakeNodemailer);
    expect(importerFn).toHaveBeenCalledTimes(1);
  });

  it("路径二（能力不支持）：mail=false → CapabilityError 友好错误，import 不发生", async () => {
    setLibImporter(silentImporter);
    await expect(getNodemailer(eoCaps)).rejects.toThrow(CapabilityError);
    await expect(getNodemailer(eoCaps)).rejects.toThrow(/未声明 mail 能力/);
    expect(silentImporter).not.toHaveBeenCalled();
  });

  it("路径三（覆写）：setCustomLibs 优先于能力门与动态加载（1.x 逃生舱语义）", async () => {
    setLibImporter(silentImporter);
    const custom = {
      /** 创建传输器（覆写形态） */
      createTransport: () => ({
        /** 发送邮件（返回标记供断言） */
        sendMail: async () => "custom",
      }),
    };
    setCustomLibs({ nodemailer: custom });
    // 注意 eoCaps.mail=false：覆写在能力门之前生效（eo-makers 精简邮件形态）
    const mod = await getNodemailer(eoCaps);
    expect(mod).toBe(custom);
    expect(silentImporter).not.toHaveBeenCalled();
  });

  it("eo-makers 直通 DOMPurify：domPurify=false + 覆写注入 → 直通实例生效", async () => {
    setLibImporter(silentImporter);
    /** 直通消毒（eo-makers 场景：内容原样返回） */
    const passthrough: { sanitize: (dirty: string) => string } = {
      /** 直通消毒：原样返回 */
      sanitize: (dirty) => dirty,
    };
    setCustomLibs({ DOMPurify: passthrough });
    const purify = await getDomPurify(eoCaps);
    expect(purify.sanitize('<img onerror="x">')).toBe('<img onerror="x">');
    expect(silentImporter).not.toHaveBeenCalled();
  });
});

describe("库加载器组合与失败", () => {
  it("DOMPurify 组合装载：jsdom window → createDOMPurify(window) → sanitize 实例", async () => {
    /** 构造顺序记录（组合顺序断言） */
    const calls: string[] = [];
    setLibImporter(async (specifier) => {
      calls.push(specifier);
      if (specifier === "jsdom") {
        return {
          JSDOM: class {
            /** window 环境替身 */
            window = "fake-window";
            /** 记录构造顺序 */
            constructor() {
              calls.push("new JSDOM()");
            }
          },
        };
      }
      if (specifier === "dompurify") {
        return {
          /** 绑定 window 的工厂（结构对齐 dompurify CJS 形态） */
          default: (window: unknown) => {
            calls.push("createDOMPurify(window)");
            expect(window).toBe("fake-window");
            return {
              /** 消毒替身 */
              sanitize: () => "clean",
            };
          },
        };
      }
      throw new Error(`unexpected: ${specifier}`);
    });
    const purify = await getDomPurify(fullCaps);
    expect(purify.sanitize("<p>x</p>")).toBe("clean");
    // 组合顺序：先并行取回 jsdom/dompurify 模块，再建窗、再绑定 window
    expect(calls).toEqual(["jsdom", "dompurify", "new JSDOM()", "createDOMPurify(window)"]);
  });

  it("动态 import 失败 → LibLoadError 含包名与 npm install 提示（非裸 MODULE_NOT_FOUND）", async () => {
    setLibImporter(async () => {
      throw new Error("Cannot find module 'akismet-api'");
    });
    const err = await getAkismetClient(fullCaps).catch((e) => e);
    expect(err).toBeInstanceOf(LibLoadError);
    expect(err.message).toContain("akismet-api");
    expect(err.message).toContain("npm install akismet-api");
    // 原始错误保留在消息中（排障信息不丢失）
    expect(err.message).toContain("Cannot find module");
  });

  it("无能力门约束的轻量库（xml2js）直接动态加载", async () => {
    setLibImporter(async (specifier) => {
      if (specifier === "xml2js") {
        return {
          /** parseStringPromise 替身 */
          parseStringPromise: async () => ({}),
        };
      }
      throw new Error(`unexpected: ${specifier}`);
    });
    expect(typeof (await getXml2js()).parseStringPromise).toBe("function");
  });

  it("httpPost：JSON 解析返回 data/status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })),
    );
    const res = await httpPost<{ ok: boolean }>("https://x.test/api", { a: 1 });
    expect(res.data.ok).toBe(true);
    expect(res.status).toBe(200);
  });

  it("httpPost：非 2xx 抛错并携带 response.status/data（axios 错误形态）", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "bad" }), { status: 500 })),
    );
    const error = (await httpPost("https://x.test/api", { a: 1 }).catch(
      (e: unknown) => e,
    )) as Error & { response?: { status: number; data: unknown } };
    expect(error.message).toContain("500");
    expect(error.response?.status).toBe(500);
    expect(error.response?.data).toEqual({ error: "bad" });
  });
});

describe("ip2region 覆写（eo-makers 的 fs-free 内存查询器注入）", () => {
  /** 关闭 ip2region 的能力声明（用于断言覆写先于能力门生效） */
  const noIpCaps: Capabilities = defineCapabilities({
    mail: false,
    domPurify: false,
    ip2region: false,
    akismet: false,
    tencentTms: false,
    imageUpload: false,
    qqAvatar: false,
    ai: false,
  });

  it("覆写优先于能力门与动态加载：注入后不再解析 @imaegoo/node-ip2region", async () => {
    setLibImporter(silentImporter);
    /** fs-free 查询器替身（形态对齐 Ip2RegionLike.create().binarySearchSync） */
    const custom: Ip2RegionLike = {
      /** 返回 fs-free 实例替身 */
      create: () => ({
        /** 二分查找替身（region 回显 ip 便于断言取到的是本替身） */
        binarySearchSync: (ip: string) => ({ city: 215, region: `中国|0|北京|北京市|${ip}` }),
      }),
    };
    setCustomLibs({ "@imaegoo/node-ip2region": custom });
    // 注意 noIpCaps.ip2region=false：覆写在能力门之前生效（与 nodemailer/DOMPurify 同序）
    const mod = await getIpToRegion(noIpCaps);
    expect(mod).toBe(custom);
    expect(mod.create().binarySearchSync("1.2.3.4")?.region).toContain("1.2.3.4");
    expect(silentImporter).not.toHaveBeenCalled();
  });

  it("未覆写时能力门照旧：ip2region=false → CapabilityError 且不触发解析", async () => {
    setLibImporter(silentImporter);
    await expect(getIpToRegion(noIpCaps)).rejects.toThrow(CapabilityError);
    expect(silentImporter).not.toHaveBeenCalled();
  });

  it("未覆写且能力支持 → 走动态加载（fs 版 8.33MB 库）", async () => {
    /** fs 版库替身（真实形态：模块本体即 create() 工厂） */
    const fsVersion: Ip2RegionLike = {
      /** 返回 fs 实例替身 */
      create: () => ({
        /** 二分查找替身 */
        binarySearchSync: () => ({ city: 0, region: "中国|0|0|0|0" }),
      }),
    };
    setLibImporter(async (specifier) => {
      expect(specifier).toBe("@imaegoo/node-ip2region");
      return fsVersion;
    });
    expect(await getIpToRegion(fullCaps)).toBe(fsVersion);
  });
});

describe("@xsai/generate-text 具名导出解包（AI 垃圾检测可用性修复）", () => {
  /** ai 能力平台声明（其余能力关闭以缩小用例面） */
  const aiCaps: Capabilities = defineCapabilities({
    mail: false,
    domPurify: false,
    ip2region: false,
    akismet: false,
    tencentTms: false,
    imageUpload: false,
    qqAvatar: false,
    ai: true,
  });

  it("具名导出：返回 generateText 函数本身（可调用，而非不可调用的命名空间）", async () => {
    /** 具名导出替身（该包真实形态：`export { generateText }`） */
    const generateText = async () => ({ text: "ok" });
    setLibImporter(async (specifier) => {
      expect(specifier).toBe("@xsai/generate-text");
      return { generateText };
    });
    const impl = await getGenerateText(aiCaps);
    expect(impl).toBe(generateText);
    expect(typeof impl).toBe("function");
    expect((await impl({})).text).toBe("ok");
  });

  it("default 形态兼容：打包器把具名导出摊到 default 时同样可取", async () => {
    /** default 形态替身 */
    const generateText = async () => ({ text: "default" });
    setLibImporter(async () => ({ default: generateText }));
    expect(await getGenerateText(aiCaps)).toBe(generateText);
  });

  it("模块未导出 generateText → LibLoadError（含包名与安装提示）而非运行期 TypeError", async () => {
    setLibImporter(async () => ({}));
    const err = await getGenerateText(aiCaps).catch((e) => e);
    expect(err).toBeInstanceOf(LibLoadError);
    expect(err.message).toContain("@xsai/generate-text");
    expect(err.message).toContain("npm install @xsai/generate-text");
    expect(err.message).toContain("generateText");
  });
});
