import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // 项目名与包名一致（目录 demo → 包名 @twikoojs/demo）
    name: "@twikoojs/demo",
    environment: "node",
    setupFiles: ["../../test/setup/env.ts"],
    include: ["test/**/*.test.ts"],
  },
});
