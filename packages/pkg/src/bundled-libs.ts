/**
 * SEA 单文件产物的重依赖静态引入（惰性加载 × SEA 的桥接层）。
 *
 * **背景（发现 → 实测确认 → 修复）**：`@twikoojs/common` 的 14 个重依赖
 * 经 `loadLib(specifier)` 的**变量间接** `await import()` 惰性加载（零静态依赖，
 * 适配器按需安装）。这在有 `node_modules` 的部署形态下工作良好，但 **SEA 单文件产物**
 * 没有 `node_modules` 可解析：变量间接的 specifier 既不会被打包器内联，运行时也解析失败，
 * 于是「发评论（DOMPurify/jsdom）、邮件通知、Akismet 反垃圾、UA/属地解析、Markdown、
 * 推送」等能力会报「缺少依赖 xxx」（存储与查询不受影响——`mongodb`/`lokijs` 走的是
 * **字面量** `await import()`，可被静态解析并内联）。
 *
 * **解法（与 1.x 的打包结果等价）**：本模块**静态 import 全部重依赖**，再经
 * `setLibImporter` 注入一个「按 specifier 查表」的导入函数：
 *
 * 1. 静态 import 让打包器把模块代码内联进单文件产物。`import * as X` 与
 *    `await import("X")` 得到的都是模块命名空间，common 的 `pickDefault`
 *    解包语义完全不变（`mod.default ?? mod`）。
 * 2. 查表命中即返回该命名空间；**未命中的 specifier 仍回落到动态 import**，
 *    保留「可扩展、不静态绑定未知依赖」的性质。
 *
 * **两个 1.x 打包补丁因此重新生效**（见 `tsdown.config.mts`）：
 * - jsdom 的 `require.resolve("./xhr-sync-worker.js")` → 置 null（整棵树无同步 XHR）；
 * - `@imaegoo/node-ip2region` 的 `DEFAULT_DB_PATH` → 内联 base64 数据库并落到临时目录。
 *
 * **维护约定**：common 新增/更换重依赖时，必须同步本表与 `package.json` 的
 * `dependencies`，否则 SEA 产物会在运行时缺依赖。核对方式：设
 * `TWIKOO_PKG_BUNDLE_ONLY=1` 只验证打包链路（`tsdown.config.mts`），再对产物做依赖字符串探测。
 */
import * as akismetApi from "akismet-api";
import * as axios from "axios";
import * as bowser from "bowser";
import * as dompurify from "dompurify";
import * as formData from "form-data";
import * as htmlToText from "html-to-text";
import * as marked from "marked";
import * as nodemailer from "nodemailer";
import * as pushoo from "pushoo";
import * as tencentTms from "tencentcloud-sdk-nodejs-tms";
import * as xml2js from "xml2js";
import * as generateText from "@xsai/generate-text";
import * as ip2region from "@imaegoo/node-ip2region";
import * as jsdom from "jsdom";
import { setLibImporter } from "@twikoojs/common";

/**
 * specifier → 已内联模块命名空间。
 *
 * 键名必须与 `@twikoojs/common` 的 `loadLib()` 调用逐一对应
 * （见 `packages/server-common/src/utils/lib-loader.ts`）。
 */
const BUNDLED_LIBS: Record<string, unknown> = {
  nodemailer,
  jsdom,
  dompurify,
  "@imaegoo/node-ip2region": ip2region,
  "akismet-api": akismetApi,
  "tencentcloud-sdk-nodejs-tms": tencentTms,
  "form-data": formData,
  axios,
  xml2js,
  "html-to-text": htmlToText,
  pushoo,
  "@xsai/generate-text": generateText,
  bowser,
  marked,
};

/**
 * 装配「已内联重依赖」导入器（必须在 `startTkserver()` 之前调用）。
 *
 * 幂等：重复调用只是把导入器再设置一次（同一份映射）。
 */
export function installBundledLibs(): void {
  setLibImporter((specifier) => {
    if (Object.prototype.hasOwnProperty.call(BUNDLED_LIBS, specifier)) {
      return Promise.resolve(BUNDLED_LIBS[specifier]);
    }
    /** 兜底：未内联的 specifier 仍走动态 import（有 node_modules 的形态可解析） */
    return import(/* @vite-ignore */ specifier);
  });
}
