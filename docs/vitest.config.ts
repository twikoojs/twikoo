import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // 项目名与包名一致（目录 docs → 包名 twikoo-docs）
    name: "twikoo-docs",
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
