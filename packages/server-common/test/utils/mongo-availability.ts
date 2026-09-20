/**
 * mongodb-memory-server 的本机可用性判定（内存实例的共同前置条件）。
 *
 * **背景**：测试固定 `MONGOMS_VERSION=4.4.29`（driver 6.x 支持矩阵内的最小版，且 Windows
 * 全量 zip 体积远小于 8.x），而 **MongoDB 4.4 没有 macOS arm64 构建**——mongodb-memory-server
 * 在 Apple Silicon 上拿到的是 x64 版 mongod，未装 Rosetta 时 `spawn` 直接报
 * `spawn Unknown system error -86`。
 *
 * 原实现把 `MongoMemoryServer.create()` 放在 `beforeAll` 里，失败会以**未捕获异常**抛出：
 * 用例全部 skipped、文件却判 FAIL（本地跑全仓 `pnpm test` 必红，见计划文档）。
 *
 * **处置**：不可用时**整组跳过**而不是失败——这是环境能力问题，不是代码回归。
 * 其他环境（CI 的 linux x64、macOS x64、Windows）与装了 Rosetta 的 Apple Silicon 一律照常运行；
 * 已配置 `TEST_MONGODB_URI`（连真实实例、不需要内存实例）时也不受本判定影响。
 */
import { existsSync } from "node:fs";

/** Rosetta 2 的安装标记（Apple 官方安装位置；存在即可执行 x86_64 二进制） */
const ROSETTA_MARKER = "/Library/Apple/usr/share/rosetta/rosetta";

/**
 * 本机跑不了内存 mongod 的原因。
 * @returns 跳过原因（用于 describe 标题与日志）；可用时返回 null
 */
export function mongoMemoryServerUnavailableReason(): string | null {
  // 外部真实实例优先：给了 TEST_MONGODB_URI 就不需要内存实例，判定不生效
  if (process.env.TEST_MONGODB_URI) return null;
  const appleSilicon = process.platform === "darwin" && process.arch === "arm64";
  if (appleSilicon && !existsSync(ROSETTA_MARKER)) {
    return (
      "macOS arm64 未装 Rosetta：mongodb-memory-server 只能取到 x64 版 mongod" +
      "（MONGOMS_VERSION=4.4.29 无 arm64 构建）"
    );
  }
  return null;
}
