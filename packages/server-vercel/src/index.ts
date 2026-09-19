/**
 * twikoo-vercel 入口（Vercel 适配器；默认导出 Serverless Function）。
 */
export { createVercelFunc, toTkRequest, fromTkResponse, default } from "./main";
export { vercelPostSubmitDispatcher } from "./dispatch";
