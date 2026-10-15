/**
 * Markdown 解析（1.x utils/marked.js 的官方扩展机制重建）。
 *
 * 删除 1.x 的 lib/marked fork（9 文件），改用官方 marked ^18：
 * - GFM / breaks 基础选项对齐 1.x；
 * - 禁用缩进代码块（#855：评论常以空格缩进排版，不应渲染为代码块）；
 * - owo 内联扩展：`:name:` → `<img class="tk-owo-emotion">`（表情映射表由
 *   OwO 数据驱动，经 setOwoImages 注册；未知表情原样输出不吞字符）；
 * - 公式四语法透传（KaTeX / Prism 由 DOM 后处理接管），marked 只透传。
 */
import { Marked, type Tokens } from "marked";

/** OwO 图片元数据；保留表情包自定义类名。 */
export interface OwoImage {
  /** 图片地址 */
  src: string;
  /** 表情包中的图片类名 */
  className?: string;
}

/** OwO 表情映射，由 initMarkedOwo 产出；兼容仅传图片地址。 */
let owoImages: Record<string, string | OwoImage> = {};

/**
 * 注册 OwO 表情映射（评论提交预览与渲染共用）。
 * @param imgs 表情映射表
 */
export function setOwoImages(imgs: Record<string, string | OwoImage>): void {
  owoImages = imgs ?? {};
}

/** 独立的 marked 实例（不污染全局 marked 导出） */
const marked = new Marked({
  gfm: true,
  breaks: true,
});

// 禁用缩进代码块（评论常以空格缩进排版）
marked.use({
  tokenizer: {
    /**
     * 禁用缩进代码块。
     * @returns 恒 undefined（交还内置文本规则）
     */
    code() {
      return undefined;
    },
  },
});

// 公式四语法透传扩展：$$..$$ / \[..\] / \(..\) / $..$ 原样保留，
// KaTeX auto-render 在 DOM 层接管渲染
const MATH_RE = /^(\$\$[\s\S]*?\$\$|\\\[([\s\S]*?)\\\]|\\\(([\s\S]*?)\\\)|\$[^$\n]+?\$)/;

/** 数学 token（raw 即最终 HTML——透传语义） */
interface MathToken extends Tokens.Generic {
  /** 原样输出的公式文本 */
  text: string;
}

marked.use({
  extensions: [
    {
      name: "twikoo-math",
      level: "inline",
      /** 告知 marked 从何处开始尝试本扩展 */
      start(src: string): number | undefined {
        return src.search(MATH_RE);
      },
      /**
       * 匹配公式（四语法原样透传）。
       * @param src 剩余文本
       * @returns token
       */
      tokenizer(src: string): Tokens.Generic | undefined {
        const match = MATH_RE.exec(src);
        if (!match) return undefined;
        return {
          type: "twikoo-math",
          raw: match[0],
          text: match[0],
        };
      },
      /**
       * 渲染为原样文本。
       * @param token 数学 token
       * @returns HTML
       */
      renderer(token: Tokens.Generic): string {
        return (token as unknown as MathToken).text;
      },
    },
  ],
});

/** 使用标准图片 token，让外层 Markdown 图片的 alt 保持纯文本。 */
interface OwoToken extends Tokens.Image {
  /** 是否为 OwO 表情 */
  owo?: boolean;
  /** 表情包中的图片类名 */
  className?: string;
}

/** 转义图片属性，避免表情名、地址或类名破坏 HTML 属性边界。 */
function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

marked.use({
  renderer: {
    /** 渲染 OwO 图片；普通 Markdown 图片交还内置渲染器。 */
    image(token: OwoToken): string | false {
      if (!token.owo) return false;
      const className = ["tk-owo-emotion", token.className].filter(Boolean).join(" ");
      return `<img class="${escapeAttribute(className)}" loading="lazy" src="${escapeAttribute(token.href)}" alt="${escapeAttribute(token.text)}">`;
    },
  },
  extensions: [
    {
      name: "owo",
      level: "inline",
      /** 告知 marked 从何处开始尝试本扩展。 */
      start(src: string): number | undefined {
        return src.indexOf(":");
      },
      /**
       * 匹配 :name: 表情标记；兼容非 ASCII 名字，保留原始 HTML 代码区内容。
       * @param src 剩余文本
       * @returns 标准图片 token；未命中交还内置规则
       */
      tokenizer(src: string): OwoToken | undefined {
        if (this.lexer.state.inRawBlock) return undefined;
        const match = /^:([^\s:]+):/.exec(src);
        if (!match || !Object.prototype.hasOwnProperty.call(owoImages, match[1])) return undefined;
        const image = owoImages[match[1]];
        const href = typeof image === "string" ? image : image?.src;
        if (typeof href !== "string" || !href) return undefined;
        return {
          type: "image",
          raw: match[0],
          href,
          title: null,
          text: match[0],
          tokens: [{ type: "text", raw: match[0], text: match[0] }],
          className: typeof image === "string" ? undefined : image.className,
          owo: true,
        };
      },
    },
  ],
});

/**
 * 解析 Markdown 为 HTML（1.x marked() 调用形态对齐）。
 * @param src Markdown 文本
 * @returns HTML
 */
export function parseMarkdown(src: string): string {
  return marked.parse(src) as string;
}
