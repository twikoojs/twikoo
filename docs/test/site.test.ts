/**
 * 验收用例：文档站结构与内容更新。
 *
 * - 中英 sidebar 项数相等（Acceptance 的脚本断言）；
 * - sidebar 每一项都能落到真实页面文件（防止「加进导航但没有页面」）；
 * - ② 要求的 CloudBase CLI 弃用标注必须存在；
 * - 一键部署模板仍在、且仍可被云平台直接消费（纯 JS / 只依赖 latest，见 `templates/README.md`）。
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createMarkdownRenderer } from "vitepress";
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

describe("文档站结构", () => {
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

  it("4 个英文页存在", () => {
    for (const page of ["cms", "configuration", "mongodb-atlas", "QQ_API"]) {
      expect(existsSync(resolve(DOCS_ROOT, "en", `${page}.md`)), `缺少 en/${page}.md`).toBe(true);
    }
  });
});

describe("内容更新", () => {
  it("② CloudBase CLI 方式标注「2.0 起不再支持」", () => {
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

  it("③ 浏览器基线已在 intro 与 frontend 标注", () => {
    for (const file of ["intro.md", "en/intro.md", "frontend.md", "en/frontend.md"]) {
      const src = readFileSync(resolve(DOCS_ROOT, file), "utf8");
      expect(src, `${file} 缺少浏览器基线`).toMatch(/ES2022/);
      expect(src, `${file} 缺少最低版本`).toMatch(/94\+|15\.4\+/);
    }
  });

  it("④ api 页已记录服务端事件语义（POST_SUBMIT 为内部事件；HIDDEN/VISIBLE 是 type 取值而非事件名）", () => {
    for (const file of ["api.md", "en/api.md"]) {
      const src = readFileSync(resolve(DOCS_ROOT, file), "utf8");
      for (const token of ["POST_SUBMIT", "HIDDEN", "VISIBLE"]) {
        expect(src, `${file} 缺少 ${token}`).toContain(token);
      }
      // 关键：HIDDEN / VISIBLE 必须被说明为 type 参数取值，而不是事件名
      expect(src, `${file} 未把 HIDDEN 说明为 type 取值`).toContain('"type": "HIDDEN"');
    }
  });

  it("⑤ 本地开发（pnpm demo）章节已加入 intro", () => {
    for (const file of ["intro.md", "en/intro.md"]) {
      const src = readFileSync(resolve(DOCS_ROOT, file), "utf8");
      expect(src, `${file} 缺少 pnpm demo`).toContain("pnpm demo");
      expect(src, `${file} 未说明 Node 版本`).toMatch(/Node 26/);
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
    expect(src).toMatch(/Node\.js[\s|]*\*\*26\*\*/);
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

  it("站点内嵌的 twikoo 版本由构建注入（不写死在源码里）", () => {
    const theme = readFileSync(resolve(DOCS_ROOT, ".vitepress/theme/Twikoo.vue"), "utf8");
    expect(theme).toContain("import.meta.env.VITE_TWIKOO_VERSION");
    // 源码里不得再出现写死版本的 CDN 地址（twikoo@1.7.24 这类）
    expect(theme).not.toMatch(/npm\/twikoo@\d/);
    const wf = readFileSync(resolve(DOCS_ROOT, "..", ".github", "workflows", "docs.yml"), "utf8");
    // release 触发用发布 tag，其余取 registry 最新稳定版；两者都写进 VITE_TWIKOO_VERSION
    expect(wf).toContain("github.event.release.tag_name");
    expect(wf).toContain("npm view twikoo version");
    expect(wf).toContain("VITE_TWIKOO_VERSION");
  });
});

describe("CDN 示例的版本注入", () => {
  it("CDN 示例用占位符，不写死版本号", () => {
    for (const file of ["frontend.md", "en/frontend.md"]) {
      const src = readFileSync(resolve(DOCS_ROOT, file), "utf8");
      expect(src, `${file} 缺少版本占位符`).toContain("__TWIKOO_VERSION__");
      // 写死 twikoo 的版本号（twikoo@1.6.36 / twikoo/2.0.0/files 这类）就又会变成「发版必须改文档」；
      // 前置的 [^-\w] 是为了放过第三方插件名 hexo-next-twikoo@1.0.3
      expect(src, `${file} 仍写死 twikoo 的 CDN 版本`).not.toMatch(/(?:^|[^-\w])twikoo[@/]\d/m);
      expect(src, `${file} 仍写死 beta 版本`).not.toContain("2.0.0-beta");
    }
    // 第三方插件的版本号（hexo-next-twikoo@1.0.x）是它自己的版本，不该被占位符化
    expect(readFileSync(resolve(DOCS_ROOT, "frontend.md"), "utf8")).toContain(
      "hexo-next-twikoo@1.0.3",
    );
  });

  it("配置里的 markdown 规则会把占位符替换掉（真跑一遍，不只看源码有没有这个词）", async () => {
    const md = await createMarkdownRenderer(DOCS_ROOT);
    config.markdown?.config?.(md, {});
    const html = md.render(
      '```html\n<script src="https://cdn.jsdelivr.net/npm/twikoo@__TWIKOO_VERSION__/dist/twikoo.min.js"></script>\n```',
    );
    expect(html, "占位符没被替换").not.toContain("__TWIKOO_VERSION__");
    // 替换成的是「某个版本」或本地未注入时的回退值 latest
    expect(html).toMatch(/twikoo@[^/"]+\/dist\/twikoo\.min\.js/);
  });
});

describe("一键部署模板", () => {
  /** 仓库根（docs 的上一级） */
  const REPO_ROOT = resolve(DOCS_ROOT, "..");

  it("Vercel / CloudBase / AWS / Hugging Face 四个模板都在仓库内", () => {
    for (const rel of [
      "templates/vercel-min/api/index.js",
      "templates/vercel-min/vercel.json",
      "templates/cloudbase/twikoo/index.js",
      "templates/aws-lambda/src/index.js",
      "templates/aws-lambda/terraform/main.tf",
      "templates/hf-space/Dockerfile",
      "templates/hf-space/src/start.sh",
    ]) {
      expect(existsSync(resolve(REPO_ROOT, rel)), `缺少一键部署模板文件 ${rel}`).toBe(true);
    }
  });

  it("模板入口是纯 JS 转发壳，且只依赖发布包（否则平台侧装不上、也构建不了）", () => {
    for (const rel of [
      "templates/vercel-min/api/index.js",
      "templates/cloudbase/twikoo/index.js",
      "templates/aws-lambda/src/index.js",
    ]) {
      const src = readFileSync(resolve(REPO_ROOT, rel), "utf8");
      // 允许作用域包（@twikoojs/aws-lambda 这类）
      expect(src, `${rel} 应当 require 一个发布到 npm 的包`).toMatch(/require\("[a-z@/-]+"\)/);
      // 平台侧不跑构建：出现 import/export 语句就说明这里混进了 TS 源码
      expect(src, `${rel} 不得使用 import/export 语句`).not.toMatch(/^\s*(import|export)\s/m);
    }
    for (const rel of [
      "templates/vercel-min/package.json",
      "templates/cloudbase/twikoo/package.json",
      "templates/aws-lambda/src/package.json",
    ]) {
      const raw = readFileSync(resolve(REPO_ROOT, rel), "utf8");
      expect(raw, `${rel} 不得依赖 monorepo 内部路径`).not.toMatch(/workspace:|file:/);
      const { dependencies } = JSON.parse(raw) as { dependencies: Record<string, string> };
      // 依赖写 latest：一键部署跟随稳定通道，发新版不用回来改版本号
      expect(Object.values(dependencies), `${rel} 的依赖必须写 latest`).toEqual(["latest"]);
    }
  });

  it("模板依赖的包都在发布清单里（改名 / 换包不会悄悄失联）", () => {
    const release = readFileSync(resolve(REPO_ROOT, "scripts/release-packages.mjs"), "utf8");
    for (const rel of [
      "templates/vercel-min/package.json",
      "templates/cloudbase/twikoo/package.json",
      "templates/aws-lambda/src/package.json",
    ]) {
      const { dependencies } = JSON.parse(readFileSync(resolve(REPO_ROOT, rel), "utf8")) as {
        dependencies: Record<string, string>;
      };
      for (const name of Object.keys(dependencies)) {
        expect(release, `${rel} 依赖的 ${name} 不在发布清单里`).toContain(`"${name}"`);
      }
    }
  });

  it("AWS 模板的 terraform source_path 指向含入口的目录（打出来的 zip 里要有 index.js）", () => {
    const tf = readFileSync(resolve(REPO_ROOT, "templates/aws-lambda/terraform/main.tf"), "utf8");
    const m = /source_path\s*=\s*"([^"]+)"/.exec(tf);
    expect(m, "main.tf 缺少 source_path").toBeTruthy();
    const srcDir = resolve(REPO_ROOT, "templates/aws-lambda/terraform", m![1]);
    expect(
      existsSync(resolve(srcDir, "index.js")),
      `source_path 目录缺少 index.js：${srcDir}`,
    ).toBe(true);
    // 入口名要与 handler 对得上
    expect(tf).toMatch(/handler\s*=\s*"index\.handler"/);
    expect(readFileSync(resolve(REPO_ROOT, "templates/aws-lambda/src/index.js"), "utf8")).toContain(
      "exports.handler",
    );
  });

  it("cloudbaserc.json 的 functionRoot 指向真实模板，运行时 ≥ Node 20", () => {
    const cfg = JSON.parse(readFileSync(resolve(REPO_ROOT, "cloudbaserc.json"), "utf8")) as {
      functionRoot: string;
      functions: Array<{ name: string; runtime: string; handler: string }>;
      framework: { plugins: { function: { inputs: { functionRootPath: string } } } };
    };
    const rel = cfg.functionRoot.replace(/^\.\//, "");
    const fn = cfg.functions[0];
    expect(
      existsSync(resolve(REPO_ROOT, rel, fn.name)),
      `functionRoot 下缺少函数目录 ${fn.name}`,
    ).toBe(true);
    // 命令行（functions[]）与一键部署（framework.plugins.function）必须指向同一个目录
    expect(cfg.framework.plugins.function.inputs.functionRootPath).toBe(cfg.functionRoot);
    // 2.0 产物语法目标 ES2022，Node 16 跑不起来
    const major = Number(/Nodejs(\d+)/.exec(fn.runtime)?.[1]);
    expect(major, `CloudBase 运行时 ${fn.runtime} 低于 Node 20`).toBeGreaterThanOrEqual(20);
  });

  it("部署文档指向 2.0 的模板路径，且不再要求用户改版本号", () => {
    for (const file of ["backend.md", "update.md", "en/backend.md", "en/update.md"]) {
      const src = readFileSync(resolve(DOCS_ROOT, file), "utf8");
      expect(src, `${file} 仍指向 1.x 的部署目录`).not.toMatch(/tree\/main\/src\/server/);
      expect(src, `${file} 仍要求用户把版本号改成最新版`).not.toMatch(
        /修改为最新版本号|to the latest version number/,
      );
      expect(src, `${file} 仍固定 twikoo-* 的依赖版本`).not.toMatch(
        /twikoo-(func|vercel|netlify)": "\^?\d/,
      );
    }
    const zh = readFileSync(resolve(DOCS_ROOT, "backend.md"), "utf8");
    for (const token of [
      "templates/vercel-min",
      "templates/cloudbase",
      "templates/aws-lambda",
      "templates/hf-space",
    ]) {
      expect(zh, `backend.md 未提及 ${token}`).toContain(token);
    }
  });
});
