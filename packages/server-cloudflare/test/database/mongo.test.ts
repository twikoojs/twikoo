/** MongoDB 保留 Cloudflare 属地，不能依赖提交请求所在 isolate 的内存。 */
import { afterEach, expect, it, vi } from "vitest";
import { MongoDatabase, getIpToRegion, resetCustomLibs } from "@twikoojs/common";
import type { CommentDoc } from "@twikoojs/common";
import { CloudflareMongoDatabase } from "../../src/database/mongo";
import { cloudflareCapabilities, prepareCloudflareRuntime } from "../../src/main";
import { rememberRequestGeo, resetGeoStore } from "../../src/geo/region-store";

afterEach(() => {
  resetGeoStore();
  resetCustomLibs();
  vi.restoreAllMocks();
});

it("提交时持久化属地，清空缓存后的另一请求读取时恢复属地", async () => {
  let stored: CommentDoc = {};
  vi.spyOn(MongoDatabase.prototype, "addComment").mockImplementation(async (comment) => {
    stored = { ...comment, _id: "saved" };
    return stored;
  });
  vi.spyOn(MongoDatabase.prototype, "getComments").mockImplementation(async () => [stored]);
  rememberRequestGeo("8.8.8.8", { country: "US", region: "California", city: "San Francisco" });
  const writer = await prepareCloudflareRuntime({ MONGODB_URI: "mongodb://localhost/twikoo" });
  await writer.addComment({ ip: "8.8.8.8", comment: "hello" });
  resetGeoStore();
  const reader = await prepareCloudflareRuntime({ MONGODB_URI: "mongodb://localhost/twikoo" });
  await reader.getComments({});
  const searcher = (await getIpToRegion(cloudflareCapabilities)).create();
  expect(searcher.binarySearchSync("8.8.8.8")?.region).toBe("US|0|California|San Francisco|");
});

it("已有属地不被当前缓存覆盖", async () => {
  vi.spyOn(MongoDatabase.prototype, "addComment").mockImplementation(async (comment) => ({
    ...comment,
    _id: "saved",
  }));
  rememberRequestGeo("8.8.8.8", { country: "US", region: "California" });
  const database = new CloudflareMongoDatabase({ uri: "mongodb://localhost/twikoo" });
  const stored = await database.addComment({ ip: "8.8.8.8", ipRegion: "CN|0|广东|深圳|" });
  expect(stored.ipRegion).toBe("CN|0|广东|深圳|");
});
