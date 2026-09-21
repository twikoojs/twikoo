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
 *
 * **为什么用 TypeScript 编译器 API 而不是正则**：正则只能匹配「恰好写成字面量」的调用，
 * 于是**最该被拦住的那种写法**（`loadLib(specifier)`）反而从结果集里消失 —— 测试全绿，
 * 却漏掉了唯一要防的问题。AST 则能把「调用点的参数**不是**字面量」本身报出来，
 * 且天然不受注释、字符串里的 `loadLib(...)` 干扰。
 */
import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { LITERAL_LOADERS } from "../../src/utils/lib-loader";

/** 被检源文件（调用点与字面量表都在这一个文件里） */
const SOURCE = readFileSync(new URL("../../src/utils/lib-loader.ts", import.meta.url), "utf8");

/** 已解析的源文件 AST（`setParentNodes` 打开，便于按需回溯父节点） */
const SOURCE_FILE = ts.createSourceFile(
  "lib-loader.ts",
  SOURCE,
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
 * 调用表达式是否是在调 `loadLib`（只认裸标识符，`loadLib` 是本文件的模块内函数）。
 * @param node 调用表达式
 * @returns 是否命中
 */
function isLoadLibCall(node: ts.CallExpression): boolean {
  return ts.isIdentifier(node.expression) && node.expression.text === "loadLib";
}

/** `loadLib(...)` 调用点 */
interface LoadLibCall {
  /** specifier 字面量的值；**首参不是字符串字面量时为 undefined** */
  specifier?: string;
  /** 源码行号（1 起，用于报错定位） */
  line: number;
}

/**
 * 抽取源码里所有 `loadLib(...)` 调用点。
 *
 * 与旧正则的差别：**非字面量调用也会被收进来**（`specifier` 为 undefined），
 * 因此它们能被单独断言出来，而不是从结果集里悄悄消失。
 * @returns 调用点（按出现顺序）
 */
function loadLibCalls(): LoadLibCall[] {
  const calls: LoadLibCall[] = [];
  walk(SOURCE_FILE, (node) => {
    if (!ts.isCallExpression(node) || !isLoadLibCall(node)) return;
    const [arg] = node.arguments;
    const isLiteral =
      arg !== undefined && (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg));
    calls.push({
      specifier: isLiteral ? (arg as ts.StringLiteralLike).text : undefined,
      line: SOURCE_FILE.getLineAndCharacterOfPosition(node.getStart(SOURCE_FILE)).line + 1,
    });
  });
  return calls;
}

/**
 * 抽取源码里所有 `loadLib` 调用点的 specifier（仅字面量）。
 * @returns 包名（去重、按出现顺序）
 */
function loadLibSpecifiers(): string[] {
  const found = loadLibCalls()
    .map((call) => call.specifier)
    .filter((specifier): specifier is string => specifier !== undefined);
  return [...new Set(found)];
}

describe("重依赖字面量加载表纪律", () => {
  it("抽取逻辑本身有效：确实读到了 loadLib 调用点（防止静默抽空）", () => {
    expect(loadLibCalls().length, "一个 loadLib 调用点都没解析到，说明 AST 抽取逻辑失效了").toBeGreaterThan(
      0,
    );
  });

  it("每个 loadLib 调用点的 specifier 都是字符串字面量（变量会让静态追踪器解析不到）", () => {
    const offenders = loadLibCalls().filter((call) => call.specifier === undefined);
    expect(
      offenders.map((call) => `第 ${call.line} 行`),
      "以下 loadLib 调用点的 specifier 不是字符串字面量，静态追踪器将解析不到该依赖；" +
        "请改为 loadLib(\"包名\")，并在 LITERAL_LOADERS 里补上对应字面量",
    ).toEqual([]);
  });

  it("每个 loadLib 调用点都在字面量表里（否则该依赖不会被静态追踪，运行时报缺依赖）", () => {
    const missing = loadLibSpecifiers().filter(
      (specifier) => !Object.prototype.hasOwnProperty.call(LITERAL_LOADERS, specifier),
    );
    expect(missing, `以下包缺字面量加载项，静态追踪器将解析不到：${missing.join(", ")}`).toEqual(
      [],
    );
  });

  it("字面量表里没有孤儿项（已不再调用的依赖应一并删除，避免误导后来者）", () => {
    const callSites = loadLibSpecifiers();
    const orphans = Object.keys(LITERAL_LOADERS).filter((k) => !callSites.includes(k));
    expect(orphans, `以下字面量表项已无调用点：${orphans.join(", ")}`).toEqual([]);
  });

  it("重依赖不得出现在顶层静态 import（保持「顶层零重依赖」，只经 thunk 惰性加载）", () => {
    const topLevelStatic = SOURCE_FILE.statements
      .filter(ts.isImportDeclaration)
      .map((decl) => (ts.isStringLiteral(decl.moduleSpecifier) ? decl.moduleSpecifier.text : ""));
    const leaked = topLevelStatic.filter((s) =>
      Object.prototype.hasOwnProperty.call(LITERAL_LOADERS, s),
    );
    expect(leaked, `以下重依赖被顶层静态 import 了：${leaked.join(", ")}`).toEqual([]);
  });
});
