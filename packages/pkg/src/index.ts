/**
 * `twikoo-pkg` CLI 入口（1.x `src/server/pkg/index.js` 的 TypeScript 移植）。
 *
 * 产物形态：Node SEA（Single Executable Application）单文件可执行程序，
 * 内置 tkserver 及其全部依赖；首次启动时把内置的 `.env`（Windows 另加 `web.config`）
 * 释放到可执行文件同目录，方便用户直接编辑配置。
 *
 * 与 1.x 的差异：1.x 用 `require('tkserver')` 直接启动（当时 tkserver 的 main 即服务入口），
 * 2.0 的 tkserver 是纯库（main 为 index，bin 为 server.js），故改为显式调用
 * `startTkserver()`；其余行为（.env 覆盖语义、IIS/ASPNETCORE_PORT 映射、SEA 资源释放）逐条对齐。
 *
 * **重依赖内联**：SEA 单文件产物没有 `node_modules`，而 `@twikoojs/common` 的重依赖是
 * 变量间接的动态加载——因此必须先经 {@link installBundledLibs} 把静态内联的
 * 模块命名空间注入 common 的库加载器，再启动服务。原因与维护约定见 `./bundled-libs.ts`。
 *
 * **CLI 元信息不得运行时读文件**（修复）：1.x 用 `require("../package.json")`，该写法会被
 * 打包器**内联**；2.0 曾改写成运行时的 `readFileSync(join(appDir, "package.json"))`，
 * 而 SEA 产物目录里没有 `package.json` → 可执行文件一启动就 ENOENT 崩溃（连 `.env` 释放都到不了）。
 * 现改为取 `@twikoojs/shared` 的 {@link VERSION}（构建期注入，与 `GET_FUNC_VERSION` 同源）。
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getAsset, getAssetKeys, isSea } from "node:sea";
import { program } from "commander";
import { startTkserver } from "tkserver";
import { VERSION } from "@twikoojs/shared";
import { installBundledLibs } from "./bundled-libs";

/** 内置的 SEA 资源清单（与 tsdown.config.mts 的 seaConfig.assets 保持一致） */
const SEA_ASSETS = [".env", "web.config"] as const;

/** CLI 名称（常量：见文件头「CLI 元信息不得运行时读文件」） */
const CLI_NAME = "twikoo-pkg";

/** 可执行文件所在目录 */
const appDir = __dirname;

/**
 * 从 SEA 内置资源释放文件到目标路径。
 * 释放失败（如 exe 位于只读目录）只报告错误，不终止启动。
 * @param assetPath 资源名
 * @param targetPath 释放目标路径
 */
function extractAsset(assetPath: string, targetPath: string): void {
  if (!isSea() || !getAssetKeys().includes(assetPath) || existsSync(targetPath)) return;
  try {
    writeFileSync(targetPath, getAsset(assetPath, "utf8"));
  } catch (e) {
    console.error(`Failed to extract ${assetPath} to ${targetPath}:`, (e as Error).message);
  }
}

/**
 * 解析 .env 并**覆盖**到 process.env（保持 1.x `dotenv override: true` 语义，
 * 因为 `process.loadEnvFile` 不覆盖已有变量）。仅支持 KEY=VALUE / 注释 / 引号格式。
 * @param envFile .env 文件路径
 */
function loadEnvFile(envFile: string): void {
  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) process.env[key] = value;
  }
}

/** CLI 元信息（版本号 = `@twikoojs/shared` 的构建期注入值，与 GET_FUNC_VERSION 同源） */
program
  .name(CLI_NAME)
  .version(VERSION, "-v, --version")
  .description(
    `DESCRIPTION:
  Official website: https://twikoo.js.org/`,
  )
  .helpCommand(false)
  .parse(process.argv);

/** 释放内置资源（.env 全平台；web.config 仅 Windows/IIS 需要） */
for (const asset of SEA_ASSETS) {
  if (asset === "web.config" && process.platform !== "win32") continue;
  extractAsset(asset, join(appDir, asset));
}

/** .env 存在则加载（其中取值覆盖已有环境变量） */
const envPath = join(appDir, ".env");
if (existsSync(envPath)) {
  try {
    loadEnvFile(envPath);
  } catch (e) {
    console.error(`Failed to load ${envPath}:`, (e as Error).message);
  }
}

/** 匹配 IIS：ASPNETCORE_PORT 由 IIS/ASP.NET Core Module 注入 */
if (process.env.ASPNETCORE_PORT) {
  process.env.TWIKOO_PORT = process.env.ASPNETCORE_PORT;
  delete process.env.TWIKOO_LOCALHOST_ONLY;
}

/** 注入已内联的重依赖（必须先于启动：handler 首次加载依赖时即取这条通道） */
installBundledLibs();

/** 启动 tkserver（CJS 产物不支持顶层 await，故用显式 catch 而非 await） */
startTkserver().catch((e: unknown) => {
  console.error("[twikoo] 启动失败：", e);
  process.exitCode = 1;
});
