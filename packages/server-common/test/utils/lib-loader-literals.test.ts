/**
 * 重依赖「字面量加载表」纪律测试（防回归）。
 *
 * **为什么需要**：`loadLib` 的 specifier 一旦不是字面量，任何**静态分析型**的
 * 打包/追踪器（Vercel 的 `@vercel/nft`、SEA 单文件打包、rolldown 的依赖内联）
 * 都解析不到具体包，依赖就不会进产物，运行时才报 `LibLoadError`。同一个坑已经踩了两次：
 * SEA（`packages/pkg/src/bundled-libs.ts` 的成因）与 Vercel（#1116）。
 *
 * 本测试把「每个 `loadLib` 调用点都在 {@link LITERAL_LOADERS} 里有对应字面量」变成
 * 可执行约束：漏加一行 → 这里红，而不是等用户在某个平台上遇到缺依赖。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LITERAL_LOADERS } from "../../src/utils/lib-loader";

/** 被检源文件（调用点与字面量表都在这一个文件里） */
const SOURCE = readFileSync(new URL("../../src/utils/lib-loader.ts", import.meta.url), "utf8");

/**
 * 抽取源码里所有 `loadLib("<specifier>")` 的 specifier。
 * @returns 调用点包名（去重、按出现顺序）
 */
function loadLibCallSites(): string[] {
  const found = [...SOURCE.matchAll(/\bloadLib\("([^"]+)"\)/g)].map((m) => m[1]);
  return [...new Set(found)];
}

describe("重依赖字面量加载表纪律", () => {
  it("每个 loadLib 调用点都在字面量表里（否则该依赖不会被静态追踪，运行时报缺依赖）", () => {
    const missing = loadLibCallSites().filter(
      (specifier) => !Object.prototype.hasOwnProperty.call(LITERAL_LOADERS, specifier),
    );
    expect(missing, `以下包缺字面量加载项，静态追踪器将解析不到：${missing.join(", ")}`).toEqual(
      [],
    );
  });

  it("字面量表里没有孤儿项（已不再调用的依赖应一并删除，避免误导后来者）", () => {
    const callSites = loadLibCallSites();
    const orphans = Object.keys(LITERAL_LOADERS).filter((k) => !callSites.includes(k));
    expect(orphans, `以下字面量表项已无调用点：${orphans.join(", ")}`).toEqual([]);
  });

  it("重依赖不得出现在顶层静态 import（保持「顶层零重依赖」，只经 thunk 惰性加载）", () => {
    const topLevelStatic = [...SOURCE.matchAll(/^import[\s\S]*?from\s+"([^"]+)";/gm)].map(
      (m) => m[1],
    );
    const leaked = topLevelStatic.filter((s) =>
      Object.prototype.hasOwnProperty.call(LITERAL_LOADERS, s),
    );
    expect(leaked, `以下重依赖被顶层静态 import 了：${leaked.join(", ")}`).toEqual([]);
  });
});
