import io

def rw(p, s): io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
def patch(p, old, new, must=True):
    s = io.open(p, encoding='utf-8').read()
    if old not in s:
        if must: raise AssertionError(f"NOT FOUND {p}: {old[:70]}")
        return
    rw(p, s.replace(old, new))

# 1. limitFilter: GT sentinel
patch('src/services/spam.ts',
 '''    const count = await db.countComments({
      ip,
      created: Date.now() - 600000
    } as never);''',
 '''    const count = await db.countComments({
      ip,
      created: { [GT]: Date.now() - 600000 }
    } as never);''')
patch('src/services/spam.ts',
 '''    const count = await db.countComments({
      created: Date.now() - 600000
    } as never);''',
 '''    const count = await db.countComments({
      created: { [GT]: Date.now() - 600000 }
    } as never);''')
patch('src/services/spam.ts',
 'import { equalsMail } from "./comment-dto";',
 '''import { GT } from "../ports/database";
import { equalsMail } from "./comment-dto";''')

# 2. memory-adapters: saveConfig merge + getComments options support
patch('test/utils/memory-adapters.ts',
 '''  /** 配置：保存 */
  async saveConfig(config: ConfigData): Promise<void> {
    this.config = config;
  }''',
 '''  /** 配置：保存（合并语义，与端口契约一致） */
  async saveConfig(config: ConfigData): Promise<void> {
    this.config = { ...(this.config ?? {}), ...config };
  }''')

patch('test/utils/memory-adapters.ts',
 '''  /** 评论：按语义查询（内存实现只支持等值过滤，ABSENT 按字段缺失/空处理） */
  async getComments(query: SemanticQuery, options?: QueryOptions): Promise<CommentDoc[]> {
    const all = await this.getAllComments();
    return all.filter((doc) => matches(doc, query));
  }''',
 '''  /** 评论：按语义查询 + 排序/分页（内存形态） */
  async getComments(query: SemanticQuery, options?: QueryOptions): Promise<CommentDoc[]> {
    let result = (await this.getAllComments()).filter((doc) => matches(doc, query));
    if (options?.sort) {
      const entries = Object.entries(options.sort);
      result = [...result].sort((a, b) => {
        for (const [field, direction] of entries) {
          const av = (a[field] as number | undefined) ?? 0;
          const bv = (b[field] as number | undefined) ?? 0;
          const diff = av - bv;
          if (diff !== 0) return direction === -1 ? -diff : diff;
        }
        return 0;
      });
    }
    if (options?.skip !== undefined) result = result.slice(options.skip);
    if (options?.limit !== undefined) result = result.slice(0, options.limit);
    return result;
  }''')

patch('test/utils/memory-adapters.ts',
 'import { ABSENT, GT, NOT } from "../../src/ports/database";',
 '''import { ABSENT, GT, NOT } from "../../src/ports/database";
import type { QueryOptions } from "../../src/ports/database";''')

print("ok")
