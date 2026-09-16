/**
 * 用户与管理员鉴权服务（1.x vercel isAdmin/login/setPassword/getPasswordStatus
 * 语义对齐）。
 *
 * 令牌语义（1.7.24）：匿名访客的 accessToken 即 uid；管理员 accessToken 是
 * 登录时签发的 md5(ADMIN_PASS)，因此 `md5(accessToken) === config.ADMIN_PASS`
 * 即判定为管理员（对账无需额外存储）。
 */
import type { CommentDoc, ConfigData } from "../ports/database";
import type { TkResponseBody } from "../ports/response";
import { RES_CODE } from "../utils/constants";
import { md5 } from "../utils/crypto";
import { validate } from "../utils/validate";

/**
 * 判断是否管理员（1.x isAdmin 对齐：md5(token) 与 ADMIN_PASS 比对）。
 * @param config 全量配置
 * @param accessToken 请求令牌
 * @returns 是否管理员
 */
export function isAdmin(config: ConfigData, accessToken: string): boolean {
  return config.ADMIN_PASS === md5(accessToken);
}

/**
 * 管理员登录（1.x login 逐行对齐）。
 * @param config 全量配置
 * @param password 管理密码（明文）
 * @returns 登录响应
 */
export function login(config: ConfigData, password: unknown): TkResponseBody {
  if (!config) {
    return { code: RES_CODE.CONFIG_NOT_EXIST, message: "数据库无配置" };
  }
  if (!config.ADMIN_PASS) {
    return { code: RES_CODE.PASS_NOT_EXIST, message: "未配置管理密码" };
  }
  // 密码比对：客户端本地算 md5(密码) 作为 accessToken 上送，此处直接比对
  if (typeof password !== "string" || config.ADMIN_PASS !== md5(password)) {
    return { code: RES_CODE.PASS_NOT_MATCH, message: "密码错误" };
  }
  // 1.x 语义：成功只返回 code 0（管理员 token 由客户端本地计算保存）
  return { code: RES_CODE.SUCCESS };
}

/**
 * 写入管理密码（1.x setPassword 对齐：库中无密码可直接写入；已有密码需管理员）。
 * @param ctx 配置与鉴权载荷
 * @returns 响应体
 */
export async function setPassword(options: {
  config: ConfigData;
  accessToken: string;
  password: unknown;
  saveConfig: (config: ConfigData) => Promise<void>;
}): Promise<TkResponseBody> {
  const { config, accessToken, password, saveConfig } = options;
  const isAdminUser = isAdmin(config, accessToken);
  // 如果数据库里没有密码，则写入密码；如果已有密码，则只有管理员可以写入
  if (config.ADMIN_PASS && !isAdminUser) {
    return { code: RES_CODE.PASS_EXIST, message: "请先登录再修改密码" };
  }
  validate({ password }, ["password"]);
  if (typeof password !== "string") {
    return { code: RES_CODE.FAIL, message: '参数"password"不合法' };
  }
  await saveConfig({ ADMIN_PASS: md5(password) });
  return { code: RES_CODE.SUCCESS };
}

/**
 * 判断是否存在管理员密码（1.x getPasswordStatus 对齐）。
 * @param config 全量配置
 * @param version 当前版本
 * @returns 状态响应
 */
export function getPasswordStatus(config: ConfigData, version: string): TkResponseBody {
  return {
    code: RES_CODE.SUCCESS,
    status: !!config.ADMIN_PASS,
    credentials: !!config.CREDENTIALS,
    version,
  };
}

/**
 * 校验评论归属：确认评论存在且属于当前用户（1.x checkCommentOwnership 对齐，
 * 含防 undefined 归属误判的兜底）。
 * @param id 评论 id
 * @param uid 用户 token
 * @param getComment 单条查询函数
 * @returns 归属的评论
 */
export async function checkCommentOwnership(
  id: unknown,
  uid: string,
  getComment: (id: string) => Promise<Partial<CommentDoc> | null>,
): Promise<Partial<CommentDoc>> {
  validate({ id }, ["id"]);
  if (typeof id !== "string") {
    throw new Error('参数"id"必须是字符串');
  }
  const comment = await getComment(id);
  if (!comment) {
    throw new Error("评论不存在");
  }
  // 无 token 的请求不具备任何归属权，防止双方同时 undefined 误判为本人
  if (!uid || comment.uid !== uid) {
    throw new Error("只能删除自己的评论");
  }
  return comment;
}
