/**
 * tkserver 数据库选择（1.x `server.js` 语义：`MONGODB_URI`/`MONGO_URL` → Mongo，
 * 否则 Loki + `TWIKOO_DATA`）。
 *
 * 独立成文件的原因：启动路径需要**先**拿到数据库实例做 demo seed，
 * 与逐请求惰性初始化共用同一份选择逻辑。
 */
import { LokiDatabase, MongoDatabase, type Database } from "@twikoojs/common";

/**
 * 按环境选择数据库实现。
 * @param options 数据目录 / 连接串覆盖项
 * @returns 数据库实例（尚未 init）
 */
export function createTkserverDatabase(
  options: { dataDir?: string; mongoUri?: string } = {},
): Database {
  const mongoUri = options.mongoUri ?? process.env.MONGODB_URI ?? process.env.MONGO_URL ?? "";
  return mongoUri
    ? new MongoDatabase({ uri: mongoUri })
    : new LokiDatabase({ dataDir: options.dataDir ?? process.env.TWIKOO_DATA ?? "./data" });
}
