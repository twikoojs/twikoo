/**
 * Cloudflare Workers 入口：转换平台载荷、注入适配器并管理请求内连接。
 * 业务逻辑由 @twikoojs/common 处理；数据库、能力与部署配置见本包 README。
 */
import { RES_CODE, createHandler, scaffoldAdapters, setCustomLibs } from "@twikoojs/common";
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
import { CloudflareMongoDatabase } from "./database/mongo";
import { createCloudflareDispatcher } from "./dispatch";
import { createNativeFormData } from "./form-data";
import {
  createCloudflareIp2Region,
  rememberRequestGeo,
  type CfPropertiesLike,
} from "./geo/region-store";
import { createCloudflareNodemailer } from "./mail/nodemailer";

/**
 * Cloudflare 平台能力：IP 属地由 request.cf 与落库数据提供，上传使用原生 FormData。
 * 其余已启用能力使用公共层的真实依赖；Akismet 与腾讯云内容审核仍关闭。
 */
export const cloudflareCapabilities: Capabilities = {
  mail: true,
  domPurify: true,
  ip2region: true,
  akismet: false,
  tencentTms: false,
  imageUpload: true,
  qqAvatar: true,
  ai: true,
};

/** Cloudflare 环境变量与绑定（`wrangler.toml` 的 `[vars]` / `[[d1_databases]]`） */
export interface CloudflareEnvLike {
  /** D1 数据库绑定 */
  DB?: D1DatabaseLike;
  /** MongoDB 连接串；配置后优先于 D1，每次请求独立建连 */
  MONGODB_URI?: string;
  /** MongoDB 数据库名；未配置时沿用连接串中的数据库名 */
  MONGODB_DB_NAME?: string;
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

/** 注入 HTTP 邮件兼容层、原生 FormData 与 request.cf 属地查询；其余库由公共层加载。 */
export function installCloudflareLibs(): void {
  setCustomLibs({
    // 保留 HTTP 邮件通道；常规 SMTP 使用请求内创建和关闭的真实 Nodemailer 连接。
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
      '未绑定 D1 数据库：请在 wrangler.toml 中声明 [[d1_databases]] 并设置 binding = "DB"',
    );
  }
  const cached = databases.get(binding);
  if (cached) return cached;
  const created = new D1Database(binding);
  databases.set(binding, created);
  return created;
}

/**
 * 装配本次请求的运行态（覆写公共库 + MongoDB 或 D1）。
 * MongoDB 不跨请求缓存；D1 仍按绑定复用。
 * @param env 环境绑定
 * @returns 数据库端口实现
 */
export function prepareCloudflareRuntime(env: CloudflareEnvLike): Promise<Database> {
  installCloudflareLibs();
  return Promise.resolve(
    env.MONGODB_URI
      ? new CloudflareMongoDatabase({ uri: env.MONGODB_URI, dbName: env.MONGODB_DB_NAME })
      : getD1Database(env),
  );
}

/**
 * 创建 Worker 请求处理器（注入的数据库由调用方管理，不在请求结束时关闭）。
 * @param options 注入项
 * @returns 逐请求处理器
 */
export function createCloudflareFunc(options: { database?: Database } = {}): CloudflareHandler {
  return async (request, env = {}, executionCtx) => {
    let ownedDatabase: Database | undefined;
    const pending: Promise<unknown>[] = [];
    try {
      const ip = resolveIp(collectHeaders(request));
      // 属地：记住「本次请求 IP → request.cf 属地」，供提交时落库
      rememberRequestGeo(ip, readCf(request));
      const body = await readRequestBody(request);
      if (options.database) installCloudflareLibs();
      const database = options.database ?? (await prepareCloudflareRuntime(env));
      if (!options.database && env.MONGODB_URI) ownedDatabase = database;
      const tkRequest = toTkRequest({
        request,
        env,
        executionCtx: ownedDatabase
          ? {
              /** 收集真实后置任务，关闭 MongoDB 时等待它们全部完成。 */
              waitUntil(promise) {
                pending.push(promise);
              },
            }
          : executionCtx,
        body,
      });
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
    } finally {
      if (ownedDatabase) {
        const database = ownedDatabase;
        const cleanup = Promise.allSettled(pending)
          .then(() => database.close?.())
          .catch((error: unknown) => {
            // 关闭失败只记录日志，不覆盖已经生成的业务响应。
            console.error("MongoDB 连接关闭失败", error);
          });
        if (pending.length && typeof executionCtx?.waitUntil === "function") {
          executionCtx.waitUntil(cleanup);
        } else {
          // 离线调用没有后台执行窗口，必须等待后置任务与连接收尾。
          await cleanup;
        }
      }
    }
  };
}

/** 默认处理器（模块级懒建：warm isolate 复用同一份装配） */
let defaultHandler: CloudflareHandler | null = null;

/** Workers 默认入口。 */
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
