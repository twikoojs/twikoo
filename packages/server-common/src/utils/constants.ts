/**
 * 服务端常量（1.7.24 `twikoo-func/utils/constants.js` 语义对齐）。
 *
 * RES_CODE 数值是**对外契约**：客户端按数值判断结果（如 0 成功、1403 未登录），
 * 禁止改动任何数值或删除键（BC 保障清单）。
 */

/**
 * 业务响应码（1.x RES_CODE 全量对齐）。
 * 0 = 成功；100 = 缺少 event 参数；1000 = 通用失败；1001 = 事件不存在；
 * 1010 = 密码已存在；1020 = 数据库无配置；1021/1025 = 凭证缺失/无效；
 * 1022/1023 = 密码未设置/不匹配；1024 = 需要登录；1403 = 禁止；
 * 1030 = Akismet 错误；1040 = 上传失败；1041 = NSFW 拒绝。
 */
export const RES_CODE = {
  /** 成功 */
  SUCCESS: 0,
  /** 缺少 event 参数（1.x 对空请求体返回运行正常提示 + 版本号） */
  NO_PARAM: 100,
  /** 通用失败 */
  FAIL: 1000,
  /** 事件不存在（客户端需更新版本） */
  EVENT_NOT_EXIST: 1001,
  /** 管理密码已存在（需先登录再修改） */
  PASS_EXIST: 1010,
  /** 数据库无配置 */
  CONFIG_NOT_EXIST: 1020,
  /** 凭证不存在 */
  CREDENTIALS_NOT_EXIST: 1021,
  /** 凭证无效 */
  CREDENTIALS_INVALID: 1025,
  /** 管理密码未设置 */
  PASS_NOT_EXIST: 1022,
  /** 管理密码不匹配 */
  PASS_NOT_MATCH: 1023,
  /** 需要登录 */
  NEED_LOGIN: 1024,
  /** 禁止（含 1.x POST_SUBMIT 递归头不匹配场景的历史值） */
  FORBIDDEN: 1403,
  /** Akismet 反垃圾检测出错 */
  AKISMET_ERROR: 1030,
  /** 图片上传失败 */
  UPLOAD_FAILED: 1040,
  /** 内容安全检测判定 NSFW 拒绝 */
  NSFW_REJECTED: 1041,
} as const;

/**
 * 单 IP 最大请求次数（1.x MAX_REQUEST_TIMES 语义：TWIKOO_THROTTLE 环境变量
 * 可覆盖，默认 250）。
 *
 * 实现为**调用时读取**而非模块加载时固化（1.x 为加载时读取）：进程内环境变量
 * 不会变化，行为等价；调用时读取让测试可用 vi.stubEnv 控制阈值，不必动模块
 * 加载顺序。
 */
export function getMaxRequestTimes(): number {
  return Number.parseInt(process.env.TWIKOO_THROTTLE ?? "", 10) || 250;
}
