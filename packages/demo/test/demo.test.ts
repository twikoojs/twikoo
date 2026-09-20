/**
 * 验收用例（demo 一键启动 + 依赖本地化）。
 *
 * 覆盖三层：
 *  ① 离线依赖本地化——`scripts/prepare-assets.mjs` 真实执行后 vendor 资产齐全；
 *  ② demo 页零 CDN 外链——两个 HTML 均只引用本地路径（Acceptance 的 grep 断言）；
 *  ③ 一键编排结构——根 `demo` 脚本确实拉起「客户端 watch + 后端 + demo 页」三进程。
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  CLIENT_PRODUCT_FILES,
  DEFAULT_BACKEND_URL,
  DEMO_PORT,
  DEMO_STORAGE_PREFIX,
  SERVER_PORT,
  VENDOR_DIR_NAME,
} from "../src/index";

/** demo 包目录（packages/demo） */
const DEMO_ROOT = fileURLToPath(new URL("..", import.meta.url));
/** 仓库根目录（packages/demo → 上两级） */
const REPO_ROOT = resolve(DEMO_ROOT, "../..");

/**
 * 读取 demo 包内的 HTML 文件文本。
 * @param name 文件名（demo.html / index.html）
 * @returns 文件文本
 */
function readHtml(name: string): string {
  return readFileSync(resolve(DEMO_ROOT, name), "utf8");
}

/**
 * 读取仓库内某包的 package.json 并解析。
 * @param relPath 相对仓库根的路径
 * @returns 解析后的对象
 */
function readJson(relPath: string): Record<string, unknown> {
  return JSON.parse(readFileSync(resolve(REPO_ROOT, relPath), "utf8")) as Record<string, unknown>;
}

describe("离线依赖本地化", () => {
  // 本用例真跑一遍 prepare-assets（bulma + katex 含字体目录的磁盘拷贝）：
  // 单独约 2s，全仓并行抢 CPU 时 4.5~5.2s，会撞上 vitest 默认的 5s testTimeout → 偶发红。
  it("prepare-assets 复制 bulma / katex（含字体目录）到 .vendor", { timeout: 30_000 }, () => {
    const script = resolve(DEMO_ROOT, "scripts/prepare-assets.mjs");
    const output = execFileSync(process.execPath, [script, "--force"], {
      cwd: DEMO_ROOT,
      encoding: "utf8",
    });
    expect(output).toContain("本地化资产就绪");

    const vendor = resolve(DEMO_ROOT, VENDOR_DIR_NAME);
    const files = [
      "bulma/bulma.min.css",
      "katex/katex.min.css",
      "katex/katex.min.js",
      "katex/auto-render.min.js",
    ];
    for (const rel of files) {
      const file = resolve(vendor, rel);
      expect(existsSync(file), `缺少 vendor 资产 ${rel}`).toBe(true);
      expect(statSync(file).size, `vendor 资产为空 ${rel}`).toBeGreaterThan(0);
    }

    // katex.min.css 以相对路径 fonts/ 引用字体，字体目录缺失会导致离线公式字体 404
    const fonts = resolve(vendor, "katex/fonts");
    expect(existsSync(fonts), "缺少 katex 字体目录").toBe(true);
    expect(statSync(fonts).isDirectory()).toBe(true);
  });
});

describe("demo 页零 CDN 外链", () => {
  it("demo.html 与 index.html 均不引用任何 CDN（Acceptance 的 grep cdn == 0）", () => {
    for (const name of ["demo.html", "index.html"]) {
      const html = readHtml(name);
      expect(html, `${name} 仍引用 CDN`).not.toMatch(/cdn/i);
      // SRI 完整性校验属性是 CDN 引用的伴生标志，一并断言不留残余
      expect(html, `${name} 残留 CDN 的 integrity 属性`).not.toMatch(/integrity=/i);
      expect(html, `${name} 出现外部资源协议`).not.toMatch(/src=["']https?:\/\//i);
      expect(html, `${name} 出现外部样式协议`).not.toMatch(/href=["']https?:\/\/cdn/i);
    }
  });

  it("demo.html 全部资源引用指向本地路径", () => {
    const html = readHtml("demo.html");
    for (const local of [
      "/bulma/bulma.min.css",
      "/katex/katex.min.css",
      "/katex/katex.min.js",
      "/katex/auto-render.min.js",
      "/demo.css",
      "/twikoo.all.min.js",
    ]) {
      expect(html, `demo.html 缺少本地资源引用 ${local}`).toContain(local);
    }
  });

  it("index.html 保留跳转到 demo.html 的行为", () => {
    const html = readHtml("index.html");
    expect(html).toContain("location.href");
    expect(html).toContain("demo.html");
  });
});

describe("demo 页开箱即用行为", () => {
  it("默认填入本地后端地址，无需手填", () => {
    const html = readHtml("demo.html");
    expect(html).toContain(`value="${DEFAULT_BACKEND_URL}"`);
    expect(DEFAULT_BACKEND_URL).toBe(`http://localhost:${SERVER_PORT}`);
  });

  it("保留 1.x 的 localStorage 持久化与挂载点", () => {
    const html = readHtml("demo.html");
    expect(html).toContain(DEMO_STORAGE_PREFIX);
    for (const key of ["envId", "region", "path", "lang"]) {
      expect(html, `缺少 localStorage 持久化项 ${key}`).toContain(`"${key}"`);
    }
    expect(html).toContain("twikoo");
    expect(html).toContain('el: "#tcomment"');
    expect(html).toContain('class="twikoo" id="tcomment"');
  });

  it("端口常量一致（客户端/demo 页 9820、后端 8080）", () => {
    expect(DEMO_PORT).toBe(9820);
    expect(SERVER_PORT).toBe(8080);
    expect(CLIENT_PRODUCT_FILES).toContain("twikoo.all.min.js");
  });
});

describe("一键启动编排", () => {
  it("根 demo 脚本用 concurrently 拉起三进程并统一清理", () => {
    const root = readJson("package.json");
    const scripts = root.scripts as Record<string, string>;
    const demo = scripts.demo;
    expect(demo, "缺少根 demo 脚本").toBeTruthy();
    expect(demo).toContain("concurrently");
    expect(demo, "缺少 -k（任一进程退出时统一清理）").toMatch(/-k\b/);
    // 三个进程已拆成具名脚本（demo:client / demo:server / demo:page），由根 demo 拉起，
    // 故「跑什么」断言落在子脚本上，根脚本只校验确实拉起了这三个。
    for (const name of ["demo:client", "demo:server", "demo:page"]) {
      expect(demo, `根 demo 脚本未拉起 ${name}`).toContain(`pnpm:${name}`);
      expect(scripts[name], `缺少 ${name} 脚本`).toBeTruthy();
    }
    expect(scripts["demo:client"], "缺少客户端 watch 进程").toContain(
      "--filter twikoo build:watch",
    );
    expect(scripts["demo:server"], "缺少后端进程").toContain("--filter tkserver start");
    expect(scripts["demo:page"], "缺少 demo 页进程").toContain("--filter @twikoojs/demo dev");

    const devDeps = root.devDependencies as Record<string, string>;
    expect(devDeps.concurrently, "缺少 concurrently 依赖").toBeTruthy();
    expect(devDeps["cross-env"], "缺少 cross-env 依赖（跨平台 env 传递）").toBeTruthy();
    // 后端数据目录显式指向仓库根 data/（packages/server-self-hosted 的 cwd 上溯两级），
    // 该目录已被 .gitignore 的 data/ 覆盖，保证 demo 数据不误入版本库；
    // TWIKOO_SEED=1 打开 demo 测试数据 seed。
    expect(scripts["demo:server"], "demo:server 未指定 TWIKOO_DATA").toContain(
      "TWIKOO_DATA=../../data",
    );
    expect(scripts["demo:server"], "demo:server 未开启 TWIKOO_SEED").toContain("TWIKOO_SEED=1");
  });

  it("客户端提供 build:watch，tkserver 提供 start", () => {
    const client = readJson("packages/client/package.json");
    expect((client.scripts as Record<string, string>)["build:watch"]).toContain("--watch");

    const server = readJson("packages/server-self-hosted/package.json");
    expect((server.scripts as Record<string, string>).start).toContain("dist/server.js");
  });

  it("demo 包 dev 脚本先本地化资产再启动 Vite", () => {
    const demo = readJson("packages/demo/package.json");
    const scripts = demo.scripts as Record<string, string>;
    expect(scripts.dev).toContain("prepare-assets.mjs");
    expect(scripts.dev).toContain("vite");
    expect((demo.devDependencies as Record<string, string>).bulma).toBeTruthy();
    expect((demo.devDependencies as Record<string, string>).katex).toBeTruthy();
  });

  it("Vite 配置固定 9820 端口并直供根路径资源", () => {
    const config = readFileSync(resolve(DEMO_ROOT, "vite.config.ts"), "utf8");
    expect(config).toContain("strictPort: true");
    expect(config).toContain("serveRootAssets");
    expect(config).toContain("CLIENT_DIST");
    // demo.css 必须按 text/css 直供：交给 Vite CSS 管线会返回 text/javascript，
    // 浏览器拒绝应用该样式表（实测缺陷，固化为回归断言）
    expect(config).toContain('"/demo.css"');
    expect(config).toContain("text/css; charset=utf-8");
  });
});
