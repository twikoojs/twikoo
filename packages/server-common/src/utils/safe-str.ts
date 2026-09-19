/**
 * 安全字符串化工具（消除 [object Object] 风险的统一入口）。
 */

/**
 * 任意值转字符串：字符串原样；null/undefined 空串；其余 JSON 化。
 * @param v 任意值
 * @returns 字符串
 */
export function toStr(v: unknown): string {
  if (typeof v === "string") return v;
  if (v === undefined || v === null) return "";
  try {
    return JSON.stringify(v);
  } catch {
    return "";
  }
}
