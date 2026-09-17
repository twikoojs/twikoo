/**
 * tkserver 入口（self-hosted 适配器；bin 见 server.ts）。
 */
export {
  createTkserverHandler,
  toTkRequest,
  fromTkResponse,
  shutdown,
  startRequestTimesTimer,
  getRequestTimesClearInterval,
} from "./main";
export { createTkserverDatabase } from "./database";
