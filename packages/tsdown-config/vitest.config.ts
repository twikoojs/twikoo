import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // 项目名与包名一致（目录 tsdown-config → 包名 @twikoojs/tsdown-config）
    name: "tsdown-config",
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
