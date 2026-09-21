// @ts-nocheck — 纯映射表，类型由 lib-loader 的接口层保证
/**
 * Workers 专用库导入器。
 *
 * Wrangler（esbuild）无法解析变量间接的 `import(specifier)`，
 * 这里将所有重依赖映射为字面量动态 `import("...")`，
 * 使 esbuild 能够静态分析并打入最终 Worker bundle。
 */

const libs: Record<string, () => Promise<unknown>> = {
  "nodemailer": () => import("nodemailer"),
  "jsdom": () => import("jsdom"),
  "dompurify": () => import("dompurify"),
  "@imaegoo/node-ip2region": () => import("@imaegoo/node-ip2region"),
  "akismet-api": () => import("akismet-api"),
  "tencentcloud-sdk-nodejs-tms": () => import("tencentcloud-sdk-nodejs-tms"),
  "form-data": () => import("form-data"),
  "axios": () => import("axios"),
  "xml2js": () => import("xml2js"),
  "html-to-text": () => import("html-to-text"),
  "pushoo": () => import("pushoo"),
  "@xsai/generate-text": () => import("@xsai/generate-text"),
  "bowser": () => import("bowser"),
  "marked": () => import("marked"),
};

export async function workersLibImporter(specifier: string): Promise<unknown> {
  const loader = libs[specifier];
  if (loader) return loader();
  return import(/* @vite-ignore */ specifier);
}
