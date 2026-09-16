/**
 * 后端事件名常量（Scope E：26 事件 + 1.x 兼容分支）。
 *
 * 口径说明：计划 Scope E 列出 26 个后端事件槽位，其中 `HIDDEN` / `VISIBLE` 合并占用
 * 一个槽位（2.0 已统一为 `COMMENT_GET_FOR_ADMIN` 的 `type` 参数，但按 BC 策略保留独立
 * 分支至 2.2.0），加上内部钩子 `POST_SUBMIT` 的兼容分支，因此本文件共导出 **27 个**
 * 标识符。客户端的 `api.ts`、`@twikoojs/common` 的事件分发器与契约测试均以此为单一事实来源。
 */

/** 获取后端函数版本号，客户端用于探测服务端能力与版本兼容性 */
export const GET_FUNC_VERSION = 'GET_FUNC_VERSION';

/** 获取评论列表（前台，按 URL / 分页 / 排序返回可见评论） */
export const COMMENT_GET = 'COMMENT_GET';

/** 获取评论列表（管理员视图，含待审核与隐藏评论） */
export const COMMENT_GET_FOR_ADMIN = 'COMMENT_GET_FOR_ADMIN';

/** 管理员更新单条评论（审核状态、可见性、置顶等） */
export const COMMENT_SET_FOR_ADMIN = 'COMMENT_SET_FOR_ADMIN';

/** 管理员删除评论 */
export const COMMENT_DELETE_FOR_ADMIN = 'COMMENT_DELETE_FOR_ADMIN';

/** 用户删除自己的评论 */
export const COMMENT_DELETE_FOR_USER = 'COMMENT_DELETE_FOR_USER';

/** 管理员批量导入评论 */
export const COMMENT_IMPORT_FOR_ADMIN = 'COMMENT_IMPORT_FOR_ADMIN';

/** 管理员导出评论 */
export const COMMENT_EXPORT_FOR_ADMIN = 'COMMENT_EXPORT_FOR_ADMIN';

/** 点赞 / 取消点赞评论 */
export const COMMENT_LIKE = 'COMMENT_LIKE';

/** 提交新评论 */
export const COMMENT_SUBMIT = 'COMMENT_SUBMIT';

/** 获取页面评论计数 */
export const COUNTER_GET = 'COUNTER_GET';

/** 查询是否已设置管理密码（不返回密码本身） */
export const GET_PASSWORD_STATUS = 'GET_PASSWORD_STATUS';

/** 首次设置管理密码 */
export const SET_PASSWORD = 'SET_PASSWORD';

/** 获取前台可公开的配置项 */
export const GET_CONFIG = 'GET_CONFIG';

/** 获取管理员完整配置项 */
export const GET_CONFIG_FOR_ADMIN = 'GET_CONFIG_FOR_ADMIN';

/** 保存配置 */
export const SET_CONFIG = 'SET_CONFIG';

/** 管理员登录，校验密码并返回鉴权令牌 */
export const LOGIN = 'LOGIN';

/** 获取评论总数（用于统计展示） */
export const GET_COMMENTS_COUNT = 'GET_COMMENTS_COUNT';

/** 获取最近评论列表 */
export const GET_RECENT_COMMENTS = 'GET_RECENT_COMMENTS';

/** 发送测试邮件，验证 SMTP 配置是否正确 */
export const EMAIL_TEST = 'EMAIL_TEST';

/** 上传图片到图床/存储 */
export const UPLOAD_IMAGE = 'UPLOAD_IMAGE';

/** 获取 QQ 昵称（用于评论者昵称自动填充） */
export const GET_QQ_NICK = 'GET_QQ_NICK';

/** 申请验证码（生成 challenge） */
export const CAP_CHALLENGE = 'CAP_CHALLENGE';

/** 兑换验证码（校验 challenge 答案） */
export const CAP_REDEEM = 'CAP_REDEEM';

/**
 * 提交后内部钩子（评论提交成功后触发通知 / 反垃圾等后续动作）。
 *
 * 2.0 起同时作为 1.x 调用方的兼容入口，按 BC 策略保留至 **2.2.0**。
 */
export const POST_SUBMIT = 'POST_SUBMIT';

/**
 * 隐藏评论（1.x 独立事件）。
 *
 * 2.0 已统一为 `COMMENT_GET_FOR_ADMIN` 的 `type` 参数，按 BC 策略保留独立分支至 **2.2.0**。
 */
export const HIDDEN = 'HIDDEN';

/**
 * 显示评论（1.x 独立事件）。
 *
 * 2.0 已统一为 `COMMENT_GET_FOR_ADMIN` 的 `type` 参数，按 BC 策略保留独立分支至 **2.2.0**。
 */
export const VISIBLE = 'VISIBLE';

/**
 * 后端事件名清单（27 个标识符，含 1.x 兼容分支）。
 *
 * 由上述常量聚合而成，字符串值不重复书写；供契约测试遍历与分发器覆盖度校验使用，
 * 保证新增事件时只需维护一处常量与一处聚合。
 */
export const ALL_EVENTS = [
  GET_FUNC_VERSION,
  COMMENT_GET,
  COMMENT_GET_FOR_ADMIN,
  COMMENT_SET_FOR_ADMIN,
  COMMENT_DELETE_FOR_ADMIN,
  COMMENT_DELETE_FOR_USER,
  COMMENT_IMPORT_FOR_ADMIN,
  COMMENT_EXPORT_FOR_ADMIN,
  COMMENT_LIKE,
  COMMENT_SUBMIT,
  COUNTER_GET,
  GET_PASSWORD_STATUS,
  SET_PASSWORD,
  GET_CONFIG,
  GET_CONFIG_FOR_ADMIN,
  SET_CONFIG,
  LOGIN,
  GET_COMMENTS_COUNT,
  GET_RECENT_COMMENTS,
  EMAIL_TEST,
  UPLOAD_IMAGE,
  GET_QQ_NICK,
  CAP_CHALLENGE,
  CAP_REDEEM,
  POST_SUBMIT,
  HIDDEN,
  VISIBLE,
] as const;

/** 后端事件名的字面量联合类型，取自 {@link ALL_EVENTS} 的成员 */
export type TwikooEvent = (typeof ALL_EVENTS)[number];