import { defineConfig } from "vitest/config";

/**
 * 覆盖率阈值占位：
 * - packages/server-common（@twikoojs/common）→ `thresholds: { statements: 80 }`（接入 DB/服务端用例时写入其 vitest.config.ts）
 * - packages/client（twikoo 客户端）→ `thresholds: { statements: 70 }`（接入组件用例时写入其 vitest.config.ts）
 *
 * 当前仅 @twikoojs/shared 有测试且不设阈值，因此 `pnpm test:coverage` 不会因阈值不达标退出非 0；
 * 上述占位值供后续波次的包级配置对照抄写（不要在本文件导出——vitest 会打包
 * 根配置文件，混合命名导出与默认导出会触发 [MIXED_EXPORTS] 告警），接入后即在该包范围内真正生效。
 */
const COVERAGE_THRESHOLDS = {
  "packages/server-common": { statements: 80 },
  "packages/client": { statements: 70 },
} as const;

export default defineConfig({
  test: {
    // Vitest 5 工作区模式：`vitest.workspace.ts` 自 v4 起已移除，由根配置的
    // `projects` 承接——glob 自动发现各包与文档站的 vitest.config.ts，
    // 尚未创建测试配置的包会被自动跳过。
    projects: ["packages/*/vitest.config.ts", "docs/vitest.config.ts"],
  },
});
