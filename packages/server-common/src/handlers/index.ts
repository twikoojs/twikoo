/**
 * 事件处理器装配（规范 §6.2 handlers/）。
 *
 * 25 事件全量注册（一事件一文件）：24 个客户端事件 + 服务端内部事件 `POST_SUBMIT`
 * （后置副作用链的执行入口，见 `./post-submit.ts` 头注释，长期保留）。
 * dispatcher 模块加载时 import 本文件触发默认注册。
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
} from "@twikoojs/shared";
import { registerHandler } from "../core/handler-registry";
import { setPostSubmitService } from "../services/post-submit";
import { postCheckSpam, saveSpamCheckResult } from "../services/spam";
import { sendNotice } from "../services/notify";
import { getFuncVersion } from "./get-func-version";
import { postSubmitEvent } from "./post-submit";
import { commentGet } from "./comment-get";
import { commentGetForAdmin } from "./comment-get-for-admin";
import { commentSetForAdmin } from "./comment-set-for-admin";
import { commentDeleteForAdmin } from "./comment-delete-for-admin";
import { commentDeleteForUser } from "./comment-delete-for-user";
import { commentImportForAdmin } from "./comment-import-for-admin";
import { commentExportForAdmin } from "./comment-export-for-admin";
import { commentLike } from "./comment-like";
import { commentSubmit } from "./comment-submit";
import { counterGet } from "./counter-get";
import { getPasswordStatusEvent } from "./get-password-status";
import { setPasswordEvent } from "./set-password";
import { getConfig } from "./get-config";
import { getConfigForAdminEvent } from "./get-config-for-admin";
import { setConfigEvent } from "./set-config";
import { loginEvent } from "./login";
import { getCommentsCount } from "./get-comments-count";
import { getRecentComments } from "./get-recent-comments";
import { emailTestEvent } from "./email-test";
import { uploadImageEvent } from "./upload-image";
import { getQQNickEvent } from "./get-qq-nick";
import { capChallengeEvent, capRedeemEvent } from "./cap-challenge";

/**
 * 接线真实 postSubmit 服务（T18）：后置垃圾检测 → 回写结果 → 三路通知。
 *
 * 本服务是「副作用链的唯一实现」，被两条路径共用：
 * 1. 单次执行平台：适配器的派发端口递归自调用 → POST_SUBMIT 事件 → 本服务
 *    （1.x 的 HTTP 递归 / `callFunction` 语义，2.0 收敛到 postSubmit 端口）；
 * 2. 常驻进程平台与 eo-makers：适配器进程内直调本服务（不 await）。
 */
setPostSubmitService(async (comment, ctx) => {
  // 垃圾检测
  const isSpam = await postCheckSpam({
    comment,
    config: ctx.config,
    caps: ctx.adapters.capabilities,
    logger: ctx.logger,
  });
  await saveSpamCheckResult(ctx.adapters.database, comment, isSpam);
  // 发送通知
  await sendNotice({
    comment,
    config: ctx.config,
    caps: ctx.adapters.capabilities,
    logger: ctx.logger,
    /**
     *
     */
    getParentComment: async (current) => {
      if (!current.pid) return null;
      return ctx.adapters.database.getComment(current.pid);
    },
  });
  return { code: 0 };
});

/**
 * 注册默认事件处理器集（模块加载时执行一次；测试可在 resetHandlers() 后
 * 重新调用以恢复默认注册表）。
 */
export function registerDefaultHandlers(): void {
  registerHandler(GET_FUNC_VERSION, getFuncVersion);
  registerHandler(COMMENT_GET, commentGet);
  registerHandler(COMMENT_GET_FOR_ADMIN, commentGetForAdmin);
  registerHandler(COMMENT_SET_FOR_ADMIN, commentSetForAdmin);
  registerHandler(COMMENT_DELETE_FOR_ADMIN, commentDeleteForAdmin);
  registerHandler(COMMENT_DELETE_FOR_USER, commentDeleteForUser);
  registerHandler(COMMENT_IMPORT_FOR_ADMIN, commentImportForAdmin);
  registerHandler(COMMENT_EXPORT_FOR_ADMIN, commentExportForAdmin);
  registerHandler(COMMENT_LIKE, commentLike);
  registerHandler(COMMENT_SUBMIT, commentSubmit);
  registerHandler(COUNTER_GET, counterGet);
  registerHandler(GET_PASSWORD_STATUS, getPasswordStatusEvent);
  registerHandler(SET_PASSWORD, setPasswordEvent);
  registerHandler(GET_CONFIG, getConfig);
  registerHandler(GET_CONFIG_FOR_ADMIN, getConfigForAdminEvent);
  registerHandler(SET_CONFIG, setConfigEvent);
  registerHandler(LOGIN, loginEvent);
  registerHandler(GET_COMMENTS_COUNT, getCommentsCount);
  registerHandler(GET_RECENT_COMMENTS, getRecentComments);
  registerHandler(EMAIL_TEST, emailTestEvent);
  registerHandler(UPLOAD_IMAGE, uploadImageEvent);
  registerHandler(GET_QQ_NICK, getQQNickEvent);
  registerHandler(CAP_CHALLENGE, capChallengeEvent);
  registerHandler(CAP_REDEEM, capRedeemEvent);
  // POST_SUBMIT：后置副作用链的执行入口（长期保留，非兼容分支）
  registerHandler(POST_SUBMIT, postSubmitEvent);
}

registerDefaultHandlers();
