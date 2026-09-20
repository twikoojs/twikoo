/**
 * 请求字段校验（1.7.24 `twikoo-func/utils/index.js` 的 validateClientFields 语义对齐）。
 */
import type { TkRequestBody } from "../ports/request";

/**
 * 请求参数校验（1.x validate 对齐：必传参数缺失/为空即报错）。
 * @param event 已解析的请求体
 * @param requiredParams 必传参数名列表
 */
export function validate(event: Record<string, unknown> = {}, requiredParams: string[] = []): void {
  for (const requiredParam of requiredParams) {
    if (!event[requiredParam]) {
      throw new Error(`参数"${requiredParam}"不合法`);
    }
  }
}

/**
 * 客户端字段类型校验，防止 NoSQL 查询条件注入。
 *
 * 以下字段会直接参与数据库查询或作为评论归属标识：如果传入对象，会被数据库
 * 解释为查询操作符（如 $ne、$gt），导致越权删除评论、绕过评论可见性限制等问题。
 * 允许字段缺省或为 null（兼容首次匿名请求），有值时必须是字符串。
 * @param event 已解析的请求体
 */
export function validateClientFields(event: TkRequestBody = { event: "GET_FUNC_VERSION" }): void {
  /** 必须为字符串的字段清单（1.x stringFields 对齐） */
  const stringFields = ["accessToken", "id", "url", "pid", "rid"];
  for (const field of stringFields) {
    const value = event[field];
    if (value !== undefined && value !== null && typeof value !== "string") {
      throw new Error(`参数"${field}"必须是字符串`);
    }
  }
  if (event.urls !== undefined && event.urls !== null) {
    const urls = event.urls;
    if (!Array.isArray(urls) || urls.some((url) => typeof url !== "string")) {
      throw new Error('参数"urls"必须是字符串数组');
    }
  }
}
