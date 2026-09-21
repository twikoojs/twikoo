/**
 * SMTP Bridge（EO Makers 邮件的 HTTP 桥接）。
 *
 * 移植自 1.x `src/server/eo-makers/cloud-functions/index.js` 的 SMTP Bridge 段
 * （L73-281）与 nodemailer 垫片（L283-346）。
 *
 * **为什么需要它**：EO Makers 的 edge 运行时不能建裸 TCP 连接，nodemailer 的 SMTP
 * 通路不可用。1.x 因此给了两条出路：
 *
 * 1. `SMTP_SERVICE` 为 `SendGrid` / `MailChannels` → 直接调各自的 HTTP API；
 * 2. 配置 `SMTP_HOST` → 经用户自部署的 Go SMTP Bridge（HTTP）转发。
 *
 * **自动发现的安全模型**：Bridge 候选地址来自 `envId`、`Origin`、`Host` 头——其中
 * `Host` 是客户端可控的，所以**不直接信任**候选，而是先发一次 `probe`：Bridge 用共享
 * 密钥对 `nonce + bridgeHost` 做 HMAC-SHA256，适配器侧核对签名、host 并做定时安全比较，
 * 全部通过才认定该地址是自己人的 Bridge。命中后回填到上下文，同一次请求内不再重复探测。
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { TkRequest } from "@twikoojs/common";

/** Bridge 端点路径（1.x EO_SMTP_BRIDGE_PATH 对齐） */
const SMTP_BRIDGE_PATH = "/smtp";

/** probe 超时（1.x SMTP_BRIDGE_PROBE_TIMEOUT_MS 对齐） */
const PROBE_TIMEOUT_MS = 5000;

/** Bridge 请求所用的 SMTP 配置形态（由 nodemailer 垫片截获，非 nodemailer 的规范类型） */
export interface BridgeMailConfig {
  /** SMTP 主机（配置 SMTP_HOST 时才有） */
  host?: string;
  /** SMTP 端口 */
  port?: number;
  /** 是否直接 TLS */
  secure?: boolean;
  /** 认证信息 */
  auth?: { user?: string; pass?: string };
}

/** 请求级 Bridge 上下文 */
export interface MailBridgeContext {
  /** 候选地址（已规范化、去重） */
  urls: string[];
  /** 共享密钥（TWIKOO_SMTP_BRIDGE_TOKEN）；未配置为空串，用到时才报错 */
  token: string;
  /** 已探测通过的候选（首次成功后回填） */
  url?: string;
}

/** 请求级上下文存储（邮件在 fire-and-forget 的后置副作用里发出，仍属同一异步上下文） */
const mailBridgeStorage = new AsyncLocalStorage<MailBridgeContext>();

/**
 * 在 Bridge 上下文中执行（1.x withMailBridgeContext 对齐）。
 * @param context 本次请求的 Bridge 上下文
 * @param fn 待执行的函数
 * @returns fn 的返回值
 */
export function withMailBridgeContext<T>(context: MailBridgeContext, fn: () => T): T {
  return mailBridgeStorage.run(context, fn);
}

/**
 * 规范化 Bridge 地址：只接受 http(s)、路径统一为 `/smtp`、去掉 hash。
 * @param url 原始地址
 * @returns 规范化后的地址；非法返回空串
 */
function normalizeSmtpBridgeUrl(url: string): string {
  try {
    const parsed = new URL(String(url || "").trim());
    if (!/^https?:$/i.test(parsed.protocol)) return "";
    if (parsed.pathname.replace(/\/+$/, "") !== SMTP_BRIDGE_PATH) {
      parsed.pathname = SMTP_BRIDGE_PATH;
    }
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return "";
  }
}

/**
 * 追加一个候选地址（裸域名按给定协议补全；非法或重复则丢弃）。
 * @param candidates 候选列表
 * @param value 原始值（可为空）
 * @param protocol 缺省协议
 */
function addSmtpBridgeCandidate(candidates: string[], value: unknown, protocol?: string): void {
  // 只接受字符串与数字：对象会被 String() 转成 "[object Object]" 而变成垃圾候选
  if (typeof value !== "string" && typeof value !== "number") return;
  const raw = String(value).trim();
  if (!raw) return;
  const url = normalizeSmtpBridgeUrl(
    /^https?:\/\//i.test(raw) ? raw : `${protocol || "https"}://${raw}`,
  );
  if (url && !candidates.includes(url)) candidates.push(url);
}

/**
 * 取地址的小写 host（用于签名与校验）。
 * @param url Bridge 地址
 * @returns host；非法返回空串
 */
function bridgeHostOf(url: string): string {
  try {
    return new URL(url).host.toLowerCase().replace(/\.$/, "");
  } catch {
    return "";
  }
}

/**
 * 格式化地址用于错误提示（去掉查询串与 hash，避免泄露 token 类参数）。
 * @param url Bridge 地址
 * @returns 脱敏后的地址
 */
function formatForError(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return String(url || "");
  }
}

/**
 * 计算 probe 签名（1.x signSmtpBridgeProbe 对齐：HMAC-SHA256 over nonce\nhost）。
 * @param token 共享密钥
 * @param nonce 随机数
 * @param host Bridge host
 * @returns 十六进制签名
 */
function signProbe(token: string, nonce: string, host: string): string {
  return createHmac("sha256", token).update(nonce).update("\n").update(host).digest("hex");
}

/**
 * 十六进制串的定时安全比较（1.x timingSafeEqualHex 对齐）。
 * @param a 待比较值
 * @param b 期望值
 * @returns 是否相等
 */
function timingSafeEqualHex(a: string, b: string): boolean {
  try {
    const left = Buffer.from(String(a || ""), "hex");
    const right = Buffer.from(String(b || ""), "hex");
    return left.length === right.length && timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

/**
 * 探测一个候选地址是否为可信任的 Bridge。
 * @param url 候选地址
 * @param token 共享密钥
 * @returns 是否通过
 */
async function verifySmtpBridgeUrl(url: string, token: string): Promise<boolean> {
  const host = bridgeHostOf(url);
  if (!host) return false;

  const nonce = randomBytes(16).toString("hex");
  let response: Response;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "probe", nonce, bridgeHost: host }),
      signal: controller.signal,
    });
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }

  let result: { ok?: boolean; bridgeHost?: string; signature?: string };
  try {
    result = (await response.json()) as { ok?: boolean; bridgeHost?: string; signature?: string };
  } catch {
    return false;
  }

  return (
    response.ok &&
    result.ok === true &&
    result.bridgeHost === host &&
    timingSafeEqualHex(String(result.signature ?? ""), signProbe(token, nonce, host))
  );
}

/**
 * 取可用的 Bridge 地址（逐个探测，首次命中即回填）。
 * @param context Bridge 上下文
 * @returns Bridge 地址
 */
async function getSmtpBridgeUrl(context: MailBridgeContext): Promise<string> {
  if (context.url) return context.url;
  for (const url of context.urls ?? []) {
    if (await verifySmtpBridgeUrl(url, context.token)) {
      context.url = url;
      return url;
    }
  }
  const candidates = context.urls?.length ? context.urls.map(formatForError).join(", ") : "无";
  throw new Error(
    `EdgeOne Makers SMTP Bridge 自动发现失败，未找到可校验的 /smtp 地址。候选地址：${candidates}`,
  );
}

/**
 * 向 Bridge 发起请求（verify / send）。
 * @param action 动作
 * @param mailConfig SMTP 配置
 * @param mail 邮件内容（send 时用）
 * @returns Bridge 返回体
 */
export async function requestSmtpBridge(
  action: "verify" | "send",
  mailConfig: BridgeMailConfig,
  mail: { from?: string; to?: string; subject?: string; html?: string } = {},
): Promise<unknown> {
  const context = mailBridgeStorage.getStore();
  if (!context?.token) {
    throw new Error("使用自定义 SMTP 需要配置 TWIKOO_SMTP_BRIDGE_TOKEN 环境变量。");
  }
  const bridgeUrl = await getSmtpBridgeUrl(context);

  const response = await fetch(bridgeUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${context.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action,
      host: mailConfig.host,
      port: mailConfig.port,
      secure: mailConfig.secure,
      user: mailConfig.auth?.user,
      pass: mailConfig.auth?.pass,
      from: mail.from,
      to: mail.to,
      subject: mail.subject,
      html: mail.html,
    }),
  });

  let result: { ok?: boolean; message?: string };
  try {
    result = (await response.json()) as { ok?: boolean; message?: string };
  } catch {
    throw new Error(`SMTP Bridge 返回异常：HTTP ${response.status}`);
  }
  if (!response.ok || !result.ok) {
    throw new Error(
      result.message ||
        `SMTP Bridge 请求失败：${formatForError(bridgeUrl)} HTTP ${response.status}`,
    );
  }
  return result;
}

/**
 * 由请求构造 Bridge 上下文（1.x createMailBridgeContext 对齐）。
 *
 * 1.x 还合并了 `req.env`，2.0 的 {@link TkRequest} 没有该字段，故只读 `process.env`。
 * @param request 内部统一请求
 * @returns Bridge 上下文
 */
export function createMailBridgeContext(request: TkRequest): MailBridgeContext {
  const token = process.env.TWIKOO_SMTP_BRIDGE_TOKEN ?? "";
  const protocol = request.headers["x-forwarded-proto"] || "https";
  const body = request.body as { envId?: unknown };
  const candidates: string[] = [];
  addSmtpBridgeCandidate(candidates, body?.envId);
  addSmtpBridgeCandidate(candidates, request.headers.origin);
  addSmtpBridgeCandidate(candidates, request.headers.host, protocol);
  return { urls: candidates, token };
}
