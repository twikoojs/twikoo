/**
 * i18n 拆分脚本（T32）：读取 twikoo1 i18n.js（只读基线），用模块求值获得完整
 * 键值映射（含缩写还原与字符串拼接），按 9 语言拆分为 locale JSON。
 * 运行：node scripts/split-i18n.mjs
 *
 * 2026-09-17 修正（Wave 4 客户端补齐）：
 *  1. 求值临时文件改写到系统临时目录——原实现写在 twikoo1 源码目录内，会污染只读基线；
 *  2. 长度不足 9 的键不再静默丢弃，改为按英文（index 3）补齐并在末尾列出——
 *     原实现丢弃了 5 个键（3 个 Cap/Turnstile 文案 + 2 个 S3 文案），
 *     导致 T32 交付的键集比 1.x 少 5 个。
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SRC = new URL("../../twikoo1/src/client/utils/i18n/i18n.js", import.meta.url);
const OUT = new URL("../packages/client/src/i18n/locales/", import.meta.url);

const LANG_ORDER = ["zh-CN", "zh-HK", "zh-TW", "en", "uz-UZ", "ja-JP", "ko-KR", "vi-VN", "id-ID"];

/** 英文在 LANG_ORDER 中的下标：短键补齐时的取值来源（品牌名/技术名词多为语言中立） */
const EN_INDEX = LANG_ORDER.indexOf("en");

// 模块求值（export default → module.exports；文件无其他 import）
const raw = readFileSync(SRC, "utf8");
const cjsCode = raw.replace("export default", "module.exports =");
const tmpPath = join(tmpdir(), `twikoo-i18n-eval-${process.pid}.cjs`);
writeFileSync(tmpPath, cjsCode);
const require = createRequire(import.meta.url);
let table;
try {
  table = require(tmpPath);
} finally {
  rmSync(tmpPath, { force: true });
}

const locales = {};
for (const lang of LANG_ORDER) locales[lang] = {};
let keyCount = 0;
const padded = [];

for (const [key, values] of Object.entries(table)) {
  if (!Array.isArray(values)) continue;
  if (values.length !== LANG_ORDER.length) {
    // 1.x 有 5 个键只写了 8 种语言（新增 Cap 时漏了末位），按英文补齐而非丢弃
    padded.push(`${key}(${values.length}→${LANG_ORDER.length})`);
  }
  keyCount += 1;
  LANG_ORDER.forEach((lang, i) => {
    locales[lang][key] = values[i] ?? values[EN_INDEX] ?? values[values.length - 1];
  });
}

mkdirSync(OUT, { recursive: true });
for (const lang of LANG_ORDER) {
  writeFileSync(new URL(`${lang}.json`, OUT), JSON.stringify(locales[lang], null, 2) + "\n");
}
writeFileSync(
  new URL("_keys.json", OUT),
  JSON.stringify(Object.keys(locales["zh-CN"]).sort(), null, 2) + "\n",
);
console.log(`拆分完成：${keyCount} 键 × ${LANG_ORDER.length} 语言`);
if (padded.length) console.log(`补齐短键 ${padded.length} 个：${padded.join(", ")}`);
