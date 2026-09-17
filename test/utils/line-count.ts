/**
 * 源码行数计数（统一口径，F2 建议 #2）。
 *
 * 各适配器「< 150 行」门禁曾混用两种计数口径：
 *   - 裸 `.split("\n").length`：文件末尾换行会多计 1 行；
 *   - `.trimEnd().split("\n").length`：先去尾换行再切分。
 * 此处统一为先 trimEnd 再切分，消除尾换行导致的 +1 误差。
 *
 * 仅负责「计数」；门禁的具体阈值（< / <=）与统计文件集合由各适配器测试自行决定，
 * 不在本 helper 内固化，以免变更既有门禁语义（self-hosted 仅数 main.ts，
 * edgeone/deta 用 <=，其余用 <）。
 */
export function countSourceLines(content: string): number {
  return content.trimEnd().split("\n").length;
}
