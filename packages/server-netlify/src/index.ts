/**
 * twikoo-netlify 入口（默认导出现代入口，并保留 Functions v1 handler）。
 */
export {
  handler,
  createNetlifyFunc,
  createModernNetlifyFunc,
  toTkRequest,
  fromTkResponse,
  default,
} from "./main";
export { createNetlifyPostSubmitDispatcher, netlifyPostSubmitDispatcher } from "./dispatch";
