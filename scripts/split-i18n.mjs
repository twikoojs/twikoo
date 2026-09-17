/**
 * i18n 拆分脚本（T32）：读取 twikoo1 i18n.js（只读基线），用模块求值获得完整
 * 键值映射（含缩写还原与字符串拼接），按 9 语言拆分为 locale JSON。
 * 运行：node scripts/split-i18n.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";

const SRC = new URL("../../twikoo1/src/client/utils/i18n/i18n.js", import.meta.url);
const OUT = new URL("../packages/client/src/i18n/locales/", import.meta.url);

const LANG_ORDER = ["zh-CN", "zh-HK", "zh-TW", "en", "uz-UZ", "ja-JP", "ko-KR", "vi-VN", "id-ID"];

// 模块求值（export default → module.exports；文件无其他 import）
const raw = readFileSync(SRC, "utf8");
const cjsCode = raw.replace("export default", "module.exports =");
const tmpPath = new URL("i18n-eval.tmp.cjs", SRC);
writeFileSync(tmpPath, cjsCode);
const require = createRequire(import.meta.url);
const tmpRealPath = tmpPath.pathname.replace(/^\/([A-Z]:)/, "$1");
const table = require(tmpRealPath);

const locales = {};
for (const lang of LANG_ORDER) locales[lang] = {};
let keyCount = 0;

for (const [key, values] of Object.entries(table)) {
  if (!Array.isArray(values) || values.length !== LANG_ORDER.length) continue;
  keyCount += 1;
  LANG_ORDER.forEach((lang, i) => {
    locales[lang][key] = values[i];
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
