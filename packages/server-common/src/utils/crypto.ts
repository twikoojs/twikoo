/**
 * 哈希工具（1.x lib.js 的 getMd5/getSha256 对齐，Node 内置 crypto，零依赖）。
 */
import { createHash } from "node:crypto";
import { toStr } from "./safe-str";

/**
 * 计算 MD5（1.x getMd5 语义：输入 String 化）。
 * @param message 输入
 * @returns 32 位十六进制摘要
 */
export function md5(message: unknown): string {
  return createHash("md5").update(toStr(message)).digest("hex");
}

/**
 * 计算 SHA-256（1.x getSha256 语义：null/undefined 视为空串）。
 * @param message 输入
 * @returns 64 位十六进制摘要
 */
export function sha256(message: unknown): string {
  return createHash("sha256")
    .update(message == null ? "" : toStr(message))
    .digest("hex");
}
