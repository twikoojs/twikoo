import { PassThrough } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MongoDatabase, type Database } from "@twikoojs/common";
import { createTkserverServer } from "../src/server";

// 直接验证公共层源码，避免依赖重新构建后的 dist 导出。
vi.mock("@twikoojs/common", () => import("../../server-common/src/index"));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("入口拒绝响应的 CORS", () => {
  it("数据库连接失败后直接返回原错误，不重试初始化或提供 CORS", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const database = new MongoDatabase({ uri: "mongodb://127.0.0.1:1/unused" });
    const init = vi.spyOn(database, "init").mockRejectedValue(new Error("connection failed"));
    const instance = createTkserverServer({ database });
    try {
      const req = Object.assign(new PassThrough(), {
        method: "POST",
        headers: { origin: "https://allowed.example" },
      });
      req.end("{}");
      const writeHead = vi.fn();
      const result = await new Promise<string>((resolve) => {
        instance.server.emit("request", req, { writeHead, end: resolve });
      });
      expect(init).toHaveBeenCalledTimes(1);
      expect(JSON.parse(result)).toEqual({ code: 1000, message: "internal error" });
      expect(writeHead.mock.calls[0][1]).not.toHaveProperty("Access-Control-Allow-Origin");
    } finally {
      await instance.gracefulShutdown();
    }
  });

  it.each([413, 408, 503])("HTTP %s 不因配置挂起而阻塞响应", async (status) => {
    vi.useFakeTimers();
    vi.stubEnv("TWIKOO_MAX_BODY_BYTES", "1");
    vi.stubEnv("TWIKOO_BODY_TIMEOUT_MS", "5");
    const database = {
      init: vi.fn().mockResolvedValue(undefined),
      getConfig: vi.fn(() => new Promise<never>(() => {})),
      close: vi.fn().mockResolvedValue(undefined),
    } as unknown as Database;
    const instance = createTkserverServer({ database });
    let finishClose: (() => void) | undefined;
    let closing: Promise<void> | undefined;
    if (status === 503) {
      vi.spyOn(instance.server, "close").mockImplementation((callback) => {
        finishClose = () => callback?.();
        return instance.server;
      });
      closing = instance.gracefulShutdown();
    }
    try {
      const req = Object.assign(new PassThrough(), {
        method: "POST",
        headers: {
          origin: "https://allowed.example",
          "content-length": status === 413 ? "2" : "1",
        },
      });
      const writeHead = vi.fn();
      const end = vi.fn((_body: string, callback: () => void) => callback());
      instance.server.emit("request", req, { writeHead, end });
      await vi.advanceTimersByTimeAsync(105);
      expect(writeHead.mock.calls[0][0]).toBe(status);
      expect(writeHead.mock.calls[0][1]).not.toHaveProperty("Access-Control-Allow-Origin");
      expect(JSON.parse(end.mock.calls[0][0]).code).toBe(status);
      expect(req.destroyed).toBe(true);
      expect(database.init).not.toHaveBeenCalled();
    } finally {
      finishClose?.();
      await (closing ?? instance.gracefulShutdown());
    }
  });

  it.each([413, 408, 503])("HTTP %s 保留白名单规则及原错误", async (status) => {
    vi.stubEnv("TWIKOO_MAX_BODY_BYTES", "1");
    vi.stubEnv("TWIKOO_BODY_TIMEOUT_MS", "5");
    const database = {
      init: vi.fn().mockResolvedValue(undefined),
      getConfig: vi.fn().mockResolvedValue({ CORS_ALLOW_ORIGIN: "https://allowed.example/" }),
      close: vi.fn().mockResolvedValue(undefined),
    } as unknown as Database;
    const instance = createTkserverServer({ database });
    let finishClose: (() => void) | undefined;
    let closing: Promise<void> | undefined;
    if (status === 503) {
      vi.spyOn(instance.server, "close").mockImplementation((callback) => {
        finishClose = () => callback?.();
        return instance.server;
      });
      closing = instance.gracefulShutdown();
    }
    try {
      for (const origin of ["https://allowed.example", "https://denied.example", undefined]) {
        const req = Object.assign(new PassThrough(), {
          method: "POST",
          headers: { origin, "content-length": status === 413 ? "2" : "1" },
        });
        const writeHead = vi.fn();
        const result = await new Promise<string>((resolve) => {
          instance.server.emit("request", req, {
            writeHead,
            end: (body: string, callback: () => void) => {
              callback();
              resolve(body);
            },
          });
        });
        expect(JSON.parse(result).code).toBe(status);
        expect(writeHead).toHaveBeenCalledWith(
          status,
          expect.objectContaining({
            Connection: "close",
            "Content-Type": "application/json",
          }),
        );
        const headers = writeHead.mock.calls[0][1] as Record<string, string>;
        expect(headers["Access-Control-Allow-Origin"]).toBe(
          origin === undefined ? undefined : origin.includes("allowed") ? origin : "",
        );
        expect(req.destroyed).toBe(true);
      }
      vi.mocked(database.getConfig).mockRejectedValueOnce(new Error("config unavailable"));
      const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
      const req = Object.assign(new PassThrough(), {
        method: "POST",
        headers: {
          origin: "https://allowed.example",
          "content-length": status === 413 ? "2" : "1",
        },
      });
      const writeHead = vi.fn();
      await new Promise<void>((resolve) => {
        instance.server.emit("request", req, {
          writeHead,
          end: (_body: string, callback: () => void) => {
            callback();
            resolve();
          },
        });
      });
      expect(writeHead.mock.calls[0][0]).toBe(status);
      expect(writeHead.mock.calls[0][1]).not.toHaveProperty("Access-Control-Allow-Origin");
      expect(errorLog).toHaveBeenCalled();
      expect(database.init).not.toHaveBeenCalled();
    } finally {
      finishClose?.();
      await (closing ?? instance.gracefulShutdown());
    }
  });
});
