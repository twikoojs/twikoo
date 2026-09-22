/**
 * 上传图床分发 + 垃圾后检分支测试（覆盖率补齐 III）。
 */
import { describe, expect, it, vi } from "vitest";
import { uploadImage } from "../../src/services/upload";
import { postCheckSpam } from "../../src/services/spam";
import { setCustomLibs, setLibImporter } from "../../src/utils/lib-loader";
import type { Capabilities } from "../../src/ports/capabilities";
import type { ConfigData } from "../../src/ports/database";
import type { RequestLogger } from "../../src/utils/logger";

const caps: Capabilities = {
  mail: true,
  domPurify: true,
  ip2region: true,
  akismet: true,
  tencentTms: true,
  imageUpload: true,
  qqAvatar: true,
  ai: false,
};

const pngBase64 =
  "data:image/png;base64," +
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]).toString("base64");

const noopLogger: RequestLogger = {
  /**
   *
   */
  verbose: () => {},
  /**
   *
   */
  info: () => {},
  /**
   *
   */
  warn: () => {},
  /**
   *
   */
  error: () => {},
  /**
   *
   */
  getText: () => "",
  requestId: "t",
};

/** 注入 axios/form-data 替身（记录请求） */
function installUploadMocks(options: {
  postResponse?: (url: string) => { data: Record<string, unknown> };
  putResponse?: { data: Record<string, unknown> };
}): Array<{ url: string; method: string }> {
  const calls: Array<{ url: string; method: string }> = [];
  setLibImporter(async (specifier) => {
    if (specifier === "form-data") {
      return {
        default: class {
          /** append 记录 */
          append(): void {}
          /** getHeaders 替身 */
          getHeaders(): Record<string, string> {
            return {};
          }
        },
      };
    }
    throw new Error(`unexpected ${specifier}`);
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      calls.push({ url: String(url), method });
      const data =
        method === "PUT"
          ? options.putResponse?.data
          : (options.postResponse?.(String(url)) ?? { data: {} }).data;
      return new Response(JSON.stringify(data ?? {}), { status: 200 });
    }),
  );
  return calls;
}

describe("图床 provider 分发（services/upload）", () => {
  it("lskypro（自定义 URL）：Bearer 头 + links.url 归一", async () => {
    installUploadMocks({
      /**
       *
       */
      postResponse: () => ({
        data: { status: true, data: { links: { url: "https://cdn.test/f.png" } } },
      }),
    });
    const res = await uploadImage({
      photo: pngBase64,
      config: { IMAGE_CDN: "https://my-lsky.test", IMAGE_CDN_TOKEN: "tok" } as ConfigData,
      caps,
    });
    expect((res.data as { url: string }).url).toBe("https://cdn.test/f.png");
  });

  it("piclist：key 拼接 + result[0] 归一", async () => {
    const calls = installUploadMocks({
      /**
       *
       */
      postResponse: () => ({ data: { success: true, result: ["https://p.test/1.png"] } }),
    });
    const res = await uploadImage({
      photo: pngBase64,
      config: {
        IMAGE_CDN: "piclist",
        IMAGE_CDN_URL: "https://pic.test",
        IMAGE_CDN_TOKEN: "key123",
      } as ConfigData,
      caps,
    });
    expect((res.data as { url: string }).url).toBe("https://p.test/1.png");
    expect(calls[0].url).toContain("https://pic.test/upload?key=key123");
  });

  it("easyimage：code 200 + url 提取", async () => {
    installUploadMocks({
      /**
       *
       */
      postResponse: () => ({
        data: { code: 200, result: "success", url: "https://e.test/1.png", thumb: "t", del: "d" },
      }),
    });
    const res = await uploadImage({
      photo: pngBase64,
      config: {
        IMAGE_CDN: "easyimage",
        IMAGE_CDN_URL: "https://e.test/api",
        IMAGE_CDN_TOKEN: "t",
      } as ConfigData,
      caps,
    });
    expect((res.data as { url: string }).url).toBe("https://e.test/1.png");
  });

  it("chevereto：status_code 200 + image.url", async () => {
    installUploadMocks({
      /**
       *
       */
      postResponse: () => ({
        data: {
          status_code: 200,
          image: { url: "https://c.test/1", thumb: { url: "https://c.test/t" }, delete_url: "d" },
        },
      }),
    });
    const res = await uploadImage({
      photo: pngBase64,
      config: {
        IMAGE_CDN: "chevereto",
        IMAGE_CDN_URL: "https://c.test",
        IMAGE_CDN_TOKEN: "k",
      } as ConfigData,
      caps,
    });
    expect((res.data as { url: string }).url).toBe("https://c.test/1");
  });

  it("s3：SigV4 PUT + CDN URL 回传", async () => {
    const calls = installUploadMocks({ putResponse: { data: {} } });
    const res = await uploadImage({
      photo: pngBase64,
      config: {
        IMAGE_CDN: "s3",
        S3_BUCKET: "bucket",
        S3_ACCESS_KEY_ID: "AKIA",
        S3_SECRET_ACCESS_KEY: "secret",
        S3_REGION: "us-east-1",
        S3_CDN_URL: "https://cdn.test",
      } as ConfigData,
      caps,
    });
    expect(calls[0].method).toBe("PUT");
    expect(calls[0].url).toContain("bucket.s3.us-east-1.amazonaws.com");
    expect((res.data as { url: string }).url).toContain("https://cdn.test/");
  });
});

describe("postCheckSpam 分支（services/spam）", () => {
  it("预检已标记垃圾 → 直接 true 不走外部检测", async () => {
    const result = await postCheckSpam({
      comment: { _id: "x", isSpam: true },
      config: { AKISMET_KEY: "should-not-be-used" },
      caps,
      logger: noopLogger,
    });
    expect(result).toBe(true);
  });

  it("博主邮箱 → false", async () => {
    const result = await postCheckSpam({
      comment: { _id: "x", mail: "me@test.com" },
      config: { BLOGGER_EMAIL: "me@test.com", AKISMET_KEY: "k" },
      caps,
      logger: noopLogger,
    });
    expect(result).toBe(false);
  });

  it("Akismet：verifyKey 失败 → undefined（不判定）", async () => {
    setLibImporter(async (specifier) => {
      expect(specifier).toBe("akismet-api");
      return {
        AkismetClient: class {
          /** verifyKey 替身：key 无效 */
          verifyKey(): Promise<boolean> {
            return Promise.resolve(false);
          }
          /** checkSpam 不会被调用 */
          checkSpam(): Promise<boolean> {
            return Promise.resolve(true);
          }
        },
      };
    });
    const result = await postCheckSpam({
      comment: { _id: "x", mail: "z@t.com" },
      config: { AKISMET_KEY: "bad", SITE_URL: "https://x.test" },
      caps,
      logger: noopLogger,
    });
    expect(result).toBeUndefined();
  });

  it("Akismet：正常检测（spam 判定回传）", async () => {
    setLibImporter(async (specifier) => {
      if (specifier === "akismet-api") {
        return {
          AkismetClient: class {
            /** verifyKey 替身 */
            verifyKey(): Promise<boolean> {
              return Promise.resolve(true);
            }
            /** checkSpam 替身：判定垃圾 */
            checkSpam(): Promise<boolean> {
              return Promise.resolve(true);
            }
          },
        };
      }
      throw new Error(`unexpected ${specifier}`);
    });
    const result = await postCheckSpam({
      comment: { _id: "x", mail: "z@t.com", nick: "n", comment: "c" },
      config: { AKISMET_KEY: "key", SITE_URL: "https://x.test" },
      caps,
      logger: noopLogger,
    });
    expect(result).toBe(true);
  });

  it("空配置 → undefined（无检测器）", async () => {
    const result = await postCheckSpam({
      comment: { _id: "x", mail: "z@t.com" },
      config: {},
      caps,
      logger: noopLogger,
    });
    expect(result).toBeUndefined();
  });
});
