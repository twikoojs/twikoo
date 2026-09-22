/**
 * 请求处理管线（规范 core/pipeline.ts；标准流程）。
 *
 * 八步编排（1.7.24 vercel 入口流程语义对齐）：
 * 1. protect 限流（requestTimes 按 IP 累计，超限 429）
 * 2. validateClientFields（防 NoSQL 操作符注入）
 * 3. 生成 accessToken（匿名签到：回传则复用，否则签发）
 * 4. 连库（database.init()，实现保证幂等）
 * 5. readConfig（getConfig() ?? {}，失败降级空配置）
 * 6. allowCors（localhost 正则 + CORS_ALLOW_ORIGIN 白名单 → 响应头）
 * 7. OPTIONS 预检 → 204
 * 8. dispatch 分发事件 → 回填 res.accessToken → 返回
 *
 * 与 1.x 的差异（均为计划内改进）：
 * - 限流超限从「HTTP 200 + code 1000」升级为 HTTP 429（客户端 TwikooError
 *   按 429 映射「请求过于频繁」）；
 * - 异常响应体附带 `log` 字段（本次请求聚合日志，requestId 标注）。
 */
import { randomUUID } from "node:crypto";
// index.ts 的类型仅类型级导入（编译期擦除），避免运行时循环依赖
import type { TkAdapters, TkRequest, TkResponse, TkResponseBody } from "../index";
import type { ConfigData } from "../ports/database";
import { RateLimitError } from "./errors";
import { dispatch } from "./dispatcher";
import type { PipelineContext } from "./types";
import { RES_CODE, getMaxRequestTimes } from "../utils/constants";
import { createRequestLogger, type RequestLogger } from "../utils/logger";
import { validateClientFields } from "../utils/validate";

/** 限流计数器（1.x requestTimes 语义：按 IP 累计请求次数，进程生命周期内累计） */
const requestTimes: Record<string, number> = {};

/**
 * 清空限流计数器。
 * 使用方：self-hosted 适配器的定时清理（接线）；测试复位。
 */
export function resetRequestTimes(): void {
  for (const key of Object.keys(requestTimes)) {
    delete requestTimes[key];
  }
}

/**
 * 步骤 1：防御——按 IP 累计请求次数并检查上限（1.x protect 语义对齐）。
 * @param request 内部统一请求
 * @param logger 请求级日志器
 * @throws RateLimitError 超过 TWIKOO_THROTTLE（默认 250）上限
 */
function protect(request: TkRequest, logger: RequestLogger): void {
  const ip = request.ip;
  requestTimes[ip] = (requestTimes[ip] || 0) + 1;
  if (requestTimes[ip] > getMaxRequestTimes()) {
    logger.warn(`${ip} 当前请求次数为 ${requestTimes[ip]}，已超过最大请求次数`);
    throw new RateLimitError(ip);
  } else {
    logger.verbose(`${ip} 当前请求次数为 ${requestTimes[ip]}`);
  }
}

/**
 * 步骤 3：匿名签到（1.x anonymousSignIn 语义对齐）——请求已携带
 * accessToken 则复用，否则签发 32 位随机令牌（1.x 为 uuid 去连字符，
 * 2.0 用 Node 内置 crypto.randomUUID，零依赖等价）。
 * @param request 内部统一请求
 * @returns 本次请求生效的 accessToken
 */
function anonymousSignIn(request: TkRequest): string {
  const token = request.body.accessToken;
  if (typeof token === "string" && token) return token;
  return randomUUID().replace(/-/g, "");
}

/**
 * 步骤 6：CORS 规则（1.x allowCors + getAllowedOrigin 逐行对齐）。
 * 仅当请求携带 Origin 头时产出 CORS 响应头；放行规则：
 * localhost 正则恒放行 → config.CORS_ALLOW_ORIGIN 逗号白名单（条目去尾斜杠
 * 精确匹配）→ 未配置白名单时直接放行。
 * @param request 内部统一请求
 * @param config 全量配置
 * @returns CORS 响应头（无 Origin 时为空对象）
 */
function allowCors(request: TkRequest, config: ConfigData): Record<string, string> {
  const origin = request.headers.origin;
  if (!origin) return {};
  return {
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Origin": getAllowedOrigin(origin, config),
    "Access-Control-Allow-Methods": "POST",
    "Access-Control-Allow-Headers":
      "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version",
    "Access-Control-Max-Age": "600",
  };
}

/**
 * 计算放行的 Origin（1.x getAllowedOrigin 逐行对齐）。
 * @param origin 请求 Origin
 * @param config 全量配置
 * @returns 放行则为原 Origin；白名单不匹配为空串（禁止跨域）
 */
function getAllowedOrigin(origin: string, config: ConfigData): string {
  const localhostRegex = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d{1,5})?$/;
  if (localhostRegex.test(origin)) {
    // 判断是否为本地主机，如是则允许跨域
    return origin;
  } else if (config.CORS_ALLOW_ORIGIN) {
    // 如设置了安全域名则检查：以逗号分隔多条 CORS 规则，条目去尾斜杠后精确匹配
    const corsList = String(config.CORS_ALLOW_ORIGIN).split(",");
    for (let i = 0; i < corsList.length; i++) {
      const cors = corsList[i].replace(/\/$/, "");
      if (cors === origin) {
        return origin;
      }
    }
    return "";
  } else {
    // 未设置安全域名直接 Allow
    return origin;
  }
}

/**
 * 步骤 5：读取配置（1.x readConfig 语义对齐）——每次请求读取最新配置；
 * 读取失败降级为空配置并记录错误（1.x 建集合动作属于数据库实现的
 * init() 职责，见 MongoDatabase）。
 *
 * ⚠️ 降级结果与「真的没有配置」不可区分，因此必须把 `failed` 一并带出去：
 * 凡是「配置为空 ⇒ 放行」的分支都要看它（GHSA-v349-m8q5-7x2g）。
 * @param adapters 适配器聚合端口
 * @param logger 请求级日志器
 * @returns 全量配置（无配置为空对象）与该次读取是否失败
 */
async function readConfig(
  adapters: TkAdapters,
  logger: RequestLogger,
): Promise<{ config: ConfigData; failed: boolean }> {
  try {
    return { config: (await adapters.database.getConfig()) ?? {}, failed: false };
  } catch (e) {
    logger.error("读取配置失败：", e);
    return { config: {}, failed: true };
  }
}

/**
 * 错误消息提取（1.x `e.message` 语义；非 Error 值 String 化）。
 * @param e 捕获值
 * @returns 错误消息
 */
function getErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * 创建统一请求处理器（唯一入口 createHandler 的实现核心）：
 * 启动期以适配器聚合装配一次，返回逐请求调用的处理器。
 * @param adapters 适配器聚合端口
 * @returns 逐请求处理器（TkRequest → TkResponse）
 */
export function createPipeline(adapters: TkAdapters) {
  /**
   * 逐请求处理器：执行八步编排，任何异常统一转错误体（限流例外 → 429）。
   * @param request 已归一化的内部统一请求
   * @returns 内部统一响应
   */
  return async function handleRequest(request: TkRequest): Promise<TkResponse> {
    const logger = createRequestLogger();
    /** 响应头（CORS 等，异常路径也要保留已计算的头） */
    const headers: Record<string, string> = {};
    /** 响应体 */
    let body: TkResponseBody = { code: RES_CODE.SUCCESS };
    /** HTTP 状态（1.x 业务响应恒 200；429 限流 / 204 预检例外） */
    let status = 200;
    /** 步骤 3 产出，步骤 9 回填判断用 */
    let accessToken = "";
    try {
      protect(request, logger);
      // 统一校验客户端字段类型，防止查询操作符对象注入数据库查询条件
      validateClientFields(request.body);
      accessToken = anonymousSignIn(request);
      await adapters.database.init();
      const { config, failed: configReadFailed } = await readConfig(adapters, logger);
      Object.assign(headers, allowCors(request, config));
      if (request.method === "OPTIONS") {
        return { status: 204, body: {}, headers };
      }
      const ctx: PipelineContext = {
        request,
        requestId: logger.requestId,
        accessToken,
        config,
        configReadFailed,
        adapters,
        logger,
      };
      logger.verbose("请求函数：", request.body.event, "请求参数：", request.body);
      body = await dispatch(ctx);
    } catch (e) {
      logger.error(
        "Twikoo 遇到错误，请参考以下错误信息。如有疑问，请反馈至 https://github.com/twikoojs/twikoo/issues",
      );
      logger.error("请求参数：", request.body);
      logger.error("错误信息：", e);
      // 只回 code + message：聚合日志含请求参数与来访 IP，留在服务端，不回传前端
      body = {
        code: RES_CODE.FAIL,
        message: getErrorMessage(e),
      };
      if (e instanceof RateLimitError) status = 429;
    }
    // 步骤 9：回填 accessToken（1.x 语义：业务成功且请求未携带时才回填）
    if (!body.code && !request.body.accessToken) {
      body.accessToken = accessToken;
    }
    logger.verbose("请求返回：", body);
    return { status, body, headers };
  };
}
