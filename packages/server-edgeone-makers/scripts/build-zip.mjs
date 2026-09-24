#!/usr/bin/env node
/**
 * 生成 EdgeOne Makers 一键部署 ZIP 模板（**最小部署包**）。
 *
 * **设计**：部署包只声明依赖，实现全部来自 npm 上的 `@twikoojs/edgeone-makers`。
 *
 * ```
 * twikoo-edgeone-makers.zip
 * ├── cloud-functions/index.js   # 一行转发
 * └── package.json               # 只声明 @twikoojs/edgeone-makers: latest
 * ```
 *
 * 这么做成立的前提是两条**实测确认**的平台行为（2026-09-24，真实项目）：
 *
 * 1. 部署包含 `package.json` 且声明了依赖时，平台会执行 `npm install`
 *    （构建日志：`[builder] InstallCommand: npm install` / `changed 1 package`）；
 * 2. 平台的函数构建会用打包器把函数打成**单文件**，能解析到的 `node_modules` 依赖会被
 *    内联进去（构建日志：`[cli] ✨ Node functions build completed successfully`）。
 *
 * 好处：部署包 ~1 KB；实现随 npm 发版更新，用户**重新部署**即可拿到新版，无需重新上传；
 * 不必把 6 MB 的 IP 属地数据塞进 ZIP。
 *
 * **为什么数据必须内联进函数单文件**：平台「构建产物」页实测只保留
 * `package.json` / `package-lock.json` —— `cloud-functions/` 下的非入口文件不会落到运行时
 * 文件系统（函数运行时路径是 `/var/user/index.mjs`）。所以 `generated/` 之类的兄弟文件
 * 在平台上取不到，数据必须由打包器内联（见 `src/ip2region/inline.ts` 的字面量 specifier）。
 *
 * **刻意不放的东西**：
 *
 * - `index.html`：静态资源与函数路由冲突时**静态资源优先**（实测），根目录放 `index.html`
 *   会让 `/` 返回 HTML 而不是函数，Twikoo 的 envId 就失效了；
 * - 任何源码或构建配置：平台侧只认 `cloud-functions/` 下已就绪的入口。
 */
import { deflateRawSync } from "node:zlib";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

/** 包根目录 */
const PACKAGE_ROOT = fileURLToPath(new URL("..", import.meta.url));

/** 仓库根目录（本脚本位于 packages/server-edgeone-makers/scripts/） */
const REPO_ROOT = join(PACKAGE_ROOT, "..", "..");

/** ZIP 输出目录（与其它一键部署模板同级） */
const TEMPLATE_DIR = join(REPO_ROOT, "templates", "edgeone-makers");

/** ZIP 文件名（教程中让用户下载的就是它） */
const ZIP_NAME = "twikoo-edgeone-makers.zip";

/** 部署包入口：一行转发到发布包 */
const ENTRY_SOURCE = `/**
 * Twikoo EdgeOne Makers 函数入口。
 *
 * 平台按 cloud-functions/ 目录生成路由，本文件映射到 PATH: /。
 * 实现全部来自 npm 上的 @twikoojs/edgeone-makers（平台会 npm install 并内联进函数单文件），
 * 因此升级 Twikoo 只需在本项目点「重新部署」，无需重新上传部署包。
 */
export { onRequest, onRequest as default } from "@twikoojs/edgeone-makers";
`;

/** 部署包 package.json：依赖写 latest，跟随 npm 稳定通道 */
const DEPLOY_PACKAGE_JSON = {
  name: "twikoo-edgeone-makers-deploy",
  version: "0.0.0",
  private: true,
  type: "module",
  dependencies: { "@twikoojs/edgeone-makers": "latest" },
};

/**
 * 计算 CRC32（ZIP 局部文件头与中央目录都需要）。
 * @param buf 字节
 * @returns CRC32 无符号整数
 */
function crc32(buf) {
  /** 预计算表（惰性建一次） */
  crc32.table ??= (() => {
    const table = new Int32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[i] = c;
    }
    return table;
  })();
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ crc32.table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

/**
 * 把一批文件写成一个 ZIP。
 *
 * 手写而非引第三方库：只需要「store + deflate」这一小片 ZIP 规范，加一个依赖不划算。
 * 单个文件都远小于 4 GB，因此不需要 ZIP64。
 * @param entries 条目（相对路径 → 内容）
 * @returns ZIP 字节
 */
function buildZip(entries) {
  /** 局部文件头 + 数据 的累积块 */
  const localParts = [];
  /** 中央目录记录 */
  const centralParts = [];
  let offset = 0;

  for (const [name, content] of entries) {
    const nameBytes = Buffer.from(name, "utf8");
    const crc = crc32(content);
    const deflated = deflateRawSync(content, { level: 9 });
    // 压缩没收益时用 store
    const useDeflate = deflated.length < content.length;
    const payload = useDeflate ? deflated : content;
    const method = useDeflate ? 8 : 0;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(payload.length, 18);
    local.writeUInt32LE(content.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, nameBytes, payload);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(payload.length, 20);
    central.writeUInt32LE(content.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, nameBytes);

    offset += local.length + nameBytes.length + payload.length;
  }

  const centralBuf = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([Buffer.concat(localParts), centralBuf, end]);
}

/** 主流程：校验构建产物 → 组装最小部署包 → 写 ZIP 与说明 */
function main() {
  const entryFile = join(PACKAGE_ROOT, "dist", "cloud-functions", "index.js");
  if (!existsSync(entryFile)) {
    console.error(`✗ 未找到 ${entryFile}；请先执行 npm run build（本脚本是其最后一步）`);
    process.exit(1);
  }

  const entries = [
    ["cloud-functions/index.js", Buffer.from(ENTRY_SOURCE, "utf8")],
    ["package.json", Buffer.from(`${JSON.stringify(DEPLOY_PACKAGE_JSON, null, 2)}\n`, "utf8")],
  ];

  const zip = buildZip(entries);
  mkdirSync(TEMPLATE_DIR, { recursive: true });
  const outPath = join(TEMPLATE_DIR, ZIP_NAME);
  rmSync(outPath, { force: true });
  writeFileSync(outPath, zip);

  /** 模板目录说明（写进 README，便于人工核对） */
  writeFileSync(
    join(TEMPLATE_DIR, "README.md"),
    [
      "# twikoo-edgeone-makers 一键部署模板",
      "",
      `由 \`packages/server-edgeone-makers/scripts/build-zip.mjs\` 生成，请勿手工修改 ${ZIP_NAME}。`,
      "",
      "在 EdgeOne Makers 控制台「创建项目 → 直接上传」时上传该 ZIP 即可创建云函数。",
      "详细步骤见文档站「云函数部署 → EdgeOne Makers 部署」。",
      "",
      "## ZIP 内容",
      "",
      "| 路径 | 作用 |",
      "| --- | --- |",
      "| `cloud-functions/index.js` | 一行转发到 `@twikoojs/edgeone-makers`，映射到域名根路径 `/` |",
      "| `package.json` | 声明 `@twikoojs/edgeone-makers: latest`，平台据此 `npm install` |",
      "",
      "## 为什么这么小",
      "",
      "平台会执行 `npm install` 并把函数打成单文件，因此实现不必塞进 ZIP。",
      "依赖写 `latest`：升级 Twikoo 只需在项目里点「重新部署」，无需重新上传部署包。",
      "",
      "## 为什么不含 index.html",
      "",
      "静态资源与函数路由冲突时静态资源优先，根目录出现 `index.html` 会让 `/` 返回 HTML，",
      "Twikoo 的 envId 随即失效。",
      "",
    ].join("\n"),
    "utf8",
  );

  console.log(`✓ 已生成 ${relative(REPO_ROOT, outPath)}`);
  console.log(`  条目 ${entries.length} 个，体积 ${zip.length} 字节`);
  for (const [name, content] of entries) {
    console.log(`  ${name}  ${content.length} 字节`);
  }
}

main();
