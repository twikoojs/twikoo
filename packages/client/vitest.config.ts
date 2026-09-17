import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  test: {
    // 项目名与包名一致（目录 client → 包名 twikoo）
    name: "twikoo",
    environment: "happy-dom",
    setupFiles: ["../../test/setup/env.ts"],
    include: ["test/**/*.test.ts"],
    coverage: { provider: "v8", include: ["src/**/*.ts"] },
  },
});
