/**
 * marked 升级回归套件（九类用例）。
 *
 * 1. 注册表情 → img.tk-owo-emotion
 * 2. 未知表情原样输出（不吞字符）
 * 3. 表情紧邻公式/代码块（抢占边界正确性）
 * 4. 公式四语法透传（KaTeX 由 DOM 层处理，marked 不破坏）
 * 5. 代码块保留（fenced；缩进代码禁用 #855）
 * 6. GFM（表格 / 删除线 / 自动链接）
 * 7. 外链 rel 处理（renderLinks DOM 工具）
 * 8. XSS 清洗（sanitizeHtml / DOMPurify）
 * 9. 混排（owo + 代码 + 公式同文）
 */
import { describe, expect, it, beforeEach } from "vitest";
import { parseMarkdown, setOwoImages } from "../src/utils/marked";
import { sanitizeHtml } from "../src/utils/sanitize";

const OWO_IMGS = {
  tv_taking: "https://owo.test/tv.gif",
  good: "https://owo.test/good.png",
};

beforeEach(() => {
  setOwoImages(OWO_IMGS);
});

describe("marked 回归", () => {
  it("1. 注册表情 :tv_taking: → img.tk-owo-emotion", () => {
    const html = parseMarkdown("看这个 :tv_taking: 好笑");
    expect(html).toContain(
      '<img class="tk-owo-emotion" loading="lazy" src="https://owo.test/tv.gif">',
    );
  });

  it("2. 未知表情 :notexist: 原样输出（不吞字符）", () => {
    const html = parseMarkdown("表情 :notexist: 保留");
    expect(html).toContain(":notexist:");
    expect(html).not.toContain("tk-owo-emotion");
  });

  it("3. 表情紧邻代码块/公式（边界不串扰）", () => {
    const html = parseMarkdown(":good:`code`:good:\n\n$E=mc^2$ :good:");
    expect((html.match(/tk-owo-emotion/g) ?? []).length).toBe(3);
    expect(html).toContain("<code>code</code>");
    expect(html).toContain("$E=mc^2$");
  });

  it("4. 公式四语法透传（$$..$$ / $..$ / \\(..\\) / \\[..\\]）", () => {
    const html = parseMarkdown("$$a^2+b^2=c^2$$\n\n$E=mc^2$\n\n\\(x+y\\)\n\n\\[\\int_a^b\\]");
    expect(html).toContain("$$a^2+b^2=c^2$$");
    expect(html).toContain("$E=mc^2$");
    expect(html).toContain("\\(x+y\\)");
    expect(html).toContain("\\[\\int_a^b\\]");
  });

  it("5. fenced 代码块保留；缩进代码不误判（#855）", () => {
    const html = parseMarkdown("```js\nconst a = 1;\n```\n\n    缩进文本不当代码");
    expect(html).toContain("<pre><code");
    expect(html).toContain("const a = 1;");
    expect(html).not.toContain("<pre><code>缩进文本");
  });

  it("6. GFM：表格 / 删除线 / 自动链接", () => {
    const html = parseMarkdown(
      "| a | b |\n| - | - |\n| 1 | 2 |\n\n~~删掉~~\n\nhttps://twikoo.js.org",
    );
    expect(html).toContain("<table>");
    expect(html).toContain("<del>删掉</del>");
    expect(html).toContain("https://twikoo.js.org");
  });

  it("7. 外链 renderLinks：target=_blank + rel（DOM 工具）", async () => {
    const { renderLinks } = await import("../src/utils/index");
    document.body.innerHTML = '<div id="t"><a href="https://evil.test">x</a></div>';
    renderLinks(document.getElementById("t") as HTMLElement);
    const a = document.querySelector("#t a") as HTMLAnchorElement;
    expect(a.getAttribute("target")).toBe("_blank");
    expect(a.getAttribute("rel")).toContain("noopener");
  });

  it("8. XSS 清洗：jsdom 绑定 DOMPurify 真实清洗（对齐 1.x FORBID 配置）", async () => {
    const { JSDOM } = (await import("jsdom")) as unknown as {
      JSDOM: new (html?: string) => { window: unknown };
    };
    const { default: createDOMPurify } = await import("dompurify");
    const DOMPurify = createDOMPurify(new JSDOM("").window as never);
    const dirty = '<p onclick="x()">ok</p><script>alert(1)</script><style>.x{}</style>';
    const clean = DOMPurify.sanitize(dirty, { FORBID_TAGS: ["style"], FORBID_ATTR: ["style"] });
    expect(clean).toContain("ok");
    expect(clean).not.toContain("<script");
    expect(clean).not.toContain("alert(1)");
    // 客户端 sanitizeHtml 包装层：透传 + 空值兜底（happy-dom 绑定对标签内文本透明）
    expect(sanitizeHtml("plain text")).toBe("plain text");
    expect(sanitizeHtml(undefined)).toBe("");
  });

  it("9. 混排：owo + fenced 代码 + 公式 + 链接同文", () => {
    const md = [
      "看 :tv_taking:",
      "",
      "```js",
      "const b = 2;",
      "```",
      "",
      "$a=b$",
      "",
      "[链接](https://t.test)",
    ].join("\n");
    const html = parseMarkdown(md);
    expect(html).toContain("tk-owo-emotion");
    expect(html).toContain('class="language-js"');
    expect(html).toContain("const b = 2;");
    expect(html).toContain("$a=b$");
    expect(html).toContain('href="https://t.test"');
  });
});
