import { describe, expect, it } from "vitest";
import { hasEnv } from "./utils/env";

/**
 * hasEnv 条件执行模式演示。
 *
 * TEST_SMTP_HOST（邮件变量）未配置时，describe.skipIf 使整个套件按
 * describe.skip 处理——运行结果显示 skipped 而非 failed，fork PR 在无
 * Secrets 的 CI 上照常绿（机制要求 2）。
 *
 * 真实邮件发送用例（接入 packages/server-self-hosted / common 的
 * SMTP mailer）遵循同一模式：TEST_SMTP_HOST/PORT/USER/PASS 四项经
 * hasEnv 全部就绪才执行真实收发断言，缺一即整体 skip。
 */
describe.skipIf(!hasEnv("TEST_SMTP_HOST"))("hasEnv 条件执行演示（TEST_SMTP_HOST）", () => {
  it("环境变量已配置时走真实断言路径（设置 $env:TEST_SMTP_HOST 后本用例应 run）", () => {
    const host = process.env.TEST_SMTP_HOST ?? "";
    expect(hasEnv("TEST_SMTP_HOST")).toBe(true);
    expect(host.trim().length).toBeGreaterThan(0);
  });
});
