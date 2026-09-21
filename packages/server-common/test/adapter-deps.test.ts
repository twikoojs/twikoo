/**
 * 适配器「能力声明 ↔ 依赖声明」完整性测试。
 *
 * **约定**（AGENTS.md「平台适配器开发指南 · 依赖完整性」）：`@twikoojs/common` 把重依赖
 * 声明为 `peerDependenciesMeta.optional`（只表达接口约束），**实际安装由适配器负责** ——
 * 运行时经 `src/utils/lib-loader.ts` 动态加载。适配器漏声明不会构建失败，只在**运行时**
 * 报 `LibLoadError`，而且未必立刻暴露：例如 IP 属地查询整段包在 `try/catch` 里，
 * 表现为「属地静默为空」，站长与访客都看不到任何错误（见 #1127）。
 *
 * **两条判据**：
 *
 * 1. **能力门控**：适配器把某能力声明为 `true`，就必须声明该能力关联的每个包
 *    （映射镜像 `lib-loader` 的 `requireCapability` 调用点，下方有同步断言）。
 * 2. **无能力门**：`lib-loader` 里没有能力门、任何适配器处理某个事件时都可能加载的包，
 *    **所有**适配器都必须声明（没有门 ⇒ 没有降级路径）。
 *
 * **为什么放在 `@twikoojs/common`**：能力 → 包的映射由本包 `src/utils/lib-loader.ts`
 * 定义，适配器只是消费者。本文件会读各适配器的 `package.json` 与 `src/`（跨包读取，
 * 与 `packages/demo/test` 的做法一致）。
 *
 * `mongodb` / `lokijs` 不在此检查范围：它们不经 `lib-loader`，而由适配器注入的
 * `database` 端口自行选择（如 EO 用 `BlobKvDatabase`），不是「人人必备」。
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FULL_CAPABILITIES } from "../src/ports/capabilities";

/** 仓库根（本文件位于 packages/server-common/test/） */
const REPO_ROOT = fileURLToPath(new URL("../../..", import.meta.url));

/** 能力 → 该能力为 true 时适配器必须声明的包（镜像 lib-loader 的 requireCapability 调用点） */
const CAPABILITY_PACKAGES: Record<string, string[]> = {
  mail: ["nodemailer"],
  // DOMPurify 需要一个 window，故 jsdom 与 dompurify 同装（见 getDomPurify）
  domPurify: ["jsdom", "dompurify"],
  ip2region: ["@imaegoo/node-ip2region"],
  akismet: ["akismet-api"],
  tencentTms: ["tencentcloud-sdk-nodejs-tms"],
  imageUpload: ["form-data"],
  ai: ["@xsai/generate-text"],
};

/**
 * 已知缺口白名单（**自清理**：缺口修好后必须删除对应条目，否则「白名单腐化」用例会红）。
 *
 * 每条都必须能追溯到跟踪 issue，别只写包名。
 */
const KNOWN_GAPS: Record<string, string[]> = {
  // 见 #1127：EO 的 capabilities 声明了 ip2region / imageUpload / 即时推送，
  // 但这三个包都没在 dependencies 里；其中 ip2region 还需要 1.x 那套「不依赖 fs 的
  // 内联 searcher」，不是加一行依赖能修的。
  "server-edgeone-makers": [
    "ip2region=true 需要 @imaegoo/node-ip2region",
    "imageUpload=true 需要 form-data",
    "无能力门但所有适配器都需要 pushoo",
  ],
};

/** lib-loader 源码（能力映射与加载清单的真相源） */
const LIB_LOADER_SOURCE = readFileSync(
  join(REPO_ROOT, "packages/server-common/src/utils/lib-loader.ts"),
  "utf8",
);

/**
 * 从 lib-loader 源码解析 `requireCapability(caps, "<能力>", "<包>")` 里的能力名。
 * @returns 能力名（去重）
 */
function gatedCapabilities(): string[] {
  const found = [...LIB_LOADER_SOURCE.matchAll(/requireCapability\(\s*caps,\s*"([^"]+)"/g)].map(
    (m) => m[1],
  );
  return [...new Set(found)];
}

/**
 * 从 lib-loader 源码解析所有 `loadLib("<包>")` 调用点。
 * @returns 包名（去重）
 */
function loadLibPackages(): string[] {
  const found = [...LIB_LOADER_SOURCE.matchAll(/\bloadLib\("([^"]+)"\)/g)].map((m) => m[1]);
  return [...new Set(found)];
}

/**
 * 无能力门的包：所有 `loadLib` 调用点减去被能力门控的那些。
 * @returns 包名
 */
function ungatedPackages(): string[] {
  const gated = new Set(Object.values(CAPABILITY_PACKAGES).flat());
  return loadLibPackages().filter((p) => !gated.has(p));
}

/**
 * 递归收集目录下所有 .ts 源码文本。
 * @param dir 目录
 * @returns 拼接后的源码
 */
function readTsSources(dir: string): string {
  if (!existsSync(dir)) return "";
  let out = "";
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out += readTsSources(full);
    else if (entry.name.endsWith(".ts")) out += readFileSync(full, "utf8");
  }
  return out;
}

/**
 * 抽取适配器声明的能力值。
 *
 * 两代写法都要认：多数适配器直接 `const caps = FULL_CAPABILITIES`（全 true），
 * cloudbase / EO 则逐项写 `{ mail: "restricted", domPurify: false, ... }`。
 * @param adapterDir 适配器目录名（packages/ 下）
 * @returns 能力 → 声明值
 */
function declaredCapabilities(adapterDir: string): Record<string, unknown> {
  const source = readTsSources(join(REPO_ROOT, "packages", adapterDir, "src"));
  if (/\bFULL_CAPABILITIES\b/.test(source)) {
    return { ...FULL_CAPABILITIES };
  }
  const declared: Record<string, unknown> = {};
  for (const cap of Object.keys(FULL_CAPABILITIES)) {
    const match = source.match(
      new RegExp(`\\b${cap}\\s*:\\s*(true|false|"restricted"|'restricted')`),
    );
    if (match) declared[cap] = match[1] === "true" ? true : match[1].replace(/["']/g, "");
  }
  return declared;
}

/**
 * 适配器的重依赖声明缺口。
 * @param adapterDir 适配器目录名（packages/ 下）
 * @returns 缺口描述（空数组表示合规）
 */
function adapterGaps(adapterDir: string): string[] {
  const manifest = JSON.parse(
    readFileSync(join(REPO_ROOT, "packages", adapterDir, "package.json"), "utf8"),
  ) as { dependencies?: Record<string, string> };
  const deps = Object.keys(manifest.dependencies ?? {});
  const declared = declaredCapabilities(adapterDir);

  const gaps: string[] = [];
  for (const [cap, pkgs] of Object.entries(CAPABILITY_PACKAGES)) {
    if (declared[cap] !== true) continue;
    for (const pkg of pkgs) {
      if (!deps.includes(pkg)) gaps.push(`${cap}=true 需要 ${pkg}`);
    }
  }
  for (const pkg of ungatedPackages()) {
    if (!deps.includes(pkg)) gaps.push(`无能力门但所有适配器都需要 ${pkg}`);
  }
  return gaps;
}

/** 所有适配器目录名（packages/server-*，排除 server-common 自身） */
function adapterDirs(): string[] {
  return readdirSync(join(REPO_ROOT, "packages"), { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name.startsWith("server-") && e.name !== "server-common")
    .filter((e) => existsSync(join(REPO_ROOT, "packages", e.name, "package.json")))
    .map((e) => e.name);
}

describe("能力 → 包 映射与 lib-loader 保持同步", () => {
  it("能力门控清单与 requireCapability 调用点一致", () => {
    expect(Object.keys(CAPABILITY_PACKAGES).sort()).toEqual(gatedCapabilities().sort());
  });

  it("映射里的包都在 loadLib 调用点里（避免指向一个根本不加载的包）", () => {
    const loaded = new Set(loadLibPackages());
    const unknown = Object.values(CAPABILITY_PACKAGES)
      .flat()
      .filter((p) => !loaded.has(p));
    expect(unknown, `这些包不在 lib-loader 的 loadLib 调用点里：${unknown.join(", ")}`).toEqual([]);
  });

  it("存在无能力门的包（判据二非空，说明该分支确实在起作用）", () => {
    expect(ungatedPackages().length).toBeGreaterThan(0);
  });
});

describe("各适配器的重依赖声明完整性", () => {
  it("能力为 true 所需的重依赖、以及无能力门的通用重依赖，都必须已在 dependencies 里", () => {
    const problems: string[] = [];
    for (const dir of adapterDirs()) {
      const allowed = KNOWN_GAPS[dir] ?? [];
      for (const gap of adapterGaps(dir)) {
        if (!allowed.includes(gap)) problems.push(`${dir}: ${gap}`);
      }
    }
    expect(
      problems,
      `以下适配器的重依赖声明有缺口（运行时才会报 LibLoadError）：\n  ${problems.join("\n  ")}`,
    ).toEqual([]);
  });

  it("白名单不得腐化：已修复的缺口必须从 KNOWN_GAPS 删除", () => {
    for (const [dir, allowed] of Object.entries(KNOWN_GAPS)) {
      const actual = adapterGaps(dir);
      const fixed = allowed.filter((gap) => !actual.includes(gap));
      expect(
        fixed,
        `${dir} 的这些缺口已不存在，请从 KNOWN_GAPS 中删除：\n  ${fixed.join("\n  ")}`,
      ).toEqual([]);
    }
  });

  it("KNOWN_GAPS 只引用真实存在的适配器目录", () => {
    const dirs = adapterDirs();
    const unknown = Object.keys(KNOWN_GAPS).filter((d) => !dirs.includes(d));
    expect(unknown, `KNOWN_GAPS 里有不存在的适配器：${unknown.join(", ")}`).toEqual([]);
  });
});
