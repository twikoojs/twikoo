/**
 * twikoo-netlify 入口（Netlify 适配器；handler 为 Functions v1 入口）。
 */
export { handler, createNetlifyFunc, toTkRequest, fromTkResponse } from "./main";
export { netlifyPostSubmitDispatcher } from "./dispatch";
