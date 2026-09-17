/**
 * 客户端共享类型（1.x 各组件内散落的「隐式对象」的显式化）。
 *
 * 说明：`CommentDto` 对应服务端 `parseComment` 下发的评论 DTO（§B.1 的
 * `COMMENT_GET` 响应项）；`ServerConfig` 对应服务端配置项的键值形态
 * （值以字符串为主，开关类为 `'true'`/`'false'` 字符串——1.x 的配置约定）。
 */

/** 服务端配置项（键为配置名；值为字符串/布尔/数字；未设置项缺省） */
export type ServerConfig = Record<string, string | number | boolean | undefined>;

/** 评论 DTO（服务端 `parseComment` 产出，含渲染所需的派生字段） */
export interface CommentDto {
  /** 评论 ID */
  id: string;
  /** 所属页面路径 */
  url?: string;
  /** 昵称 */
  nick?: string;
  /** 邮箱（管理员可见） */
  mail?: string;
  /** 邮箱 hash（头像回退） */
  mailMd5?: string;
  /** 个人站点 */
  link?: string;
  /** 头像地址 */
  avatar?: string;
  /** 已渲染为 HTML 的评论正文 */
  comment?: string;
  /** User-Agent */
  ua?: string;
  /** IP 归属地（`SHOW_REGION` 开启时下发） */
  ipRegion?: string;
  /** 操作系统（`SHOW_UA` 开启时下发） */
  os?: string;
  /** 浏览器（`SHOW_UA` 开启时下发） */
  browser?: string;
  /** 创建时间戳 */
  created?: number;
  /** 更新时间戳 */
  updated?: number;
  /** 父评论 ID */
  pid?: string;
  /** 根评论 ID */
  rid?: string;
  /** 被回复者昵称 */
  ruser?: string;
  /** 点赞数 */
  ups?: number;
  /** 点踩数 */
  downs?: number;
  /** 当前访问者是否已点赞 */
  liked?: boolean;
  /** 当前访问者是否已点踩 */
  disliked?: boolean;
  /** 是否被标记为垃圾评论 */
  isSpam?: boolean;
  /** 是否置顶 */
  top?: boolean;
  /** 是否站长 */
  master?: boolean;
  /** 是否当前访问者本人发表 */
  isOwner?: boolean;
  /** 相对时间（`GET_RECENT_COMMENTS` 追加字段） */
  relativeTime?: string;
  /** 子回复（主楼才有；`COMMENT_GET` 已归组） */
  replies: CommentDto[];
}
