import { MongoDatabase } from "@twikoojs/common";
import type { CommentDoc, QueryOptions, SemanticQuery } from "@twikoojs/common";
import { lookupRegion, rememberRegion } from "../geo/region-store";

/** MongoDB 复用公共实现，仅补充 Workers 的属地持久化与读取回填。 */
export class CloudflareMongoDatabase extends MongoDatabase {
  /** 保存当前请求的属地，不覆盖导入或调用方已提供的值。 */
  override addComment(data: CommentDoc): Promise<CommentDoc> {
    const region = data.ipRegion || lookupRegion(data.ip);
    return super.addComment(region ? { ...data, ipRegion: region } : data);
  }

  /** 读取列表后恢复属地缓存，冷启动后公开与管理员 DTO 仍能显示属地。 */
  override async getComments(query: SemanticQuery, options?: QueryOptions): Promise<CommentDoc[]> {
    const comments = await super.getComments(query, options);
    for (const comment of comments) {
      rememberRegion(comment.ip, comment.ipRegion as string | undefined);
    }
    return comments;
  }
}
