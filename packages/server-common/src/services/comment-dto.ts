/**
 * 评论 DTO 服务（1.x twikoo-func/utils/index.js 的 parseComment/toCommentDto
 * 及其辅助函数语义对齐）。
 *
 * 职责：把数据库评论文档转换为前端展示形态（筛除隐私字段、拼接回复列表、
 * UA 解析、IP 属地、头像拼接）。bowser 与 IP 属地库经库加载器惰性装载。
 */
import type { Capabilities } from "../ports/capabilities";
import type { CommentDoc, ConfigData } from "../ports/database";
// lib-loader 静态导入即可（惰性在它内部完成，见其头注释「消费方约定」）
import { getAxios, getBowser, getIpToRegion } from "../utils/lib-loader";
import { md5, sha256 } from "../utils/crypto";

/** 前端评论 DTO（1.x toCommentDto 返回形态） */
export interface CommentDto {
  /** 评论 id（字符串化 _id） */
  id: string;
  /** 昵称 */
  nick?: string;
  /** 头像（QQ 头像直链） */
  avatar?: string;
  /** 邮箱哈希（md5 或 sha256，取决于 GRAVATAR_CDN） */
  mailMd5?: string;
  /** 个人主页 */
  link?: string;
  /** 评论内容（已消毒 HTML） */
  comment?: string;
  /** 操作系统展示文案 */
  os: string;
  /** 浏览器展示文案 */
  browser: string;
  /** IP 属地（SHOW_REGION 开启时） */
  ipRegion?: string;
  /** 是否博主 */
  master?: boolean;
  /** 点赞数 */
  like: number;
  /** 赞数 */
  ups: number;
  /** 踩数 */
  downs: number;
  /** 当前用户是否已赞 */
  liked: boolean;
  /** 当前用户是否已踩 */
  disliked: boolean;
  /** 回复列表 */
  replies: CommentDto[];
  /** 根评论 id */
  rid?: string | null;
  /** 父评论 id */
  pid?: string | null;
  /** 被回复人昵称 */
  ruser: string | null;
  /** 是否置顶 */
  top?: boolean;
  /** 是否垃圾（管理员可见） */
  isSpam?: boolean;
  /** 是否本人评论 */
  isOwner: boolean;
  /** 创建时间 */
  created?: number;
  /** 更新时间 */
  updated?: number;
}

/** IP 属地查询器实例缓存（进程级，1.x ipRegionSearcher 语义） */
let ipRegionSearcher: { binarySearchSync(ip: string): { region: string } } | null = null;

/**
 * 获取（并缓存）IP 属地查询器。
 * @param caps 平台能力声明
 * @returns 查询器实例；未声明 ip2region 能力返回 null
 */
async function getIpRegionSearcher(caps: Capabilities) {
  if (!ipRegionSearcher) {
    if (caps.ip2region !== true) return null;
    const IpToRegion = await getIpToRegion(caps);
    ipRegionSearcher = (
      IpToRegion as unknown as {
        create(): { binarySearchSync(ip: string): { region: string } };
      }
    ).create();
  }
  return ipRegionSearcher;
}

/**
 * 同时查询 /path 和 /path/ 的评论（1.x getUrlQuery 对齐）。
 * @param url 页面路径
 * @returns 两个形态的路径数组
 */
export function getUrlQuery(url: string): string[] {
  const variantUrl = url[url.length - 1] === "/" ? url.substring(0, url.length - 1) : `${url}/`;
  return [url, variantUrl];
}

/**
 * 批量页面的多形态路径展平（1.x getUrlsQuery 对齐）。
 * @param urls 页面路径列表
 * @returns 展平后的路径列表
 */
export function getUrlsQuery(urls: string[]): string[] {
  const query: string[] = [];
  for (const url of urls) {
    if (url) query.push(...getUrlQuery(url));
  }
  return query;
}

/**
 * 获取回复人昵称（1.x ruser 对齐）。
 * @param pid 父评论 id
 * @param comments 同页评论列表
 * @returns 被回复人昵称；找不到为 null
 */
function ruser(pid: string | null | undefined, comments: CommentDoc[]): string | null {
  const comment = comments.find((item) => item._id === pid);
  return comment ? (comment.nick as string) : null;
}

/**
 * 取 UA 解析器的首组正则捕获（1.x getFirstMatch 对齐）。
 * @param regexp 正则
 * @param ua UA 字符串
 * @returns 捕获组或空串
 */
function getFirstMatch(regexp: RegExp, ua: string): string {
  const match = ua.match(regexp);
  return (match && match.length > 0 && match[1]) || "";
}

/**
 * 修正 os.versionName 缺失（Win 11 / macOS ^11 / Android ^10 / Harmony，1.x fixOS 对齐）。
 * @param uaParser bowser 解析器
 * @returns 修正后的 OS 信息
 */
function fixOS(uaParser: {
  getOS(): { name?: string; version?: string; versionName?: string };
  getUA(): string;
  test(regexp: RegExp): boolean;
}): { name?: string; version?: string; versionName?: string } {
  const os = uaParser.getOS();
  if (!os.versionName) {
    if (os.name === "Windows" && os.version === "NT 11.0") {
      os.versionName = "11";
    } else if (os.name === "macOS") {
      const majorPlatformVersion = (os.version ?? "").split(".")[0];
      os.versionName = {
        "11": "Big Sur",
        "12": "Monterey",
        "13": "Ventura",
        "14": "Sonoma",
        "15": "Sequoia",
        "16": "Tahoe",
      }[majorPlatformVersion];
    } else if (os.name === "Android") {
      const majorPlatformVersion = (os.version ?? "").split(".")[0];
      os.versionName = {
        "10": "Quince Tart",
        "11": "Red Velvet Cake",
        "12": "Snow Cone",
        "13": "Tiramisu",
        "14": "Upside Down Cake",
        "15": "Vanilla Ice Cream",
        "16": "Baklava",
      }[majorPlatformVersion];
    } else if (uaParser.test(/harmony/i)) {
      os.name = "Harmony";
      os.version = getFirstMatch(/harmony[\s/-](\d+(\.\d+)*)/i, uaParser.getUA());
      os.versionName = "";
    }
  }
  return os;
}

/**
 * 获取 IP 属地（1.x getIpRegion 对齐：IPv4-mapped IPv6 与端口剥离、
 * 有省显示省、无省显示国家；detail=true 返回省市运营商）。
 * @param caps 平台能力声明
 * @param ip IP 地址
 * @param detail true 返回省市运营商，false 只返回省
 * @returns 属地文案；查询失败或未声明能力返回空串
 */
export async function getIpRegion(
  caps: Capabilities,
  ip: string | undefined,
  detail = false,
): Promise<string> {
  if (!ip) return "";
  try {
    const searcher = await getIpRegionSearcher(caps);
    if (!searcher) return "";
    // 将 IPv6 格式的 IPv4 地址转换为 IPv4 格式；去掉端口号（1.x 对齐）
    const normalized = ip.replace(/^::ffff:/, "").replace(/:[0-9]*$/, "");
    const { region } = searcher.binarySearchSync(normalized);
    const [country, , province, city, isp] = region.split("|");
    const area = province.trim() && province !== "0" ? province : country;
    if (detail) {
      return area === city ? [city, isp].join(" ") : [area, city, isp].join(" ");
    }
    return area.replace(/(省|市)$/, "");
  } catch {
    return "";
  }
}

/**
 * 规范化邮箱（trim + 小写，1.x normalizeMail 对齐）。
 * @param mail 邮箱
 * @returns 规范化邮箱
 */
export function normalizeMail(mail: unknown): string {
  return String(mail).trim().toLowerCase();
}

/**
 * 邮箱等值比较（1.x equalsMail 对齐；任一为空即 false）。
 * @param mail1 邮箱一
 * @param mail2 邮箱二
 * @returns 是否相等
 */
export function equalsMail(mail1: unknown, mail2: unknown): boolean {
  if (!mail1 || !mail2) return false;
  return normalizeMail(mail1) === normalizeMail(mail2);
}

/**
 * 获取评论邮箱 MD5（有 mailMd5 用之，否则由 mail 计算，兜底 nick，1.x 对齐）。
 * @param comment 评论文档
 * @returns MD5 哈希
 */
export function getMailMd5(comment: CommentDoc): string {
  if (comment.mailMd5) return comment.mailMd5;
  if (comment.mail) return md5(normalizeMail(comment.mail));
  return md5(comment.nick ?? "");
}

/**
 * 获取评论邮箱 SHA-256（Cravatar 之外的 Gravatar CDN 使用，1.x 对齐）。
 * @param comment 评论文档
 * @returns SHA-256 哈希
 */
export function getMailSha256(comment: CommentDoc): string {
  if (comment.mail) return sha256(normalizeMail(comment.mail));
  return sha256(comment.nick ?? "");
}

/**
 * 拼接头像地址（1.x getAvatar 对齐：QQ 头像直链优先，Gravatar CDN 兜底；
 * Cravatar 不支持 sha256 故用 md5）。
 * @param comment 评论文档
 * @param config 全量配置
 * @returns 头像 URL
 */
export function getAvatar(comment: CommentDoc, config: ConfigData): string {
  if (comment.avatar) return comment.avatar;
  const gravatarCdn = config.GRAVATAR_CDN || "weavatar.com";
  let defaultGravatar = `initials&name=${comment.nick}`;
  if (config.DEFAULT_GRAVATAR) {
    defaultGravatar = String(config.DEFAULT_GRAVATAR);
  }
  const mailHash = gravatarCdn === "cravatar.cn" ? getMailMd5(comment) : getMailSha256(comment);
  return `https://${gravatarCdn}/avatar/${mailHash}?d=${defaultGravatar}`;
}

/**
 * 判断是否为 URL（1.x isUrl 对齐）。
 * @param s 待测字符串
 * @returns 是否 http(s):// 开头
 */
export function isUrl(s: string): boolean {
  return /^http(s)?:\/\//.test(s);
}

/**
 * 邮箱格式校验（1.x isValidEmail 对齐：拒绝可能触发 nodemailer 地址分组解析
 * 的字符；基础格式校验）。
 * @param mail 邮箱
 * @returns 是否合法
 */
export function isValidEmail(mail: unknown): boolean {
  if (!mail || typeof mail !== "string") return false;
  const trimmed = mail.trim();
  if (!trimmed) return false;
  if (trimmed.indexOf(":") !== -1) return false;
  if (trimmed.indexOf(" ") !== -1) return false;
  if (trimmed.indexOf(";") !== -1) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

/**
 * 判断是否 QQ 邮箱形态（1.x isQQ 对齐）。
 * @param mail 邮箱
 * @returns 是否 QQ 号或 QQ 邮箱
 */
export function isQQ(mail: string): boolean {
  return /^[1-9][0-9]{4,10}$/.test(mail) || /^[1-9][0-9]{4,10}@qq.com$/i.test(mail);
}

/**
 * 为纯 QQ 号补 @qq.com 后缀（1.x addQQMailSuffix 对齐）。
 * @param mail 邮箱
 * @returns 补全后的邮箱
 */
export function addQQMailSuffix(mail: string): string {
  if (/^[1-9][0-9]{4,10}$/.test(mail)) return `${mail}@qq.com`;
  return mail;
}

/**
 * 获取 QQ 头像（1.x getQQAvatar 对齐；接口已失效，失败返回 null）。
 * @param qq QQ 号或 QQ 邮箱
 * @returns 头像 URL 或 null
 */
export async function getQQAvatar(qq: string): Promise<string | null> {
  try {
    const axios = await getAxios();
    const qqNum = qq.replace(/@qq.com/gi, "");
    const result = await axios.get(
      `https://aq.qq.com/cn2/get_img/get_face?img_type=3&uin=${qqNum}`,
    );
    const data = result.data as { url?: string } | undefined;
    return data?.url || null;
  } catch {
    return null;
  }
}

/**
 * 获取 QQ 昵称（1.x getQQNick 对齐：v1.tqq.me 接口，QQ_API_KEY Bearer 鉴权；
 * 失败返回 null 不抛错）。
 * @param qq QQ 号或 QQ 邮箱
 * @param qqApiKey QQ_API_KEY 配置（可选）
 * @returns 昵称或 null
 */
export async function getQQNick(qq: string, qqApiKey?: string): Promise<string | null> {
  try {
    const axios = await getAxios();
    const qqNum = qq.replace(/@qq.com/gi, "");
    /** 请求头（API Key 鉴权可选） */
    const headers: Record<string, string> = {};
    if (qqApiKey) {
      headers.Authorization = `Bearer ${qqApiKey}`;
    }
    const result = await axios.get(`https://v1.tqq.me/v1/qqname?qq=${qqNum}`, { headers });
    const data = result.data as {
      code?: number;
      data?: { nick?: string };
    };
    if (data?.code === 200 && data.data?.nick) {
      return data.data.nick;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * 获取相对路径（绝对 URL 取 pathname；已是相对地址则原样返回，1.x 对齐）。
 * @param url 页面地址
 * @returns 相对路径
 */
export function getRelativeUrl(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

/**
 * 将评论记录转换为前端需要的格式（1.x toCommentDto 逐字段对齐）。
 * @param comment 评论文档
 * @param uid 当前用户 token
 * @param replies 回复 DTO 列表
 * @param comments 同页评论列表（ruser 查找用）
 * @param config 全量配置
 * @param caps 平台能力声明（UA 解析 / IP 属地）
 * @returns 前端评论 DTO
 */
export async function toCommentDto(
  comment: CommentDoc,
  uid: string | undefined,
  replies: CommentDto[],
  comments: CommentDoc[],
  config: ConfigData,
  caps: Capabilities,
): Promise<CommentDto> {
  let displayOs = "";
  let displayBrowser = "";
  if (config.SHOW_UA !== "false") {
    try {
      const bowser = await getBowser();
      const ua = bowser.getParser(comment.ua ?? "");
      const os = fixOS(ua as never);
      displayOs = [os.name, os.versionName ? os.versionName : os.version].join(" ");
      displayBrowser = [
        (ua as { getBrowserName(): string }).getBrowserName(),
        (ua as { getBrowserVersion(): string }).getBrowserVersion(),
      ].join(" ");
    } catch {
      // UA 解析失败不影响评论展示
    }
  }
  const showRegion = !!config.SHOW_REGION && config.SHOW_REGION !== "false";
  const ups = comment.ups ?? [];
  const downs = comment.downs ?? [];
  return {
    id: String(comment._id),
    nick: comment.nick,
    avatar: comment.avatar,
    mailMd5: getMailMd5(comment),
    link: comment.link,
    comment: comment.comment,
    os: displayOs,
    browser: displayBrowser,
    ipRegion: showRegion ? await getIpRegion(caps, comment.ip) : "",
    master: comment.master,
    like: (comment.like ?? []).length,
    ups: ups.length,
    downs: downs.length,
    liked: ups.includes(uid as never),
    disliked: downs.includes(uid as never),
    replies,
    rid: comment.rid,
    pid: comment.pid,
    ruser: ruser(comment.pid, comments),
    top: comment.top,
    isSpam: comment.isSpam,
    isOwner: Boolean(uid && comment.uid === uid),
    created: comment.created,
    updated: comment.updated,
  };
}

/**
 * 筛除隐私字段，拼接回复列表（1.x parseComment 对齐：无 rid 的为主楼，
 * 回复按 rid 归组并按 created 升序）。
 * @param comments 评论文档列表
 * @param uid 当前用户 token
 * @param config 全量配置
 * @param caps 平台能力声明
 * @returns 前端评论 DTO 列表
 */
export async function parseComment(
  comments: CommentDoc[],
  uid: string | undefined,
  config: ConfigData,
  caps: Capabilities,
): Promise<CommentDto[]> {
  const result: CommentDto[] = [];
  for (const comment of comments) {
    if (!comment.rid) {
      const replies = await Promise.all(
        comments
          .filter((item) => item.rid === String(comment._id))
          .map((item) => toCommentDto(item, uid, [], comments, config, caps)),
      );
      replies.sort((a, b) => (a.created ?? 0) - (b.created ?? 0));
      result.push(await toCommentDto(comment, uid, replies, [], config, caps));
    }
  }
  return result;
}

/**
 * 管理员评论视图（1.x parseCommentForAdmin 对齐：原样保留 + 补 IP 属地详情）。
 * @param comments 评论文档列表
 * @param caps 平台能力声明
 * @returns 附带 ipRegion 的文档列表
 */
export async function parseCommentForAdmin(
  comments: CommentDoc[],
  caps: Capabilities,
): Promise<Array<CommentDoc & { ipRegion?: string }>> {
  return Promise.all(
    comments.map(async (comment) => ({
      ...comment,
      ipRegion: await getIpRegion(caps, comment.ip, true),
    })),
  );
}
