/**
 * twikoo-cloudflare 主逻辑（Cloudflare Workers 薄适配器）。
 *
 * 与 1.x twikoo-cloudflare（独立仓库 `twikoojs/twikoo-cloudflare`）的关系：**业务逻辑
 * 全部下沉到 `@twikoojs/common`**，本包只保留「平台入口 + 端口注入 + 载荷形态转换」
 * 三件事，1.x 那份 1224 行的 `src/index.js`（D1 SQL 手写、邮件垫片、验证码、XSS 消毒、
 * 各事件的 20 个 handler）在 2.0 里各自归位：
 *
 * | 1.x 位置 | 2.0 归属 |
 * | --- | --- |
 * | `DBBinding`（D1 SQL 手写） | `./database/d1.ts`（实现 `Database` 端口） |
 * | `setCustomLibs({ nodemailer })` | `./mail/nodemailer.ts` |
 * | `setCustomLibs({ DOMPurify: 直通 })` | `./dom-purify.ts`（xss 白名单） |
 * | `currentRequestGeo` | `./geo/region-store.ts` |
 * | 各事件 handler | `@twikoojs/common` 的 handlers（本包不碰） |
 * | `postSubmit` 5 秒竞速 | `./dispatch.ts`（`ctx.waitUntil`） |
 *
 * **平台核对清单**（Cloudflare Workers / D1 / wrangler，查阅 2026-09-23）：
 * - Worker 模块入口为 `export default { fetch }`，签名 `(request, env, executionCtx)`；
 * - `request.cf` 提供国家/省/城市（仅当前请求，不能按任意 IP 反查）；
 * - D1 绑定经 `env.DB` 注入，`prepare().bind().first()/all()/run()`，位置参数 `?`；
 * - `nodejs_compat` 兼容标志提供 `node:crypto` / `Buffer`（wrangler.toml 已声明）；
 * - **未采用** `cloudflare:sockets` 的裸 TCP（理论上能连 SMTP，但 TLS + 分帧需自实现，
 *   且 1.x 也未做，故邮件仍走 HTTP 通道）。
 */
import {
  RES_CODE,
  createHandler,
  scaffoldAdapters,
  setCustomLibs,
} from "@twikoojs/common";
import type {
  Capabilities,
  Database,
  TkAdapters,
  TkRequestBody,
  TkRequest,
  TkResponse,
} from "@twikoojs/common";
import type { D1DatabaseLike } from "./database/binding";
import { D1Database } from "./database/d1";
import { createCloudflareDispatcher } from "./dispatch";
import { createXssDOMPurify } from "./dom-purify";
import { createNativeFormData } from "./form-data";
import { createCloudflareIp2Region, rememberRequestGeo, type CfPropertiesLike } from "./geo/region-store";
import { createCloudflareNodemailer } from "./mail/nodemailer";

/**
 * Cloudflare 平台能力声明（能力矩阵的 Cloudflare 行）。
 *
 * - `mail: "restricted"`：发邮件走 HTTP 通道（SendGrid / MailChannels / Resend），
 *   Workers 无法建立 SMTP 连接；
 * - `domPurify: false`：Workers 无 jsdom，改用 `xss` 白名单垫片（`setCustomLibs` 覆写）；
 * - `ip2region: true`：**由覆写满足**（`request.cf` + 随评论落库的 `ipRegion`，
 *   见 `geo/region-store.ts`），不进依赖清单；
 * - `akismet` / `tencentTms: false`：两个 SDK 都强依赖 Node 的 `http` 模块与长连接，
 *   Workers 上不可用（对应「后置垃圾检测」只剩内置预检与违禁词）；
 * - `imageUpload: true`：**由覆写满足**（原生 FormData 垫片），图床走 S3 兼容 API
 *   （Cloudflare R2 支持 S3 协议，配置 `IMAGE_CDN=s3` + `S3_ENDPOINT` 即可）；
 * - `ai: false`：不引入 `@xsai/*`（Workers 产物有体积上限，且该能力的价值需实测后再开）。
 */
export const cloudflareCapabilities: Capabilities = {
  mail: "restricted",
  domPurify: false,
  ip2region: true,
  akismet: false,
  tencentTms: false,
  imageUpload: true,
  qqAvatar: true,
  ai: false,
};

/** Cloudflare 环境变量与绑定（`wrangler.toml` 的 `[vars]` / `[[d1_databases]]`） */
export interface CloudflareEnvLike {
  /** D1 数据库绑定 */
  DB?: D1DatabaseLike;
}

/** Workers 执行上下文（只用到 `waitUntil`；其余成员透传而不使用） */
export interface ExecutionContextLike {
  /**
   * 托管后台 promise（响应返回后继续执行）
   * @param promise 待托管 promise
   */
  waitUntil(promise: Promise<unknown>): void;
}

/** 本适配器的平台原始载荷（`TkRequest.raw` 的形态） */
export interface CloudflareRawPayload {
  /** Workers 请求对象（`fetch` 的第一参） */
  request: Request;
  /** 环境变量与绑定 */
  env: CloudflareEnvLike;
  /** 执行上下文（`waitUntil` 派发用；离线调用时可缺） */
  executionCtx?: ExecutionContextLike;
  /** 已解析的请求体（`toTkRequest` 是同步契约，故由调用方先解析，见 `readRequestBody`） */
  body: TkRequestBody;
}

/** 逐请求处理器签名（`fetch` 的形态） */
export type CloudflareHandler = (
  request: Request,
  env?: CloudflareEnvLike,
  executionCtx?: ExecutionContextLike,
) => Promise<Response>;

/** D1 实例缓存（按绑定对象缓存：同一 isolate 内绑定对象稳定，避免每次请求重建） */
const databases = new WeakMap<object, D1Database>();

/**
 * 读取并解析请求体（JSON；非法或空体归一为 `{}`）。
 *
 * 为什么在入口解析而不是在 `toTkRequest` 里：`RequestPort.toTkRequest` 是**同步**契约
 * （见 `@twikoojs/common` 的 `ports/request.ts`），而 `request.json()` 是异步的。
 * @param request Workers 请求对象
 * @returns 请求体（含 `event` / `accessToken`）
 */
async function readRequestBody(request: Request): Promise<TkRequestBody> {
  const method = String(request.method ?? "POST").toUpperCase();
  if ((method !== "POST" && method !== "PUT") || !request.body) return {} as TkRequestBody;
  try {
    const parsed: unknown = await request.json();
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as TkRequestBody;
    }
    return {} as TkRequestBody;
  } catch {
    return {} as TkRequestBody;
  }
}

/**
 * 收集请求头（键小写化，与 `TkRequest.headers` 的约定一致）。
 * @param request Workers 请求对象
 * @returns 请求头表
 */
function collectHeaders(request: Request): Record<string, string> {
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });
  return headers;
}

/**
 * 解析客户端 IP（1.x twikoo-cloudflare 取 `CF-Connecting-IP`；缺省回落到转发首跳 / x-real-ip）。
 *
 * 三分支而非 `??` 串联：空串在 `??` 下不会被跳过，而「头存在但为空」在真实链路上
 * 并不代表拿到了 IP。
 * @param headers 小写化的请求头
 * @returns 客户端 IP；均缺失时为空串
 */
function resolveIp(headers: Record<string, string>): string {
  const connecting = headers["cf-connecting-ip"];
  if (connecting) return connecting;
  const forwarded = headers["x-forwarded-for"];
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers["x-real-ip"] ?? "";
}

/**
 * 读取 `request.cf`（Workers 专有字段，标准 `Request` 类型里没有，故收窄为最小结构面）。
 * @param request Workers 请求对象
 * @returns 地理信息；非 Workers 宿主返回 undefined
 */
function readCf(request: Request): CfPropertiesLike | undefined {
  return (request as unknown as { cf?: CfPropertiesLike }).cf;
}

/**
 * 平台载荷 → 内部统一请求。
 * @param raw 平台原始载荷
 * @returns 内部统一请求
 */
export function toTkRequest(raw: CloudflareRawPayload): TkRequest {
  const url = new URL(raw.request.url);
  const query: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    query[key] = value;
  });
  const headers = collectHeaders(raw.request);
  return {
    method: String(raw.request.method ?? "POST").toUpperCase(),
    path: url.pathname,
    query,
    body: raw.body,
    headers,
    ip: resolveIp(headers),
    raw,
  };
}

/**
 * 内部统一响应 → Workers 响应（状态码与响应头透传；204 无体）。
 * @param tkRes 内部统一响应
 * @returns Workers `Response`
 */
export function fromTkResponse(tkRes: TkResponse): Response {
  if (tkRes.status === 204) {
    return new Response(null, { status: 204, headers: tkRes.headers });
  }
  return new Response(JSON.stringify(tkRes.body), {
    status: tkRes.status,
    headers: { ...tkRes.headers, "Content-Type": "application/json;charset=UTF-8" },
  });
}

/**
 * 注入 Cloudflare 形态的公共库覆写（DOMPurify / nodemailer / form-data / ip2region）。
 *
 * 覆写优先于能力门与动态加载，故 `mail: "restricted"`、`domPurify: false`、
 * `imageUpload` / `ip2region` 的依赖不必进 `dependencies`（依赖声明完整性由
 * `@twikoojs/common` 的 `test/adapter-deps.test.ts` 断言，本包在 `OVERRIDE_SATISFIED`
 * 里登记）。
 */
export function installCloudflareLibs(): void {
  setCustomLibs({
    // 无 jsdom → 用 xss 白名单消毒（1.x 同款）
    DOMPurify: createXssDOMPurify(),
    // 无裸 TCP → 邮件走 SendGrid / MailChannels / Resend 的 HTTP API
    nodemailer: createCloudflareNodemailer(),
    // 原生 FormData（multipart 边界交给 fetch）替代只认 Node 流的 form-data 包
    "form-data": createNativeFormData(),
    // 无 8.33 MB 的 ip2region db → request.cf + 落库的 ipRegion
    "@imaegoo/node-ip2region": createCloudflareIp2Region(),
  });
}

/**
 * 取（并缓存）D1 数据库实例。
 * @param env 环境绑定
 * @returns D1 数据库实现
 */
export function getD1Database(env: CloudflareEnvLike): D1Database {
  const binding = env?.DB;
  if (!binding) {
    throw new Error(
      "未绑定 D1 数据库：请在 wrangler.toml 中声明 [[d1_databases]] 并设置 binding = \"DB\"",
    );
  }
  const cached = databases.get(binding);
  if (cached) return cached;
  const created = new D1Database(binding);
  databases.set(binding, created);
  return created;
}

/**
 * 装配本次请求的运行态（覆写公共库 + 取 D1 数据库）。
 *
 * 返回 promise 而非直接返回实例：调用点（逐请求处理器）里它与后续异步步骤同批等待，
 * 保持与其它适配器 `prepare*Runtime` 一致的调用形态。
 * @param env 环境绑定
 * @returns 数据库端口实现
 */
export function prepareCloudflareRuntime(env: CloudflareEnvLike): Promise<Database> {
  installCloudflareLibs();
  return Promise.resolve(getD1Database(env));
}

/**
 * 创建 Worker 请求处理器（`database` 可注入：单测用内存 D1 替身）。
 * @param options 注入项
 * @returns 逐请求处理器
 */
export function createCloudflareFunc(options: { database?: Database } = {}): CloudflareHandler {
  return async (request, env = {}, executionCtx) => {
    try {
      const ip = resolveIp(collectHeaders(request));
      // 属地：记住「本次请求 IP → request.cf 属地」，供提交时落库
      rememberRequestGeo(ip, readCf(request));
      const tkRequest = toTkRequest({
        request,
        env,
        executionCtx,
        body: await readRequestBody(request),
      });
      const database = options.database ?? (await prepareCloudflareRuntime(env));
      const adapters: TkAdapters = scaffoldAdapters({
        request: {
          /** 事件即请求体（闭包透传，见 toTkRequest） */
          toTkRequest: () => tkRequest,
        },
        response: {
          /** TkResponse 恒等透传（序列化见 fromTkResponse） */
          fromTkResponse: (r: TkResponse) => r,
        },
        database,
        capabilities: cloudflareCapabilities,
        // 后置副作用经 ctx.waitUntil 移出本次请求（见 ./dispatch.ts）
        postSubmit: createCloudflareDispatcher(),
      });
      return fromTkResponse(await createHandler(adapters)(tkRequest));
    } catch (e) {
      // 异常不外抛（1.x 语义）：抛给平台只会得到 500「Worker threw exception」，
      // 前端拿不到 code/message；这里统一压成业务失败体
      return fromTkResponse({
        status: 200,
        headers: {},
        body: {
          code: RES_CODE.FAIL,
          message: e instanceof Error ? e.message : String(e),
        },
      });
    }
  };
}

/** 默认处理器（模块级懒建：warm isolate 复用同一份装配） */
let defaultHandler: CloudflareHandler | null = null;

/**
 * Workers 默认导出：`export default { fetch }`。
 *
 * 部署侧入口只需要一行转发（见包 README 的 `src/index.js`）。
 */
export default {
  /**
   * Workers 请求入口
   * @param request Workers 请求对象
   * @param env 环境变量与绑定
   * @param executionCtx 执行上下文
   * @returns Workers 响应
   */
  fetch(request: Request, env: CloudflareEnvLike, executionCtx?: ExecutionContextLike) {
    defaultHandler ??= createCloudflareFunc();
    return defaultHandler(request, env, executionCtx);
  },
};
