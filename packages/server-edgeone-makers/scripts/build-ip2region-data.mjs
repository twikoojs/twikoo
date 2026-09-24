#!/usr/bin/env node
/**
 * 生成 EO Makers 的 ip2region 内联数据模块。
 *
 * **为什么需要**：`@imaegoo/node-ip2region` 靠 `fs` 随机读 8.33 MB 的 `data/ip2region.db`，
 * 而 EO Makers 的部署产物是 JS bundle，没有可读的兄弟数据文件。1.x 的做法是把 db
 * gzip + base64 内联成一个模块（`cloud-functions/ip2region-data.js`，由 `build.cjs` 的
 * 「步骤 0」在 `postinstall` 里生成），运行时用 `pako` 解压 —— 本脚本是它的 2.0 版：
 * 产出 `src/ip2region/generated/ip2region-data.js`，由 tsdown 按 `inline.ts` 的**字面量**
 * specifier 静态追踪、内联进函数单文件。
 *
 * **注意顺序**：本脚本必须在 tsdown **之前**跑（见 package.json 的 `build`），否则内联时
 * 解析不到该模块。
 *
 * **产物不进 git**（见包内 `.gitignore`）；类型由同目录**入库**的 `ip2region-data.d.ts` 承担，
 * 因此生成物缺失时 `tsc --noEmit` 仍能通过，只是运行时注入会被跳过（见 `inline.ts`）。
 *
 * 用法：
 *   node scripts/build-ip2region-data.mjs          # 生成（已是最新则跳过）
 *   node scripts/build-ip2region-data.mjs --force  # 强制重新生成
 *   node scripts/build-ip2region-data.mjs --check   # 只校验生成物可用（CI/部署前自检）
 */
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync, gunzipSync } from "node:zlib";

const require_ = createRequire(import.meta.url);
const PACKAGE_ROOT = fileURLToPath(new URL("..", import.meta.url));

/** 数据模块的落点（`src/ip2region/inline.ts` 按**字面量**相对 specifier 静态引入它，由打包器内联） */
const SOURCE_OUTPUT = join(PACKAGE_ROOT, "src/ip2region/generated/ip2region-data.js");

/** gzip 压缩级别（1.x 用的也是最高级；db 已高度可压缩，级别影响很小） */
const GZIP_LEVEL = 9;

const args = new Set(process.argv.slice(2));
const force = args.has("--force");
const checkOnly = args.has("--check");

const mb = (n) => `${(n / 1024 / 1024).toFixed(2)} MB`;

/**
 * 解析 `@imaegoo/node-ip2region` 的 db 路径。
 * @returns db 绝对路径
 */
function resolveDbPath() {
  try {
    return require_.resolve("@imaegoo/node-ip2region/data/ip2region.db");
  } catch {
    console.error(
      "✗ 找不到 @imaegoo/node-ip2region 的 ip2region.db。\n" +
        "  它是本包的 devDependency（仅构建期用来取 .db），请先执行 pnpm install。",
    );
    process.exit(1);
  }
}

/**
 * 生成数据模块源码。
 * @param base64 db 的 gzip+base64 内容
 * @param info 体积与摘要信息（写进文件头，便于排障且保持可复现）
 * @returns ESM 源码
 */
function renderModule(base64, info) {
  return `/**
 * ip2region.db 数据（gzip 压缩 + base64 内联）
 *
 * **自动生成，请勿手动修改** —— 由 \`scripts/build-ip2region-data.mjs\` 产出，不进 git。
 * 解压用 pako（纯 JS，不依赖 Node zlib），与 1.x 的实现一致。
 *
 * 原始大小 ${mb(info.rawSize)} / 压缩后 ${mb(info.gzipSize)} / base64 ${mb(info.base64Size)}
 * db sha256 ${info.sha256}
 */
import { ungzip } from "pako";

/** db 的 gzip+base64 内容 */
const IP2REGION_DATA_BASE64 = "${base64}";

/** 解压后的 db Buffer 缓存（进程级，避免重复解压 8.33 MB） */
let cachedBuffer = null;

/**
 * 取得（并缓存）解压后的 db Buffer。
 * @returns {Buffer} ip2region.db 内容
 */
export function getIp2RegionBuffer() {
  if (cachedBuffer === null) {
    // atob 得到二进制字符串 → Uint8Array → pako 解压 → Buffer
    const binary = atob(IP2REGION_DATA_BASE64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    cachedBuffer = Buffer.from(ungzip(bytes));
  }
  return cachedBuffer;
}

export default getIp2RegionBuffer;
`;
}

/**
 * 生成（或跳过）数据模块，并同步到 dist。
 * @returns 生成物路径
 */
function build() {
  const dbPath = resolveDbPath();
  const dbStat = statSync(dbPath);

  // 增量：生成物比 db 新就跳过（--force 可强制重来）
  if (!force && existsSync(SOURCE_OUTPUT) && statSync(SOURCE_OUTPUT).mtimeMs >= dbStat.mtimeMs) {
    console.log(`= ip2region 数据已是最新，跳过生成（${mb(dbStat.size)} 的 db）`);
    return SOURCE_OUTPUT;
  }

  const raw = readFileSync(dbPath);
  const gzip = gzipSync(raw, { level: GZIP_LEVEL });
  const base64 = gzip.toString("base64");
  const info = {
    rawSize: raw.length,
    gzipSize: gzip.length,
    base64Size: Buffer.byteLength(base64),
    sha256: createHash("sha256").update(raw).digest("hex").slice(0, 16),
  };

  mkdirSync(dirname(SOURCE_OUTPUT), { recursive: true });
  writeFileSync(SOURCE_OUTPUT, renderModule(base64, info));
  console.log(
    `✓ 已生成 ${SOURCE_OUTPUT.replace(`${PACKAGE_ROOT}/`, "")}\n` +
      `  db ${mb(info.rawSize)} → gzip ${mb(info.gzipSize)} → base64 ${mb(info.base64Size)}` +
      `（sha256 ${info.sha256}）`,
  );
  return SOURCE_OUTPUT;
}

/**
 * 校验生成物可用：存在、格式正确、能解压出合法的 db 头部。
 */
function check() {
  if (!existsSync(SOURCE_OUTPUT)) {
    console.error(
      `✗ 生成物缺失：${SOURCE_OUTPUT.replace(`${PACKAGE_ROOT}/`, "")}\n` +
        "  请先执行 node scripts/build-ip2region-data.mjs（部署前必须完成）。",
    );
    process.exit(1);
  }
  const source = readFileSync(SOURCE_OUTPUT, "utf8");
  const match = source.match(/IP2REGION_DATA_BASE64 = "([^"]+)"/);
  if (!match) {
    console.error("✗ 生成物格式异常：找不到 IP2REGION_DATA_BASE64");
    process.exit(1);
  }
  const db = gunzipSync(Buffer.from(match[1], "base64"));
  const firstIndexPtr = db.readUInt32LE(0);
  const lastIndexPtr = db.readUInt32LE(4);
  if (db.length < 1024 || firstIndexPtr <= 0 || lastIndexPtr >= db.length) {
    console.error(
      `✗ 生成物内容异常：db ${mb(db.length)}，first=${firstIndexPtr} last=${lastIndexPtr}`,
    );
    process.exit(1);
  }
  console.log(
    `✓ ip2region 生成物可用：db ${mb(db.length)}，索引 ${firstIndexPtr}..${lastIndexPtr}`,
  );
}

if (checkOnly) {
  check();
} else {
  build();
}
