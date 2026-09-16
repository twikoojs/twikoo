import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // 项目名与包名一致（目录 server-common → 包名 @twikoojs/common，勿凭目录名推断），便于 --project 过滤
    name: "@twikoojs/common",
    environment: "node",
    // T10：.env 加载 setup（仓库级共享约定，路径相对本配置文件：packages/server-common → ../../test/setup/env.ts）
    setupFiles: ["../../test/setup/env.ts"],
    include: ["test/**/*.test.ts"],
    // Mongo 内存实例（T14）首次启动需下载二进制（数十 MB，最坏数分钟）：
    // 钩子/用例超时放宽到 10 分钟，避免首跑假失败；二进制缓存后秒级启动。
    hookTimeout: 600_000,
    testTimeout: 600_000,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      // 80% 阈值占位见根 vitest.config.ts，随 Wave 2 DB/服务用例接入时在本包真正生效
    },
  },
});
