#!/usr/bin/env node
/**
 * EO Makers 产物体积门禁。
 *
 * 三条断言（dist 不存在时只跑第 1 条）：
 *
 * 1. **依赖清单**：`dependencies` 不得出现 nodemailer / jsdom 等重依赖 —— EO 运行时装不了、
 *    也跑不动它们（原生模块、体积）；
 * 2. **代码产物 ≤ 5 MB**（排除 `generated/`）：这条同时是「ip2region 数据必须留在独立分片里」
 *    的守卫 —— 一旦有人把 `inline.ts` 的动态 import 改成静态 import，6.06 MB 的 base64 会被
 *    内联进 `index.js`，此处立刻变红；
 * 3. **数据分片存在且体积在预期区间**：漏跑生成步骤时立刻变红，而不是安静地部署出一个
 *    「IP 属地永远为空」的版本。
 *
 * 数据分片为何必然这么大：`@imaegoo/node-ip2region` 的 `ip2region.db` 原始 8.33 MB，
 * gzip -9 后 4.54 MB，base64 后 6.06 MB（base64 有 4/3 膨胀，且这是**已压缩**数据，
 * 再压没有空间）。它同时是「EO 上必须内联」的原因：EO 的部署产物是 JS bundle，
 * 没有可读的兄弟数据文件，库的 `fs` 随机读无从落地。
 */
import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** 代码产物（不含数据分片）的体积上限：5 MB */
const CODE_CAP = 5 * 1024 * 1024;

/** 数据分片的体积区间（下限防截断，上限防异常膨胀） */
const DATA_MIN = 5 * 1024 * 1024;
const DATA_MAX = 7 * 1024 * 1024;

/** 生成的数据分片所在目录名（相对 dist） */
const GENERATED_DIR = "generated";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const forbidden = [
  "nodemailer",
  "jsdom",
  "dompurify",
  "akismet-api",
  "tencentcloud-sdk-nodejs-tms",
];
const deps = Object.keys(pkg.dependencies ?? {});
const leaked = deps.filter((d) => forbidden.includes(d));
if (leaked.length) {
  console.error(`EO 门禁红：禁止的重依赖进入 dependencies：${leaked.join(", ")}`);
  process.exit(1);
}

const distUrl = new URL("../dist", import.meta.url);
if (!existsSync(distUrl)) {
  console.log("EO 门禁绿：无禁止依赖（dist 未构建，跳过体积断言）");
  process.exit(0);
}

const distDir = fileURLToPath(distUrl);
/** 代码产物累计字节 */
let code = 0;
/** 数据分片累计字节 */
let data = 0;
/** 数据分片文件列表 */
const dataFiles = [];

/**
 * 递归统计 dist 体积，按「代码产物 / 数据分片」分开累计。
 * @param dir 当前目录
 */
const walk = (dir) => {
  for (const f of readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${f.name}`;
    if (f.isDirectory()) {
      walk(p);
      continue;
    }
    const size = statSync(p).size;
    // 数据分片单独计量：它必然 6 MB 量级，不能和代码共用 5 MB 上限
    if (p.includes(`/${GENERATED_DIR}/`)) {
      data += size;
      dataFiles.push({ path: p.replace(`${distDir}/`, ""), size });
    } else {
      code += size;
    }
  }
};
walk(distDir);

const kb = (n) => `${(n / 1024).toFixed(0)}KB`;
const mb = (n) => `${(n / 1024 / 1024).toFixed(2)}MB`;

const problems = [];
if (code > CODE_CAP) {
  problems.push(`代码产物 ${kb(code)} 超上限 ${kb(CODE_CAP)}（是否把 ip2region 数据内联了？）`);
}
if (dataFiles.length === 0) {
  problems.push(
    `缺少 ip2region 数据分片 dist/${GENERATED_DIR}/ip2region-data.js` +
      "（漏跑 `npm run build` 会导致部署后 IP 属地永远为空）",
  );
} else if (data < DATA_MIN || data > DATA_MAX) {
  problems.push(
    `数据分片 ${mb(data)} 超出预期区间 ${mb(DATA_MIN)}..${mb(DATA_MAX)}` +
      `（db 更新后请同步调整上限；偏小也可能是文件被截断）`,
  );
}

if (problems.length) {
  console.error(`EO 门禁红：\n  ${problems.join("\n  ")}`);
  process.exit(1);
}

console.log(
  `EO 门禁绿：无禁止依赖；代码产物 ${kb(code)} ≤ ${kb(CODE_CAP)}；` +
    `数据分片 ${mb(data)} 在 ${mb(DATA_MIN)}..${mb(DATA_MAX)} 内`,
);
