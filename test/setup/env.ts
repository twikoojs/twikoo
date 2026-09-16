import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * 解析 .env 文本为键值表（轻量自写实现，不引入 dotenv devDep——T10 选型记录：
 * 仅需「注释/空行/KEY=VALUE/成对引号」四类语法，自写 30 行内可控，省一个依赖面）。
 * @param content .env 文件全文
 * @returns 解析出的键值表（保留原始字符串，不做类型转换）
 */
function parseEnvFile(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    // 跳过空行与注释行
    if (line === "" || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    // 无等号或键名为空：非法行，跳过（不抛错，保持 setup 阶段零失败）
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    // 成对的单/双引号包裹值：剥掉外壳（不支持转义与多行——超出本仓库 .env 使用面）
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

// 仓库根：本文件位于 <root>/test/setup/env.ts，向上两级即根
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const envPath = path.join(repoRoot, ".env");

// §9.4 机制要求 1：测试启动时加载 .env；CI 环境变量 / 外部 shell 已设置的变量优先，
// 仅对未设置（或设为空串）的键做 process.env 兜底，绝不覆盖显式注入。
// .env 不存在时静默跳过——无 Secrets 的 fork PR CI 上本 setup 零副作用（用例靠 hasEnv skip）。
if (existsSync(envPath)) {
  const parsed = parseEnvFile(readFileSync(envPath, "utf8"));
  for (const [key, value] of Object.entries(parsed)) {
    const existing = process.env[key];
    if (existing === undefined || existing.trim() === "") {
      process.env[key] = value;
    }
  }
}
