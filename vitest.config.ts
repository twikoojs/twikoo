import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Vitest 5 工作区模式：`vitest.workspace.ts` 自 v4 起已移除，由根配置的
    // `projects` 承接——glob 自动发现各包与文档站的 vitest.config.ts，
    // 尚未创建测试配置的包会被自动跳过。
    projects: ["packages/*/vitest.config.ts", "docs/vitest.config.ts"],
  },
});
