/**
 * EdgeOne Makers Node Function 平台入口（契约层）。
 *
 * **平台契约**（`makers.edgeone.link/document/node-functions`，2026-09-24 在真实项目实测确认）：
 *
 * - 函数置于项目根 `cloud-functions/` 目录，平台按目录生成路由；
 *   `cloud-functions/index.js` 映射到 `PATH: /`（实测路由表确认）。
 * - 入口导出 `onRequest(context)`（或 `onRequestGet` / `onRequestPost` 等按方法分派），
 *   **必须返回 Web 标准 `Response`**。
 * - `context.request` 是 Web 标准 `Request`；`context.clientIp` 客户端 IP（实测可用，
 *   实测 context 键为 `clientIp / env / geo / params / request / server / uuid`）。
 * - 运行时为 **Node v20.19.3**（实测；构建环境是 v22.21.1，两者不同）。
 * - **静态资源与函数路由冲突时静态资源优先**（实测：根目录有 `index.html` 时 `/` 返回 HTML，
 *   删掉后 `/` 才落到函数）。故本包部署产物根目录**不得**包含 `index.html`。
 *
 * 本文件是平台契约与内部统一事件（`EoEventLike` / `EoResult`）之间的**唯一转换层**：
 * 平台细节只在这里出现，`src/main.ts` 保持平台无关、可直接单测。
 * 结构与 `packages/server-cloudflare` 的同名转换层保持一致（同为 Web Request/Response 宿主）。
 */
import type { TkRequestBody } from "@twikoojs/common";
import { handler, type EoEventLike, type EoResult } from "../main";

/**
 * 平台 EventContext 的最小结构面（只声明本适配器用到的字段）。
 *
 * `env` / `clientIp` 在实测中确实存在，但按平台文档它们可能缺省（本地调试、其他宿主），
 * 故全部标为可选。
 */
export interface EoContext {
  /** Web 标准请求对象 */
  request: Request;
  /** 环境变量 */
  env?: Record<string, string | undefined>;
  /** 客户端 IP（平台解析，优于自行读转发头） */
  clientIp?: string;
  /** 动态路由参数（本适配器固定挂根路径，实际不会用到） */
  params?: Record<string, string>;
}

/**
 * 把 `context.env` 合并进 `process.env`。
 *
 * **为什么需要**：平台把用户配置的环境变量放在 `context.env`，而 `@twikoojs/common` 与
 * 本适配器的 `mail/smtp-bridge.ts` 都是按 Node 惯例直接读 `process.env`（1.x 的 EO 实现
 * 是在入口把 `context.env` 合并进自己的 runtimeEnv，2.0 少了这一步，导致
 * `TWIKOO_SMTP_BRIDGE_TOKEN` / `SMTP_HOST` 等配置在该平台完全读不到）。
 *
 * 实测两个来源高度重叠（`context.env` 76 项 / `process.env` 61 项），但用户自定义变量
 * 究竟落在哪一侧无法从环境名判断，故以 `context.env` 为准写入：它缺失的键不会被动到，
 * 它存在的键覆盖 `process.env` 中可能陈旧的值。
 * @param env 平台环境变量
 */
export function applyContextEnv(env?: Record<string, string | undefined>): void {
  if (!env) return;
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined) process.env[key] = value;
  }
}

/**
 * 读取并解析请求体（JSON；非法或空体归一为 `{}`）。
 *
 * 为什么在入口解析而不是在 `toTkRequest` 里：`RequestPort.toTkRequest` 是**同步**契约
 * （见 `@twikoojs/common` 的 `ports/request.ts`），而 `request.json()` 是异步的。
 * @param request 平台请求对象
 * @returns 请求体（含 `event` / `accessToken`）
 */
async function readRequestBody(request: Request): Promise<TkRequestBody> {
  const method = String(request.method ?? "POST").toUpperCase();
  if ((method !== "POST" && method !== "PUT" && method !== "PATCH") || !request.body) {
    return {} as TkRequestBody;
  }
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
 * @param request 平台请求对象
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
 * 解析客户端 IP。
 *
 * 优先用平台给出的 `context.clientIp`（实测可用，且不依赖部署形态）；缺失时回落到
 * 转发头。三分支而非 `??` 串联：空串在 `??` 下不会被跳过，而「头存在但为空」并不代表
 * 拿到了 IP。
 * @param headers 小写化的请求头
 * @param clientIp 平台提供的客户端 IP
 * @returns 客户端 IP；均缺失时为空串
 */
function resolveIp(headers: Record<string, string>, clientIp?: string): string {
  if (clientIp) return clientIp;
  const forwarded = headers["x-forwarded-for"];
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers["x-real-ip"] ?? "";
}

/**
 * 平台上下文 → 内部统一事件。
 *
 * 先合并环境变量：`main.ts` 侧（邮件桥接、限流、日志级别等）在请求处理过程中随时读
 * `process.env`，必须在使用前就位。
 * @param context 平台 EventContext
 * @returns 内部统一事件
 */
export async function toEoEvent(context: EoContext): Promise<EoEventLike> {
  applyContextEnv(context.env);
  const { request } = context;
  const headers = collectHeaders(request);
  return {
    method: String(request.method ?? "POST").toUpperCase(),
    headers,
    body: await readRequestBody(request),
    ip: resolveIp(headers, context.clientIp),
    env: context.env,
  };
}

/**
 * 内部统一结果 → Web 标准响应（状态码与响应头透传；204 无体）。
 * @param result 内部统一结果
 * @returns Web 标准 `Response`
 */
export function toResponse(result: EoResult): Response {
  if (result.status === 204) {
    return new Response(null, { status: 204, headers: result.headers });
  }
  return new Response(result.body, {
    status: result.status,
    headers: { ...result.headers, "Content-Type": "application/json;charset=UTF-8" },
  });
}

/**
 * 平台函数入口（`cloud-functions/index.js` 的默认导出语义）。
 *
 * OPTIONS 预检由 `@twikoojs/common` 的 pipeline 统一处理（返回 204 + 5 个 CORS 头），
 * 故这里无需单独导出 `onRequestOptions`，全部方法走同一入口。
 * @param context 平台 EventContext
 * @returns Web 标准 `Response`
 */
export async function onRequest(context: EoContext): Promise<Response> {
  return toResponse(await handler(await toEoEvent(context)));
}

export default onRequest;
