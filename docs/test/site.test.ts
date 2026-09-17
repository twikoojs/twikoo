/**
 * T38 验收用例：文档站结构与 §11.3 内容更新（D-7 / §11.2 / §11.3）。
 *
 * - 中英 sidebar 项数相等（Acceptance 的脚本断言）；
 * - sidebar 每一项都能落到真实页面文件（防止「加进导航但没有页面」）；
 * - §11.3 ② 要求的 CloudBase CLI 弃用标注必须存在（BC-14）。
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import config from "../.vitepress/config";

/** docs 目录 */
const DOCS_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** 取某个 locale 的 sidebar 项 */
function sidebarOf(locale: "root" | "en"): Array<{ text: string; link: string }> {
  const locales = config.locales as Record<string, { themeConfig?: { sidebar?: unknown } }>;
  const sidebar = locales[locale]?.themeConfig?.sidebar;
  if (!Array.isArray(sidebar)) throw new Error(`locale ${locale} 缺少 sidebar 数组`);
  return sidebar as Array<{ text: string; link: string }>;
}

/**
 * 把 sidebar 的 link 映射到磁盘上的 md 文件。
 * @param link sidebar 链接（如 `/en/quick-start`）
 * @returns 文件绝对路径（含 .md 与 index.md 两种形态之一）
 */
function fileForLink(link: string): string {
  const rel = link.replace(/^\//, "").replace(/\/$/, "");
  return resolve(DOCS_ROOT, rel === "" ? "index.md" : `${rel}.md`);
}

describe("T38 文档站结构", () => {
  it("中英 sidebar 项数相等且均为 9 项", () => {
    const zh = sidebarOf("root");
    const en = sidebarOf("en");
    expect(zh.length).toBe(9);
    expect(en.length).toBe(9);
    expect(en.length).toBe(zh.length);
  });

  it("sidebar 每一项都能落到真实页面文件", () => {
    for (const [locale, items] of [
      ["root", sidebarOf("root")],
      ["en", sidebarOf("en")],
    ] as const) {
      for (const item of items) {
        const file = fileForLink(item.link);
        expect(existsSync(file), `${locale} sidebar「${item.text}」缺少页面 ${item.link}`).toBe(
          true,
        );
      }
    }
  });

  it("§11.2 要求的 4 个英文页存在", () => {
    for (const page of ["cms", "configuration", "mongodb-atlas", "QQ_API"]) {
      expect(existsSync(resolve(DOCS_ROOT, "en", `${page}.md`)), `缺少 en/${page}.md`).toBe(true);
    }
  });
});

describe("T38 §11.3 内容更新", () => {
  it("② CloudBase CLI 方式标注「2.0 起不再支持」（BC-14）", () => {
    const zh = readFileSync(resolve(DOCS_ROOT, "backend.md"), "utf8");
    const en = readFileSync(resolve(DOCS_ROOT, "en/backend.md"), "utf8");
    expect(zh).toContain("2.0 起不再支持");
    expect(zh).toMatch(
      /tcb fn deploy[\s\S]{0,400}2\.0 起不再支持|2\.0 起不再支持[\s\S]{0,400}tcb fn deploy/,
    );
    expect(en.toLowerCase()).toContain("no longer supported since 2.0");
  });

  it("② 能力矩阵与 EO 邮件限制已写入 docs", () => {
    const zh = readFileSync(resolve(DOCS_ROOT, "backend.md"), "utf8");
    expect(zh).toContain("能力矩阵");
    expect(zh).toMatch(/SendGrid|MailChannels/);
    expect(zh).toContain("Go SMTP Bridge");
  });

  it("③ 浏览器基线（BC-2）已在 intro 与 frontend 标注", () => {
    for (const file of ["intro.md", "en/intro.md", "frontend.md", "en/frontend.md"]) {
      const src = readFileSync(resolve(DOCS_ROOT, file), "utf8");
      expect(src, `${file} 缺少浏览器基线`).toMatch(/ES2022/);
      expect(src, `${file} 缺少最低版本`).toMatch(/94\+|15\.4\+/);
    }
  });

  it("④ api 页已记录 POST_SUBMIT / HIDDEN / VISIBLE 兼容事件", () => {
    for (const file of ["api.md", "en/api.md"]) {
      const src = readFileSync(resolve(DOCS_ROOT, file), "utf8");
      for (const event of ["POST_SUBMIT", "HIDDEN", "VISIBLE"]) {
        expect(src, `${file} 缺少 ${event}`).toContain(event);
      }
      expect(src).toMatch(/2\.2\.0/);
    }
  });

  it("⑤ 本地开发（pnpm demo）章节已加入 intro", () => {
    for (const file of ["intro.md", "en/intro.md"]) {
      const src = readFileSync(resolve(DOCS_ROOT, file), "utf8");
      expect(src, `${file} 缺少 pnpm demo`).toContain("pnpm demo");
      expect(src, `${file} 未说明 Node 版本`).toMatch(/Node 24/);
    }
  });

  it("⑥ 常见错误排查章节已加入 faq（八类 kind）", () => {
    for (const file of ["faq.md", "en/faq.md"]) {
      const src = readFileSync(resolve(DOCS_ROOT, file), "utf8");
      for (const kind of [
        "NETWORK",
        "CORS",
        "TIMEOUT",
        "REJECTED",
        "NOT_FOUND",
        "CLIENT_ERROR",
        "SERVER_ERROR",
        "UNKNOWN",
      ]) {
        expect(src, `${file} 缺少错误类型 ${kind}`).toContain(kind);
      }
    }
  });

  it("⑦ DEVELOPMENT.md 已按 monorepo 重写", () => {
    const src = readFileSync(resolve(DOCS_ROOT, "..", "DEVELOPMENT.md"), "utf8");
    expect(src).toContain("pnpm demo");
    expect(src).toContain("pnpm install");
    expect(src).toMatch(/Node\.js[\s|]*\*\*24\*\*/);
    expect(src).toContain(".env.example");
  });

  it("docs 已纳入 pnpm workspace（package.json 名 = twikoo-docs）", () => {
    const pkg = JSON.parse(readFileSync(resolve(DOCS_ROOT, "package.json"), "utf8")) as {
      name: string;
    };
    expect(pkg.name).toBe("twikoo-docs");
    const ws = readFileSync(resolve(DOCS_ROOT, "..", "pnpm-workspace.yaml"), "utf8");
    expect(ws).toMatch(/- "docs"/);
  });

  it("部署工作流保留 vuepress-deploy + gh-pages + CNAME，且 Release 时同步部署", () => {
    const wf = readFileSync(resolve(DOCS_ROOT, "..", ".github", "workflows", "docs.yml"), "utf8");
    expect(wf).toContain("imaegoo/vuepress-deploy@master");
    expect(wf).toContain("TARGET_BRANCH: gh-pages");
    expect(wf).toContain("CNAME: twikoo.js.org");
    expect(wf).toMatch(/release:\s*\n\s*types:\s*\[published\]/);
    expect(wf).toContain("pnpm --filter twikoo-docs docs:build");
  });
});
