#!/usr/bin/env node
/**
 * EO Makers 体积门禁（规范 §6.5.1）：EO bundle 不得引入 nodemailer/jsdom 等
 * 重依赖——依赖清单断言 + （若 dist 存在）产物体积上限。
 */
import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

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
if (existsSync(new URL("../dist", import.meta.url))) {
  let total = 0;
  /**
   *
   */
  const walk = (dir) => {
    for (const f of readdirSync(dir, { withFileTypes: true })) {
      const p = `${dir}/${f.name}`;
      if (f.isDirectory()) walk(p);
      else total += statSync(p).size;
    }
  };
  const distDir = fileURLToPath(new URL("../dist", import.meta.url));
  walk(distDir);
  const cap = 5 * 1024 * 1024;
  if (total > cap) {
    console.error(
      `EO 门禁红：dist 体积 ${(total / 1024).toFixed(0)}KB 超上限 ${(cap / 1024).toFixed(0)}KB`,
    );
    process.exit(1);
  }
  console.log(`EO 门禁绿：无禁止依赖；dist 体积 ${(total / 1024).toFixed(0)}KB ≤ 上限`);
} else {
  console.log("EO 门禁绿：无禁止依赖（dist 未构建，跳过体积断言）");
}
