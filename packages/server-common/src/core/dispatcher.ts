/**
 * 事件分发器（规范 core/dispatcher.ts）。
 *
 * 25 事件全量显式 switch（Scope E 清单）：24 个客户端事件解析到注册表中的
 * handler 实现；POST_SUBMIT 是服务端内部事件——后置副作用链的执行入口
 * （长期保留，带内部派发令牌校验）。事件清单在这里**显式枚举**
 * 正是契约保障：任何事件漏实现/漏断言，契约套件与 switch 清单的 diff
 * 立即可见（替代 1.x「各后端 switch 保持一致」的人工约定）。
 */
import {
  CAP_CHALLENGE,
  CAP_REDEEM,
  COMMENT_DELETE_FOR_ADMIN,
  COMMENT_DELETE_FOR_USER,
  COMMENT_EXPORT_FOR_ADMIN,
  COMMENT_GET,
  COMMENT_GET_FOR_ADMIN,
  COMMENT_IMPORT_FOR_ADMIN,
  COMMENT_LIKE,
  COMMENT_SET_FOR_ADMIN,
  COMMENT_SUBMIT,
  COUNTER_GET,
  EMAIL_TEST,
  GET_COMMENTS_COUNT,
  GET_CONFIG,
  GET_CONFIG_FOR_ADMIN,
  GET_FUNC_VERSION,
  GET_PASSWORD_STATUS,
  GET_QQ_NICK,
  GET_RECENT_COMMENTS,
  LOGIN,
  POST_SUBMIT,
  SET_CONFIG,
  SET_PASSWORD,
  UPLOAD_IMAGE,
  type TwikooEvent,
} from "@twikoojs/shared";
// 副作用导入：触发默认处理器注册
import "../handlers/index";
import { HandlerNotRegisteredError } from "./errors";
import { resolveHandler } from "./handler-registry";
import type { PipelineContext } from "./types";
import type { TkResponseBody } from "../ports/response";
import { RES_CODE } from "../utils/constants";
import { VERSION } from "@twikoojs/shared";

/**
 * 解析注册表并执行事件处理器；未注册（迁移未达）抛
 * HandlerNotRegisteredError，由 pipeline catch 统一转 FAIL 错误体。
 * @param ctx 请求上下文
 * @param event 事件名
 * @returns 事件响应体
 */
async function runRegistered(ctx: PipelineContext, event: TwikooEvent): Promise<TkResponseBody> {
  const handler = resolveHandler(event);
  if (!handler) throw new HandlerNotRegisteredError(event);
  return handler(ctx);
}

/**
 * 分发事件到对应处理器（标准流程第 8 步）。
 *
 * POST_SUBMIT 是唯一非客户端事件：后置副作用链的执行入口（长期保留），
 * 处理器内校验内部派发令牌以防外部滥用。
 * @param ctx 请求上下文
 * @returns 事件响应体
 */
export async function dispatch(ctx: PipelineContext): Promise<TkResponseBody> {
  // 线上传入的 body 不受类型约束，event 以运行时读取为准（缺失走 NO_PARAM 分支）
  const eventName = (ctx.request.body as { event?: TwikooEvent }).event;
  if (!eventName) {
    // 1.x 语义对齐：空请求体 = 健康检查，返回运行正常提示 + 版本号
    return {
      code: RES_CODE.NO_PARAM,
      message: "Twikoo 云函数运行正常，请参考 https://twikoo.js.org/frontend.html 完成前端的配置",
      version: VERSION,
    };
  }
  switch (eventName) {
    case GET_FUNC_VERSION:
      return runRegistered(ctx, GET_FUNC_VERSION);
    case COMMENT_GET:
      return runRegistered(ctx, COMMENT_GET);
    case COMMENT_GET_FOR_ADMIN:
      return runRegistered(ctx, COMMENT_GET_FOR_ADMIN);
    case COMMENT_SET_FOR_ADMIN:
      return runRegistered(ctx, COMMENT_SET_FOR_ADMIN);
    case COMMENT_DELETE_FOR_ADMIN:
      return runRegistered(ctx, COMMENT_DELETE_FOR_ADMIN);
    case COMMENT_DELETE_FOR_USER:
      return runRegistered(ctx, COMMENT_DELETE_FOR_USER);
    case COMMENT_IMPORT_FOR_ADMIN:
      return runRegistered(ctx, COMMENT_IMPORT_FOR_ADMIN);
    case COMMENT_EXPORT_FOR_ADMIN:
      return runRegistered(ctx, COMMENT_EXPORT_FOR_ADMIN);
    case COMMENT_LIKE:
      return runRegistered(ctx, COMMENT_LIKE);
    case COMMENT_SUBMIT:
      return runRegistered(ctx, COMMENT_SUBMIT);
    case COUNTER_GET:
      return runRegistered(ctx, COUNTER_GET);
    case GET_PASSWORD_STATUS:
      return runRegistered(ctx, GET_PASSWORD_STATUS);
    case SET_PASSWORD:
      return runRegistered(ctx, SET_PASSWORD);
    case GET_CONFIG:
      return runRegistered(ctx, GET_CONFIG);
    case GET_CONFIG_FOR_ADMIN:
      return runRegistered(ctx, GET_CONFIG_FOR_ADMIN);
    case SET_CONFIG:
      return runRegistered(ctx, SET_CONFIG);
    case LOGIN:
      return runRegistered(ctx, LOGIN);
    case GET_COMMENTS_COUNT:
      return runRegistered(ctx, GET_COMMENTS_COUNT);
    case GET_RECENT_COMMENTS:
      return runRegistered(ctx, GET_RECENT_COMMENTS);
    case EMAIL_TEST:
      return runRegistered(ctx, EMAIL_TEST);
    case UPLOAD_IMAGE:
      return runRegistered(ctx, UPLOAD_IMAGE);
    case GET_QQ_NICK:
      return runRegistered(ctx, GET_QQ_NICK);
    case CAP_CHALLENGE:
      return runRegistered(ctx, CAP_CHALLENGE);
    case CAP_REDEEM:
      return runRegistered(ctx, CAP_REDEEM);
    // POST_SUBMIT：后置副作用链的执行入口（长期保留）。实现见
    // handlers/post-submit.ts，内部校验 x-twikoo-recursion 内部派发令牌。
    case POST_SUBMIT:
      return runRegistered(ctx, POST_SUBMIT);
    default:
      // 1.x 语义对齐：未知事件返回统一错误体（客户端提示升级），不抛未捕获异常
      return {
        code: RES_CODE.EVENT_NOT_EXIST,
        message: "请更新 Twikoo 云函数至最新版本",
      };
  }
}
