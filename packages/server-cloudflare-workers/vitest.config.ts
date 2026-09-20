import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "@twikoojs/cloudflare-workers",
    environment: "node",
    setupFiles: ["../../test/setup/env.ts"],
    include: ["test/**/*.test.ts"],
    coverage: { provider: "v8", include: ["src/**/*.ts"] },
  },
});
