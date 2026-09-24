/**
 * 验收用例：文档站结构、站点工程配置与一键部署模板。
 *
 * **不测文档正文措辞**——文档内容不设断言（措辞会随精简改动漂移，且维护成本高于收益）。
 * 这里只守「结构 / 机制」这类真正会坏的东西：
 * - 导航每一项都能落到真实页面（防止「加进导航但没有页面」）；
 * - twikoo 版本由构建注入，不得写死（否则又变成「发版必须改文档」）；
 * - 一键部署模板仍在、仍可被云平台直接消费、依赖不脱离发布清单。
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
  it("中英 sidebar 项数相等且均为 10 项", () => {
    const zh = sidebarOf("root");
    const en = sidebarOf("en");
    expect(zh.length).toBe(10);
    expect(en.length).toBe(10);
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

describe("站点工程配置", () => {
  it("docs 已纳入 pnpm workspace（package.json 名 = twikoo-docs）", () => {
    const pkg = JSON.parse(readFileSync(resolve(DOCS_ROOT, "package.json"), "utf8")) as {
      name: string;
    };
    expect(pkg.name).toBe("twikoo-docs");
    const ws = readFileSync(resolve(DOCS_ROOT, "..", "pnpm-workspace.yaml"), "utf8");
    expect(ws).toMatch(/- "docs"/);
  });

  it("部署工作流发布到 gh-pages 并保留 CNAME，且 Release 时同步部署", () => {
    const wf = readFileSync(resolve(DOCS_ROOT, "..", ".github", "workflows", "docs.yml"), "utf8");
    expect(wf).toContain("peaceiris/actions-gh-pages");
    expect(wf).toContain("publish_branch: gh-pages");
    expect(wf).toContain("cname: twikoo.js.org");
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
    config.markdown?.config?.(md);
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

  it("EdgeOne Makers 模板是可直接上传的 ZIP，且不含 index.html", () => {
    const zipPath = resolve(REPO_ROOT, "templates/edgeone-makers/twikoo-edgeone-makers.zip");
    expect(existsSync(zipPath), "缺少 EdgeOne Makers 一键部署 ZIP").toBe(true);

    // 手工读中央目录（不引依赖）：只需文件名列表
    const buf = readFileSync(zipPath);
    const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    expect(eocd, "ZIP 缺少 EOCD 记录").toBeGreaterThan(-1);
    const count = buf.readUInt16LE(eocd + 10);
    let offset = buf.readUInt32LE(eocd + 16);
    const names: string[] = [];
    for (let i = 0; i < count; i++) {
      expect(buf.readUInt32LE(offset), "中央目录签名不匹配").toBe(0x02014b50);
      const nameLen = buf.readUInt16LE(offset + 28);
      names.push(buf.subarray(offset + 46, offset + 46 + nameLen).toString("utf8"));
      offset += 46 + nameLen + buf.readUInt16LE(offset + 30) + buf.readUInt16LE(offset + 32);
    }

    // 平台按 cloud-functions/ 目录注册路由，入口必须在这个位置
    expect(names, "ZIP 缺少 cloud-functions/index.js").toContain("cloud-functions/index.js");
    // 静态资源与函数路由冲突时静态资源优先：有 index.html 就会让 / 失效
    expect(names, "ZIP 不得含 index.html（会抢占根路径）").not.toContain("index.html");
    // 平台侧不跑本仓库构建：cloud-functions/ 下只能是已构建的 .js 与 Go 桥接源码 .go
    expect(
      names.filter(
        (n) => n.startsWith("cloud-functions/") && !n.endsWith(".js") && !n.endsWith(".go"),
      ),
    ).toEqual([]);

    // 最小部署包：只声明依赖 + 一个 Go 桥接源码，实现由平台 npm install 取回并内联
    expect(names.slice().sort()).toEqual([
      "cloud-functions/index.js",
      "cloud-functions/smtp.go",
      "package.json",
    ]);
  });

  it("EdgeOne Makers 适配器在发布清单里（模板要靠它产出）", () => {
    const release = readFileSync(resolve(REPO_ROOT, "scripts/release-packages.mjs"), "utf8");
    expect(release).toContain('"@twikoojs/edgeone-makers"');
  });
});
