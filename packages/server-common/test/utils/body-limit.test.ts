/**
 * 请求体读取（累计字节上限 + 读取超时）测试。
 *
 * 回归目标 GHSA-v349-m8q5-7x2g：自托管 / deta 原先「读全流 → Buffer.concat →
 * JSON.parse」，未登录攻击者可在限流生效前用超大请求体耗尽内存与 CPU。
 */
import { describe, expect, it } from "vitest";
import {
  BodyReadTimeoutError,
  BodyTooLargeError,
  DEFAULT_BODY_READ_TIMEOUT_MS,
  DEFAULT_MAX_BODY_BYTES,
  readBodyWithLimit,
  resolveBodyTimeoutMs,
  resolveMaxBodyBytes,
} from "../../src/utils/body-limit";

/**
 * 构造可控的可读请求替身（分块产出，可注入延迟）。
 * @param chunks 分块内容
 * @param options 延迟与声明长度
 * @returns 请求替身
 */
function makeReq(
  chunks: string[],
  options: { delayMs?: number; contentLength?: string } = {},
): AsyncIterable<Uint8Array> & { headers: Record<string, string> } {
  return {
    headers: options.contentLength === undefined ? {} : { "content-length": options.contentLength },
    async *[Symbol.asyncIterator](): AsyncGenerator<Uint8Array> {
      for (const chunk of chunks) {
        if (options.delayMs) await new Promise((resolve) => setTimeout(resolve, options.delayMs));
        yield Buffer.from(chunk);
      }
    },
  };
}

describe("readBodyWithLimit", () => {
  it("正常读取：多分块拼接为完整文本", async () => {
    const body = await readBodyWithLimit(makeReq(['{"a":', "1}"]));
    expect(body).toBe('{"a":1}');
  });

  it("累计超限立即抛 BodyTooLargeError（不依赖 Content-Length）", async () => {
    // 分块很小但总量超限：证明兜底是「边读边累加」而不是看声明值
    const chunks = ["x".repeat(8), "y".repeat(8)];
    await expect(readBodyWithLimit(makeReq(chunks), { maxBytes: 10 })).rejects.toBeInstanceOf(
      BodyTooLargeError,
    );
  });

  it("Content-Length 已超限：快速拒绝，一个分块都不读", async () => {
    let yielded = 0;
    const req = {
      headers: { "content-length": "9999" },
      /**
       * 产出计数分块。
       * @returns 异步生成器
       */
      async *[Symbol.asyncIterator](): AsyncGenerator<Uint8Array> {
        yielded += 1;
        yield Buffer.from("x");
      },
    };
    await expect(readBodyWithLimit(req, { maxBytes: 100 })).rejects.toBeInstanceOf(
      BodyTooLargeError,
    );
    expect(yielded).toBe(0);
  });

  it("恰好等于上限时放行（边界不误伤）", async () => {
    await expect(readBodyWithLimit(makeReq(["0123456789"]), { maxBytes: 10 })).resolves.toBe(
      "0123456789",
    );
  });

  it("慢速发送触发读取超时（不超字节数也能被拦住）", async () => {
    await expect(
      readBodyWithLimit(makeReq(["a", "b", "c"], { delayMs: 30 }), {
        maxBytes: 1024,
        timeoutMs: 40,
      }),
    ).rejects.toBeInstanceOf(BodyReadTimeoutError);
  });

  it("默认上限可用 TWIKOO_MAX_BODY_BYTES 覆盖；非法值回退默认", () => {
    const original = process.env.TWIKOO_MAX_BODY_BYTES;
    try {
      delete process.env.TWIKOO_MAX_BODY_BYTES;
      expect(resolveMaxBodyBytes()).toBe(DEFAULT_MAX_BODY_BYTES);
      process.env.TWIKOO_MAX_BODY_BYTES = "2048";
      expect(resolveMaxBodyBytes()).toBe(2048);
      process.env.TWIKOO_MAX_BODY_BYTES = "-1";
      expect(resolveMaxBodyBytes()).toBe(DEFAULT_MAX_BODY_BYTES);
      process.env.TWIKOO_MAX_BODY_BYTES = "abc";
      expect(resolveMaxBodyBytes()).toBe(DEFAULT_MAX_BODY_BYTES);
    } finally {
      if (original === undefined) delete process.env.TWIKOO_MAX_BODY_BYTES;
      else process.env.TWIKOO_MAX_BODY_BYTES = original;
    }
  });

  it("读取超时可用 TWIKOO_BODY_TIMEOUT_MS 覆盖；非法值回退默认", () => {
    const original = process.env.TWIKOO_BODY_TIMEOUT_MS;
    try {
      delete process.env.TWIKOO_BODY_TIMEOUT_MS;
      expect(resolveBodyTimeoutMs()).toBe(DEFAULT_BODY_READ_TIMEOUT_MS);
      process.env.TWIKOO_BODY_TIMEOUT_MS = "500";
      expect(resolveBodyTimeoutMs()).toBe(500);
      process.env.TWIKOO_BODY_TIMEOUT_MS = "0";
      expect(resolveBodyTimeoutMs()).toBe(DEFAULT_BODY_READ_TIMEOUT_MS);
    } finally {
      if (original === undefined) delete process.env.TWIKOO_BODY_TIMEOUT_MS;
      else process.env.TWIKOO_BODY_TIMEOUT_MS = original;
    }
  });

  it("默认上限覆盖 10 MB 图片的 base64 载荷（不误伤上传）", () => {
    // UPLOAD_IMAGE 的内部图片上限 10 MB，base64 后约 13.98 MB
    expect(DEFAULT_MAX_BODY_BYTES).toBeGreaterThan(Math.ceil((10 * 1024 * 1024) / 3) * 4 + 64);
  });
});
