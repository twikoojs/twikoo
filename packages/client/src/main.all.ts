/**
 * twikoo.all 入口（§5.2：`twikoo.all.min.js` / `twikoo.all.nocss.js` 内置云开发 SDK）。
 *
 * 与 1.x `main.all.js` 完全对应：1.x 用 webpack 把 `@cloudbase/js-sdk` 打进 all 产物，
 * 2.0 用同一个入口文件静态 import SDK 并由 Vite 打包——`main.ts` 不 import 该 SDK，
 * 因此 `twikoo.min.js` 不会带上它（产物体积差异即「all / 非 all」的区别）。
 *
 * SDK 子路径导入与 1.x 一致（`app` + `auth` + `functions` + `storage` 四个模块），
 * 保证 `app.callFunction` / `app.uploadFile` / `auth.*` 能力齐全。
 */
import cloudbase from "@cloudbase/js-sdk/app";
import "@cloudbase/js-sdk/auth";
import "@cloudbase/js-sdk/functions";
import "@cloudbase/js-sdk/storage";
import { setCloudbaseProvider } from "./main";

setCloudbaseProvider(() => cloudbase);

export * from "./main";
export { default } from "./main";
