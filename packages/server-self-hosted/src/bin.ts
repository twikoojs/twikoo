/**
 * tkserver bin 入口（构建为 `dist/server.js`，package.json 的 `bin.tkserver` 指向它）。
 *
 * 单独成文件的原因：库入口（`index.ts`）**不得带启动副作用**——`twikoo-pkg` 的 SEA
 * 产物需要 `import` 库并显式调用 `startTkserver()`，若把启动逻辑写在 `server.ts` 的
 * 模块体里，一次 import 就会触发两次监听。此处只做「启动」这一件事。
 */
import { startTkserver } from "./server";

/** 测试进程内装配时跳过自动启动（TWIKOO_SKIP_BOOT=1） */
if (process.env.TWIKOO_SKIP_BOOT !== "1") {
  void startTkserver();
}
