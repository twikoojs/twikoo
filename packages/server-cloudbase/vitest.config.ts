import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // 项目名与包名一致（目录 server-cloudbase → 包名 twikoo-func，勿凭目录名推断）
    name: "twikoo-func",
    environment: "node",
    // .env 加载 setup（仓库级共享文件；路径相对本配置文件解析）
    setupFiles: ["../../test/setup/env.ts"],
    include: ["test/**/*.test.ts"],
    coverage: { provider: "v8", include: ["src/**/*.ts"] },
  },
});
