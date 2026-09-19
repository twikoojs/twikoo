/**
 * 判断测试所需环境变量是否已配置（非空）。
 *
 * 使用约定（机制要求 2）：
 * /账号变量缺失时，对应用例以 `describe.skipIf(!hasEnv("..."))` 整体跳过
 * （等价 describe.skip，运行结果显示 skipped 而非 failed），保证 fork PR 在
 * 无 Secrets 的 CI 上照样跑绿。变量清单见根 .env.example。
 *
 * 空字符串与未定义同样视为「未配置」。
 * @param name 环境变量名（如 "TEST_SMTP_HOST"）
 * @returns true 表示已配置，可执行真实外部依赖用例
 */
export function hasEnv(name: string): boolean {
  const value = process.env[name];
  return typeof value === "string" && value.trim() !== "";
}
