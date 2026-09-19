/**
 * demo 测试数据 fixtures（设计文档「无数据库时自动生成测试数据」）。
 *
 * 覆盖 11 项场景表；**url 一律 `/demo.html`**（另设第二路径用于分页场景）。
 * 数据为静态常量 + 少量按「基准时间」推导的时间戳，保证每次 seed 结构可复现。
 * 本文件只在显式开启 seed 时被加载（见 `./index.ts` 与 `../server.ts` 的双重守卫）。
 */
import { createHash } from "node:crypto";
import type { CommentDoc, ConfigData } from "@twikoojs/common";

/** demo 页路径（测试数据 url 必须为 `/demo.html`，与 demo 页默认 path 一致）*/
export const DEMO_URL = "/demo.html";

/** 第二路径：用于「多个 url 路径的评论 → 分页 + 仅显示当前页评论」场景 */
export const OTHER_URL = "/demo-other.html";

/** 访客计数种子值（1.x 只有 `incCounter` 自增语义，故循环写入以获得可读数值） */
export const DEMO_VISITORS = 42;

/** 博主昵称（与配置 BLOGGER_NICK 一致，用于 master 徽标） */
export const DEMO_BLOGGER_NICK = "iMaeGoo";

/**
 * 场景清单（覆盖表逐项）——供 seed 日志与单测逐项断言，避免「表里写了但没造」。
 */
export const DEMO_SCENARIOS = [
  "普通评论（含 _id/url/nick/mail/link/ua/ip）",
  "嵌套回复（多层 pid/rid）",
  "含 owo 表情的评论",
  "含公式的评论（$…$ / $$…$$）",
  "含代码块的评论",
  "含链接、图片的评论",
  "已点赞评论（like 字段有值）",
  "标记为垃圾的评论（isSpam: true）",
  "多个 url 路径的评论（分页）",
  "含访客计数的配置",
  "默认配置对象（配置面板全部字段有值）",
] as const;

/** demo 图片（内联 data URI：离线也能显示，避免 demo 依赖外网） */
const DEMO_IMAGE =
  "data:image/svg+xml;base64," +
  "PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNjAiIGhlaWdodD0iNjAiPjxyZWN0IHdpZHRoPSIxNjAiIGhlaWdodD0iNjAiIGZpbGw9IiMxODVGQTUiLz48dGV4dCB4PSI4MCIgeT0iMzYiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiNmZmYiIHRleHQtYW5jaG9yPSJtaWRkbGUiPlR3aWtvbyBEZW1vPC90ZXh0Pjwvc3ZnPg==";

/**
 * 默认配置对象（场景 11：配置面板**全部字段有值**）。
 *
 * 键集合 = 1.7.24 管理面板配置项全集（`TkAdminConfig.vue` 的 `key:` 清单）；
 * 凭证类字段填明显非真实的占位值，仅用于「面板有值」演示。
 */
export const DEMO_CONFIG: ConfigData = {
  SITE_NAME: "Twikoo Demo",
  SITE_URL: "http://localhost:9820",
  CORS_ALLOW_ORIGIN: "http://localhost:9820",
  BLOGGER_NICK: DEMO_BLOGGER_NICK,
  BLOGGER_EMAIL: "hello@imaegoo.com",
  MASTER_TAG: "站长",
  COMMENT_PAGE_SIZE: "8",
  COMMENT_BG_IMG: "",
  COMMENT_PLACEHOLDER: "请友善评论，支持 Markdown / 表情 / 公式 / 代码块",
  GRAVATAR_CDN: "cravatar.cn",
  DEFAULT_GRAVATAR: "mp",
  SHOW_ORDER: "true",
  SHOW_DISLIKE: "true",
  SHOW_EMOTION: "true",
  SHOW_IMAGE: "true",
  SHOW_UA: "true",
  SHOW_REGION: "true",
  LIGHTBOX: "false",
  DISPLAYED_FIELDS: "nick,mail,link",
  REQUIRED_FIELDS: "nick,mail",
  HIDE_ADMIN_CRYPT: "admin",
  HIDE_SPAM: "false",
  LIMIT_LENGTH: "500",
  LIMIT_PER_MINUTE: "3",
  LIMIT_PER_MINUTE_ALL: "10",
  EMOTION_CDN: "https://owo.imaegoo.com/owo.json",
  IMAGE_CDN: "none",
  IMAGE_CDN_URL: "https://piclist.example.com",
  IMAGE_CDN_TOKEN: "demo-token",
  HIGHLIGHT: "true",
  HIGHLIGHT_THEME: "default",
  HIGHLIGHT_PLUGIN: "showLanguage,copyButton",
  CAPTCHA_PROVIDER: "",
  TURNSTILE_SITE_KEY: "demo-turnstile-site-key",
  TURNSTILE_SECRET_KEY: "demo-turnstile-secret-key",
  GEETEST_CAPTCHA_ID: "demo-geetest-id",
  GEETEST_CAPTCHA_KEY: "demo-geetest-key",
  CAP_API_ENDPOINT: "",
  CAP_SECRET_KEY: "demo-cap-secret",
  QQ_API_KEY: "demo-qq-api-key",
  SC_MAIL_NOTIFY: "true",
  SENDER_NAME: "Twikoo Demo",
  SENDER_EMAIL: "noreply@example.com",
  SMTP_SERVICE: "QQ",
  SMTP_HOST: "smtp.example.com",
  SMTP_PORT: "465",
  SMTP_SECURE: "true",
  SMTP_USER: "demo@example.com",
  SMTP_PASS: "demo-smtp-pass",
  MAIL_SUBJECT: "${SITE_NAME} 有新评论",
  MAIL_SUBJECT_ADMIN: "${SITE_NAME} 有新评论（管理员）",
  MAIL_TEMPLATE: "<p>${PARENT_NICK} 回复了你的评论：</p><p>${COMMENT}</p>",
  MAIL_TEMPLATE_ADMIN: "<p>${NICK} 在 ${POST_URL} 评论：</p><p>${COMMENT}</p>",
  PUSHOO_CHANNEL: "none",
  PUSHOO_TOKEN: "",
  NOTIFY_SPAM: "false",
  AKISMET_KEY: "demo-akismet-key",
  BLOCKED_WORDS: "测试屏蔽词,广告",
  FORBIDDEN_WORDS: "违规词",
  NSFW_API_URL: "https://nsfw.example.com/api",
  NSFW_THRESHOLD: "0.8",
  LLM_API_ENDPOINT: "https://api.example.com/v1",
  LLM_API_KEY: "demo-llm-api-key",
  LLM_MODEL: "demo-model",
  LLM_MAX_RETRIES: "3",
  LLM_SPAM_PROMPT: "判断这条评论是否为垃圾评论",
  QCLOUD_CMS_BIZTYPE: "twikoo",
  QCLOUD_SECRET_ID: "demo-qcloud-secret-id",
  QCLOUD_SECRET_KEY: "demo-qcloud-secret-key",
  S3_ENDPOINT: "https://s3.example.com",
  S3_REGION: "ap-shanghai",
  S3_BUCKET: "twikoo-demo",
  S3_ACCESS_KEY_ID: "demo-s3-access-key-id",
  S3_SECRET_ACCESS_KEY: "demo-s3-secret-access-key",
  S3_PATH_PREFIX: "twikoo/",
  S3_CDN_URL: "https://cdn.example.com",
  S3_FORCE_PATH_STYLE: "false",
};

/**
 * 计算邮箱哈希（1.x `mailMd5` 语义：头像源；此处用 md5 与 Gravatar/Cravatar 默认形态一致）。
 * @param mail 邮箱
 * @returns 32 位小写十六进制哈希
 */
function mailHash(mail: string): string {
  return createHash("md5").update(mail).digest("hex");
}

/** 评论 fixture 形态：`ref` 用于回复关系解析（seed 时替换为真实 `_id`） */
interface CommentFixture extends CommentDoc {
  /** fixture 内部引用键（不写入数据库） */
  ref?: string;
  /** 父评论 fixture 引用键（解析为 pid） */
  pidRef?: string;
  /** 根评论 fixture 引用键（解析为 rid） */
  ridRef?: string;
}

/** 构造 fixture 公共字段（普通评论基础形态） */
function baseFixture(index: number, now: number, overrides: CommentFixture = {}): CommentFixture {
  /** 序号越小越新（created 倒序展示） */
  const created = now - index * 3600_000;
  return {
    uid: `seed-uid-${index}`,
    ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Twikoo-Demo-Seed",
    ip: "127.0.0.1",
    url: DEMO_URL,
    href: `http://localhost:9820${DEMO_URL}`,
    created,
    updated: created,
    isSpam: false,
    like: [],
    ...overrides,
  };
}

/**
 * 构造全部 demo 评论 fixture（场景 1–9）。
 * @param now 基准时间戳（毫秒）
 * @returns fixture 列表（顶级在前、回复在后，seed 按序写入）
 */
export function buildDemoComments(now: number): CommentFixture[] {
  const list: CommentFixture[] = [];

  // 场景 1 + 6 + 7：普通评论（含 _id/url/nick/mail/link/ua/ip）、图片与链接、已点赞、博主标识
  list.push(
    baseFixture(0, now, {
      ref: "master",
      nick: DEMO_BLOGGER_NICK,
      mail: "hello@imaegoo.com",
      mailMd5: mailHash("hello@imaegoo.com"),
      link: "https://www.imaegoo.com",
      master: true,
      like: ["seed-uid-1", "seed-uid-2", "seed-uid-3"],
      comment:
        "<p>欢迎来到 Twikoo 2.0 本地演示。这条是博主评论，含链接 " +
        '<a href="https://twikoo.js.org" target="_blank" rel="noopener noreferrer nofollow ugc">Twikoo 官网</a>' +
        `、图片 <img src="${DEMO_IMAGE}" alt="demo"> 与内联代码 <code>twikoo.init()</code>。</p>`,
    }),
    baseFixture(1, now, {
      ref: "plain",
      nick: "路过的访客",
      mail: "visitor@example.com",
      mailMd5: mailHash("visitor@example.com"),
      link: "",
      comment: "<p>普通评论一条，用来验证基础渲染与昵称/邮箱头像。</p>",
    }),
    baseFixture(2, now, {
      ref: "owo",
      nick: "表情党",
      mail: "owo@example.com",
      mailMd5: mailHash("owo@example.com"),
      comment: "<p>owo 表情测试：:QQ: :tv_doge: :B站: 以及文字混排。</p>",
    }),
    baseFixture(3, now, {
      ref: "formula",
      nick: "数学老师",
      mail: "math@example.com",
      mailMd5: mailHash("math@example.com"),
      comment:
        "<p>行内公式 $E = mc^2$ 与块级公式：</p><p>$$\\int_{0}^{1} x^{2}\\,dx = \\frac{1}{3}$$</p>",
    }),
    baseFixture(4, now, {
      ref: "code",
      nick: "工程师",
      mail: "dev@example.com",
      mailMd5: mailHash("dev@example.com"),
      comment:
        "<p>代码块测试（期望 Prism 高亮）：</p>" +
        '<pre><code class="language-js">const twikoo = window.twikoo;\n' +
        'twikoo.init({ envId: "http://localhost:8080", el: "#tcomment" });\n</code></pre>',
    }),
  );

  // 场景 2：嵌套回复（多层 pid/rid）—— 挂在博主评论下，形成 3 层盖楼
  list.push(
    baseFixture(5, now, {
      ref: "reply-1",
      pidRef: "master",
      ridRef: "master",
      nick: "提问者",
      mail: "ask@example.com",
      mailMd5: mailHash("ask@example.com"),
      comment: "<p>请问多层回复怎么展示？</p>",
    }),
    baseFixture(6, now, {
      ref: "reply-2",
      pidRef: "reply-1",
      ridRef: "master",
      nick: DEMO_BLOGGER_NICK,
      mail: "hello@imaegoo.com",
      mailMd5: mailHash("hello@imaegoo.com"),
      master: true,
      comment: "<p>像这样一层层缩进展示（pid 指直接上级，rid 指根评论）。</p>",
    }),
    baseFixture(7, now, {
      ref: "reply-3",
      pidRef: "reply-2",
      ridRef: "master",
      nick: "提问者",
      mail: "ask@example.com",
      mailMd5: mailHash("ask@example.com"),
      comment: "<p>明白了，第三层也能正常显示。</p>",
    }),
  );

  // 场景 1 补充（多条普通评论，同时为场景 9「分页」凑满一页以上）
  for (let i = 0; i < 5; i += 1) {
    const index = 8 + i;
    list.push(
      baseFixture(index, now, {
        ref: `filler-${i}`,
        nick: `分页测试用户 ${i + 1}`,
        mail: `pager${i + 1}@example.com`,
        mailMd5: mailHash(`pager${i + 1}@example.com`),
        comment: `<p>第 ${i + 1} 条分页测试评论（与其它评论一起超过 COMMENT_PAGE_SIZE，用于验证分页）。</p>`,
      }),
    );
  }

  // 场景 8：垃圾评论（管理员视图筛选用）
  list.push(
    baseFixture(20, now, {
      ref: "spam",
      nick: "spammer",
      mail: "spam@example.com",
      mailMd5: mailHash("spam@example.com"),
      isSpam: true,
      comment: "<p>这条评论被标记为垃圾评论（isSpam: true），访客不可见、管理员可筛选。</p>",
    }),
  );

  // 场景 9：多个 url 路径的评论（分页时不应出现在 /demo.html）
  for (let i = 0; i < 3; i += 1) {
    const index = 21 + i;
    list.push(
      baseFixture(index, now, {
        ref: `other-${i}`,
        url: OTHER_URL,
        href: `http://localhost:9820${OTHER_URL}`,
        nick: `另一页用户 ${i + 1}`,
        mail: `other${i + 1}@example.com`,
        mailMd5: mailHash(`other${i + 1}@example.com`),
        comment: `<p>属于 ${OTHER_URL} 的评论，不应出现在 demo 页的评论列表里。</p>`,
      }),
    );
  }

  return list;
}
