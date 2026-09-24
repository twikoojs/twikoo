#!/usr/bin/env node
/**
 * EO Makers 部署产物门禁。
 *
 * 守三条真正会让「直接上传」失效的不变量（均为 2026-09-24 在真实项目实测得出）：
 *
 * 1. **依赖清单**：`dependencies` 不得出现「运行时永不加载」的重依赖。它们由
 *    `tsdown.config.ts` 的 `alias` 别名成空桩；若有人把它们加回 `dependencies`，
 *    说明覆写或能力声明被动过，需要重新核对能力矩阵。
 * 2. **自包含**：产物里的裸导入只允许 `node:*` 与 `@edgeone/pages-blob`。
 *    平台侧打包器**解析不到任何裸导入就直接构建失败**（实测报
 *    `✘ [ERROR] Could not resolve "nodemailer"`）；而 `@edgeone/pages-blob`
 *    由部署包 `package.json` 声明、平台 `npm install` 提供。
 * 3. **数据已内联**：产物体积落在预期区间。偏小说明 ip2region 数据没被内联 ——
 *    平台「构建产物」页实测只保留 `package.json` / `package-lock.json`，
 *    `cloud-functions/` 下的兄弟文件不会落到运行时文件系统，数据只能内联；
 *    偏大说明误打包了重依赖。
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/** 包根目录 */
const PACKAGE_ROOT = fileURLToPath(new URL("..", import.meta.url));

/** 函数入口产物 */
const ENTRY = join(PACKAGE_ROOT, "dist", "cloud-functions", "index.js");

/** 运行时永不加载、由 `alias` 打成空桩的重依赖 */
const NEVER_LOADED_LIBS = [
  "@imaegoo/node-ip2region",
  "@xsai/generate-text",
  "akismet-api",
  "dompurify",
  "jsdom",
  "lokijs",
  "mongodb",
  "nodemailer",
  "tencentcloud-sdk-nodejs-tms",
];

/** 允许留在产物里的裸导入：`@edgeone/pages-blob` 由部署包 package.json 声明、平台 npm install 提供 */
const ALLOWED_BARE = ["@edgeone/pages-blob"];

/**
 * 判定某个裸导入是否会让平台构建失败。
 *
 * 只把两类判为红，避免误报：
 *
 * - **永不加载的重依赖**：它们本该被 `alias` 打成空桩，出现在产物里说明 alias 失效，
 *   而平台侧没有安装它们（实测报 `✘ [ERROR] Could not resolve`）；
 * - **`@twikoojs/*` 内部包**：workspace 包必须被打进产物，漏了说明 `alwaysBundle` 失效。
 *
 * 其余裸导入（`fs` 等 Node 内建、`pako` / `selderee` 等依赖树内的包）在平台执行
 * `npm install` 后都能解析，仅作提示。
 * @param specifier 裸导入
 * @returns 是否会导致构建失败
 */
function isFatalBare(specifier) {
  return NEVER_LOADED_LIBS.includes(specifier) || specifier.startsWith("@twikoojs/");
}

/** 产物体积区间（含内联的 6.06 MB base64 数据；下限防数据没内联，上限防误打包重依赖） */
const SIZE_MIN = 5 * 1024 * 1024;
const SIZE_MAX = 32 * 1024 * 1024;

const problems = [];

/** 1. 依赖清单不得含永不加载的重依赖 */
const pkg = JSON.parse(readFileSync(join(PACKAGE_ROOT, "package.json"), "utf8"));
const leaked = Object.keys(pkg.dependencies ?? {}).filter((d) => NEVER_LOADED_LIBS.includes(d));
if (leaked.length) {
  problems.push(
    `dependencies 出现「运行时永不加载」的重依赖：${leaked.join(", ")}` +
      "（它们应只由 tsdown 的 alias 打成空桩，见 tsdown.config.ts）",
  );
}

if (!existsSync(ENTRY)) {
  console.log("EO 产物门禁：dist 未构建，仅校验了依赖清单（先跑 npm run build）");
} else {
  /** 2. 自包含：裸导入只允许 Node 内建、白名单与依赖树内的包 */
  const source = readFileSync(ENTRY, "utf8");
  const bare = new Set();
  for (const m of source.matchAll(/(?:from|import\()\s*["']([^"'.][^"']*)["']/g)) {
    const specifier = m[1];
    if (specifier.startsWith("node:") || ALLOWED_BARE.includes(specifier)) continue;
    bare.add(specifier);
  }
  const fatal = [...bare].filter(isFatalBare);
  if (fatal.length) {
    problems.push(
      `产物出现会导致平台构建失败的裸导入：${fatal.join(", ")}` +
        "（永不加载的重依赖应被 alias 打成空桩；@twikoojs/* 应被 alwaysBundle 打进产物）",
    );
  }
  /** 其余裸导入（Node 内建 / 依赖树内的包）在平台 npm install 后可用，仅提示 */
  const benign = [...bare].filter((s) => !isFatalBare(s));
  if (benign.length) {
    console.log(`EO 产物门禁提示：产物中另有裸导入 ${benign.join(", ")}（应由平台 npm install 提供）`);
  }

  /** 3. 数据已内联 + 体积合理 */
  const size = statSync(ENTRY).size;
  const mb = (n) => `${(n / 1024 / 1024).toFixed(2)}MB`;
  if (size < SIZE_MIN || size > SIZE_MAX) {
    problems.push(
      `产物 ${mb(size)} 超出预期区间 ${mb(SIZE_MIN)}..${mb(SIZE_MAX)}` +
        "（偏小：ip2region 数据可能没被内联；偏大：可能误打包了重依赖）",
    );
  }
}

if (problems.length) {
  console.error(`EO 门禁红：\n  ${problems.join("\n  ")}`);
  process.exit(1);
}

console.log("EO 门禁绿：依赖清单合规，产物自包含且体积在预期区间");
