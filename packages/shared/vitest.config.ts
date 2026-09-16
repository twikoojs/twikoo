import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // 项目名与包名（目录 server-common→@twikoojs/common 的映射陷阱此处不涉及）保持一致，便于 --project 过滤
    name: "@twikoojs/shared",
    // shared 无 UI 依赖，node 环境即可；后续包（client 用 happy-dom 等）各自在自己的配置里定环境
    environment: "node",
    // T10：.env 加载 setup（仓库级共享文件，后续包复用约定——各包 vitest.config.ts
    // 按相对自身配置文件的路径挂同一文件：根 test/setup/env.ts）。
    // 路径相对本配置文件解析：packages/shared → ../../test/setup/env.ts。
    setupFiles: ["../../test/setup/env.ts"],
    include: ["test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      // 阈值不在本包设置——@twikoojs/common(80)/client(70) 的占位见根 vitest.config.ts，
      // 随 Wave 2/4 各包接入时真正生效，避免当前用例数不足导致覆盖率门禁误报。
    },
  },
});
