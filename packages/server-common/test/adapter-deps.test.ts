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
 * **一个出口**：适配器可以不走「声明依赖」而用 `setCustomLibs` 注入自实现，
 * 此时能力可用但依赖不必声明 —— 这类豁免记在 {@link OVERRIDE_SATISFIED}，并有守卫用例
 * 要求它真的成立（能力声明为 true + 源码里确实出现该包名的覆写键）。
 *
 * **为什么放在 `@twikoojs/common`**：能力 → 包的映射由本包 `src/utils/lib-loader.ts`
 * 定义，适配器只是消费者。本文件会读各适配器的 `package.json` 与 `src/`（跨包读取，
 * 与 `packages/demo/test` 的做法一致）。
 *
 * **为什么用 TypeScript 编译器 API 而不是正则**：映射表的正确性完全建立在「它准确镜像了
 * `lib-loader` 的调用点」之上，而正则只能匹配「恰好写成字面量」的调用 —— 一旦有人改成
 * `loadLib(specifier)` / `requireCapability(caps, cap, pkg)`，该调用就从结果集里消失，
 * 同步测试反而变绿。AST 能把「参数不是字面量」本身报出来（与
 * `test/utils/lib-loader-literals.test.ts` 同款处理）。
 *
 * `mongodb` / `lokijs` 不在此检查范围：它们不经 `lib-loader`，而由适配器注入的
 * `database` 端口自行选择（如 EO 用 `BlobKvDatabase`），不是「人人必备」。
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { FULL_CAPABILITIES } from "../src/ports/capabilities";

/** 仓库根（本文件位于 packages/server-common/test/） */
const REPO_ROOT = fileURLToPath(new URL("../../..", import.meta.url));

/** lib-loader 源文件路径（能力映射与加载清单的真相源） */
const LIB_LOADER_PATH = join(REPO_ROOT, "packages/server-common/src/utils/lib-loader.ts");

/**
 * 能力 → 该能力为 true 时适配器必须声明的包。
 *
 * **这是镜像，不是真相源**：每一行都必须能在 `lib-loader` 里找到对应的
 * `requireCapability(caps, "<能力>", "<包>")`，由下方同步用例强制核对 ——
 * 比对的是 **(能力, 包) 对**，不只是能力名，否则「能力名不变、包名换成别的」这种改动
 * 会悄悄溜过去，而适配器仍按旧包名声明依赖。
 *
 * `jsdom` 是 `domPurify` 的**伴随包**（DOMPurify 需要一个 window，见 `getDomPurify`），
 * 它没有独立的 `requireCapability` 调用，因此只出现在本表、不出现在门控调用点里 ——
 * 所以同步比对取「调用点 ⊆ 本表」的子集语义，而非相等。
 */
const CAPABILITY_PACKAGES: Record<string, string[]> = {
  mail: ["nodemailer"],
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
 *
 * **当前为空** —— #1127 的三条缺口都已修复：`form-data` / `pushoo` 补了声明，
 * `ip2region` 改为「由覆写满足」（见下方 {@link OVERRIDE_SATISFIED}）。
 * 机制保留，供下一个缺口使用。
 */
const KNOWN_GAPS: Record<string, string[]> = {};

/**
 * 由 `setCustomLibs` 覆写满足的能力（**不需要**在 `dependencies` 里声明对应包）。
 *
 * 适配器不一定走「声明依赖 → `lib-loader` 动态 import」这条路：它可以在启动时用
 * `setCustomLibs` 注入自实现 —— 覆写优先于能力门与动态加载（见 `getIpToRegion`）。
 * 这类适配器把该能力声明为 `true` 是**诚实**的：能力确实可用。
 *
 * 条目格式 `"<能力>=<包名>"`；下方有守卫用例，要求适配器源码里真的出现该包名的
 * 字符串字面量（即「确实注入了一个以该包名为键的覆写」），不允许只填一行表就蒙混过关。
 *
 * 目前仅 EO 的 ip2region：库靠 `fs` 随机读 8.33 MB 的 db，而 EO 的部署产物是 JS bundle，
 * 没有可读的兄弟数据文件 —— 声明依赖只会把 8.5 MB 装进去却仍然读不到 db。改为把 db
 * gzip+base64 内联成独立模块 + fs-free 内存查询器（见
 * `packages/server-edgeone-makers/src/ip2region/`，对照实验见该包 `test/ip2region.test.ts`）。
 */
const OVERRIDE_SATISFIED: Record<string, string[]> = {
  "server-edgeone-makers": ["ip2region=@imaegoo/node-ip2region"],
};

/** 已解析的 lib-loader AST（`setParentNodes` 打开，用于回溯所属函数） */
const LIB_LOADER_FILE = ts.createSourceFile(
  "lib-loader.ts",
  readFileSync(LIB_LOADER_PATH, "utf8"),
  ts.ScriptTarget.ES2022,
  /* setParentNodes */ true,
  ts.ScriptKind.TS,
);

/**
 * 深度优先遍历 AST。
 * @param node 起始节点
 * @param visit 访问回调
 */
function walk(node: ts.Node, visit: (node: ts.Node) => void): void {
  visit(node);
  node.forEachChild((child) => walk(child, visit));
}

/**
 * 取节点所在的最近函数节点。
 * @param node 起始节点
 * @returns 最近的函数节点；不在任何函数内时为 undefined
 */
function enclosingFunction(node: ts.Node): ts.Node | undefined {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (
      ts.isFunctionDeclaration(current) ||
      ts.isFunctionExpression(current) ||
      ts.isArrowFunction(current) ||
      ts.isMethodDeclaration(current)
    ) {
      return current;
    }
    current = current.parent;
  }
  return undefined;
}

/**
 * 取字符串字面量节点的值。
 * @param node 节点
 * @returns 字面量文本；非字符串字面量时为 undefined
 */
function literalText(node: ts.Node | undefined): string | undefined {
  if (node === undefined) return undefined;
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)
    ? node.text
    : undefined;
}

/**
 * 取节点所在行号（1 起）。
 * @param node 节点
 * @returns 行号
 */
function lineOf(node: ts.Node): number {
  return LIB_LOADER_FILE.getLineAndCharacterOfPosition(node.getStart(LIB_LOADER_FILE)).line + 1;
}

/** `loadLib("<包>")` 调用点 */
interface LoadLibCall {
  /** 包名；**首参不是字符串字面量时为 undefined** */
  specifier?: string;
  /** 源码行号 */
  line: number;
}

/** `requireCapability(caps, "<能力>", "<包>")` 调用点 */
interface CapabilityGate {
  /** 能力名；**不是字符串字面量时为 undefined** */
  capability?: string;
  /** 关联包名；**不是字符串字面量时为 undefined** */
  package?: string;
  /** 源码行号 */
  line: number;
  /** 所属函数节点 */
  fn?: ts.Node;
}

/**
 * 抽取 lib-loader 里所有 `loadLib(...)` 调用点。
 * @returns 调用点（按出现顺序）
 */
function loadLibCalls(): LoadLibCall[] {
  const calls: LoadLibCall[] = [];
  walk(LIB_LOADER_FILE, (node) => {
    if (!ts.isCallExpression(node)) return;
    if (!ts.isIdentifier(node.expression) || node.expression.text !== "loadLib") return;
    calls.push({ specifier: literalText(node.arguments[0]), line: lineOf(node) });
  });
  return calls;
}

/**
 * 抽取 lib-loader 里所有 `requireCapability(...)` 调用点（函数自身声明不算）。
 * @returns 调用点（按出现顺序）
 */
function capabilityGates(): CapabilityGate[] {
  const gates: CapabilityGate[] = [];
  walk(LIB_LOADER_FILE, (node) => {
    if (!ts.isCallExpression(node)) return;
    if (!ts.isIdentifier(node.expression) || node.expression.text !== "requireCapability") return;
    gates.push({
      capability: literalText(node.arguments[1]),
      package: literalText(node.arguments[2]),
      line: lineOf(node),
      fn: enclosingFunction(node),
    });
  });
  return gates;
}

/**
 * 所有 `loadLib("<包>")` 的包名。
 * @returns 包名（去重、按出现顺序）
 */
function loadLibPackages(): string[] {
  const found = loadLibCalls()
    .map((call) => call.specifier)
    .filter((specifier): specifier is string => specifier !== undefined);
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
 *
 * 「由覆写满足」的能力不计为缺口（见 {@link OVERRIDE_SATISFIED}）。
 * @param adapterDir 适配器目录名（packages/ 下）
 * @returns 缺口描述（空数组表示合规）
 */
function adapterGaps(adapterDir: string): string[] {
  const manifest = JSON.parse(
    readFileSync(join(REPO_ROOT, "packages", adapterDir, "package.json"), "utf8"),
  ) as { dependencies?: Record<string, string> };
  const deps = Object.keys(manifest.dependencies ?? []);
  const declared = declaredCapabilities(adapterDir);
  const overridden = new Set(OVERRIDE_SATISFIED[adapterDir] ?? []);

  const gaps: string[] = [];
  for (const [cap, pkgs] of Object.entries(CAPABILITY_PACKAGES)) {
    if (declared[cap] !== true) continue;
    for (const pkg of pkgs) {
      if (overridden.has(`${cap}=${pkg}`)) continue;
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
  it("抽取逻辑本身有效：解析到了 loadLib 与 requireCapability 调用点（防止静默抽空）", () => {
    expect(loadLibCalls().length, "一个 loadLib 调用点都没解析到").toBeGreaterThan(0);
    expect(capabilityGates().length, "一个 requireCapability 调用点都没解析到").toBeGreaterThan(0);
  });

  it("能力门的两个参数都是字符串字面量（变量会让映射表失去核对依据）", () => {
    const offenders = capabilityGates().filter(
      (gate) => gate.capability === undefined || gate.package === undefined,
    );
    expect(
      offenders.map((gate) => `第 ${gate.line} 行`),
      "以下 requireCapability 调用的能力名或包名不是字符串字面量，映射表将无法与源码核对",
    ).toEqual([]);
  });

  it("能力门控清单与 requireCapability 调用点一致", () => {
    const gated = [...new Set(capabilityGates().map((gate) => gate.capability))].filter(
      (capability): capability is string => capability !== undefined,
    );
    expect(Object.keys(CAPABILITY_PACKAGES).sort()).toEqual(gated.sort());
  });

  it("映射表里的包与该能力在 requireCapability 里声明的包一致（比对 (能力, 包) 对，不只是能力名）", () => {
    const mismatched = capabilityGates()
      .filter(
        (gate): gate is CapabilityGate & { capability: string; package: string } =>
          gate.capability !== undefined && gate.package !== undefined,
      )
      .filter((gate) => !(CAPABILITY_PACKAGES[gate.capability] ?? []).includes(gate.package))
      .map(
        (gate) =>
          `第 ${gate.line} 行 requireCapability(caps, "${gate.capability}", "${gate.package}")` +
          ` —— CAPABILITY_PACKAGES["${gate.capability}"] = [${(CAPABILITY_PACKAGES[gate.capability] ?? []).join(", ")}]`,
      );
    expect(
      mismatched,
      `以下能力门声明的包没在映射表里，适配器会按错误的包名声明依赖：\n  ${mismatched.join("\n  ")}`,
    ).toEqual([]);
  });

  it("每个能力门所在函数内确实 loadLib 了它声明的那个包（防止门控参数与实际加载脱节）", () => {
    const problems: string[] = [];
    for (const gate of capabilityGates()) {
      if (gate.capability === undefined || gate.package === undefined || gate.fn === undefined) {
        continue;
      }
      const loadedInFn = new Set<string>();
      walk(gate.fn, (node) => {
        if (!ts.isCallExpression(node)) return;
        if (!ts.isIdentifier(node.expression) || node.expression.text !== "loadLib") return;
        const specifier = literalText(node.arguments[0]);
        if (specifier !== undefined) loadedInFn.add(specifier);
      });
      if (!loadedInFn.has(gate.package)) {
        problems.push(
          `第 ${gate.line} 行声明了 "${gate.package}"，但同函数内只加载了 [${[...loadedInFn].join(", ")}]`,
        );
      }
    }
    expect(problems, `以下能力门的包名与实际加载不一致：\n  ${problems.join("\n  ")}`).toEqual([]);
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

  it("OVERRIDE_SATISFIED 只引用真实存在的适配器目录", () => {
    const dirs = adapterDirs();
    const unknown = Object.keys(OVERRIDE_SATISFIED).filter((d) => !dirs.includes(d));
    expect(unknown, `OVERRIDE_SATISFIED 里有不存在的适配器：${unknown.join(", ")}`).toEqual([]);
  });

  it("OVERRIDE_SATISFIED 的条目必须真的成立（能力声明为 true、且源码里确实注入了该包名的覆写）", () => {
    const problems: string[] = [];
    for (const [dir, entries] of Object.entries(OVERRIDE_SATISFIED)) {
      const declared = declaredCapabilities(dir);
      const source = readTsSources(join(REPO_ROOT, "packages", dir, "src"));
      for (const entry of entries) {
        const [cap, pkg] = entry.split("=");
        if (!cap || !pkg) {
          problems.push(`${dir}: 条目格式应为 "<能力>=<包名>"，实为 "${entry}"`);
          continue;
        }
        if (declared[cap] !== true) {
          problems.push(`${dir}: 声明豁免 "${entry}"，但该适配器并未把 ${cap} 声明为 true`);
        }
        if (!CAPABILITY_PACKAGES[cap]?.includes(pkg)) {
          problems.push(`${dir}: 条目 "${entry}" 的能力与包不匹配（映射表里没有这一对）`);
        }
        // 关键守卫：源码里必须出现该包名的字符串字面量 ——
        // 即「确实以它为键注入了覆写」，而不是只在测试里填一行表把检查静音
        if (!source.includes(`"${pkg}"`) && !source.includes(`'${pkg}'`)) {
          problems.push(
            `${dir}: 声明豁免 "${entry}"，但 src/ 下找不到 "${pkg}" 这个键 —— 请确认确实经 setCustomLibs 注入了覆写`,
          );
        }
      }
    }
    expect(
      problems,
      `OVERRIDE_SATISFIED 里以下条目不成立（不能只填表就跳过依赖检查）：\n  ${problems.join("\n  ")}`,
    ).toEqual([]);
  });
});

describe("jsdom 必须钉在 CJS 安全版本", () => {
  /**
   * jsdom 26+ 的依赖树里有 ESM-only 的包（parse5@8、html-encoding-sniffer@5+ → @exodus/bytes），
   * 在 Node <20.19（不支持 require(esm)）的平台上会直接 ERR_REQUIRE_ESM。
   *
   * 25.0.1 是最后一个 CJS 安全的 jsdom 大版本（parse5@7 双格式、html-encoding-sniffer@4 →
   * whatwg-encoding@3 → iconv-lite，engines >=18）。
   *
   * 本测试强制所有声明 jsdom 的适配器把版本钉在 `~25.`，防止有人不小心把范围放宽到 26+
   * 导致生产环境炸掉。如果将来 Node 运行时普遍支持 require(esm)（>=20.19 / >=22.12），
   * 可以放宽到 `~27.` 或更高，但必须同步更新本测试的断言。
   */
  const JSDOM_PIN_REGEX = /^~25\./;

  it("所有声明 jsdom 的适配器必须把版本钉在 ~25.x（CJS 安全）", () => {
    const adapters = readdirSync(join(REPO_ROOT, "packages"))
      .filter((d) => d.startsWith("server-") || d === "pkg" || d === "client")
      .filter((d) => existsSync(join(REPO_ROOT, "packages", d, "package.json")));

    const problems: string[] = [];
    for (const dir of adapters) {
      const pjPath = join(REPO_ROOT, "packages", dir, "package.json");
      const pj = JSON.parse(readFileSync(pjPath, "utf8"));
      const range = pj.dependencies?.jsdom || pj.devDependencies?.jsdom;
      if (!range) continue; // 该包不声明 jsdom（如 EO 适配器 domPurify=false）
      if (!JSDOM_PIN_REGEX.test(range)) {
        problems.push(`${dir}: jsdom 范围 "${range}" 不符合 ${JSDOM_PIN_REGEX}（必须钉在 ~25.x）`);
      }
    }
    expect(
      problems,
      `以下适配器的 jsdom 范围不在 CJS 安全区间（parse5@8 / html-encoding-sniffer@5+ 为 ESM-only，\n` +
        `在 Node <20.19 上 require 链会直接 ERR_REQUIRE_ESM）：\n  ${problems.join("\n  ")}`,
    ).toEqual([]);
  });

  it("@twikoojs/common 的 optional peer 必须放行 ^25（否则适配器钉 25 会被 peer 冲突拖红）", () => {
    const pj = JSON.parse(readFileSync(join(REPO_ROOT, "packages/server-common/package.json"), "utf8"));
    const peer = pj.peerDependencies?.jsdom;
    expect(peer, "common 必须声明 jsdom 为 optional peer").toBeDefined();
    expect(peer, "common 的 jsdom peer 必须包含 ^25（否则适配器钉 ~25 会被 peer 冲突拖红）").toMatch(/\^25/);
  });
});
