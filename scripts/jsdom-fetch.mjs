/**
 * 在 jsdom window 上安装 `fetch` 桩（`e2e-b2.mjs` 与 `check-cdn-products.mjs` 共用）。
 *
 * 客户端 HTTP 层（`packages/client/src/utils/http.ts`）用 `fetch` + `AbortController`，
 * 而 **jsdom 不实现 `fetch`** —— 缺桩时 `twikoo.init` 直接抛 `fetch is not defined`。
 *
 * 核对脚本的请求都是同源直连本地 tkserver，故用 Node 的 http/https 实现 `fetch` 的
 * 所需子集：method / headers / body / signal（AbortController 超时），返回客户端用到的
 * `{ ok, status, statusText, url, headers, text(), json() }`。
 */
import { request } from "node:http";
import { request as httpsRequest } from "node:https";

/**
 * 给 jsdom window 装上 `fetch` 桩。
 * @param window jsdom window
 */
export function installFetch(window) {
  window.fetch = (input, init = {}) => {
    const url = typeof input === "string" ? input : input.url;
    const method = String(init.method ?? "GET").toUpperCase();
    const target = new URL(url);
    const transport = target.protocol === "https:" ? httpsRequest : request;
    return new Promise((resolvePromise, rejectPromise) => {
      const req = transport(
        {
          host: target.hostname,
          port: target.port || (target.protocol === "https:" ? 443 : 80),
          path: `${target.pathname}${target.search}`,
          method,
          headers: init.headers ?? {},
        },
        (res) => {
          const chunks = [];
          res.on("data", (chunk) => chunks.push(chunk));
          res.on("end", () => {
            const text = Buffer.concat(chunks).toString("utf8");
            resolvePromise({
              ok: res.statusCode >= 200 && res.statusCode < 300,
              status: res.statusCode,
              statusText: res.statusMessage ?? "",
              url,
              headers: { get: (name) => res.headers[String(name).toLowerCase()] ?? null },
              text: async () => text,
              json: async () => JSON.parse(text),
            });
          });
        },
      );
      req.on("error", rejectPromise);
      if (init.signal) {
        const onAbort = () => req.destroy(new Error("请求超时"));
        if (init.signal.aborted) onAbort();
        else init.signal.addEventListener("abort", onAbort, { once: true });
      }
      if (init.body != null) req.write(init.body);
      req.end();
    });
  };
}
