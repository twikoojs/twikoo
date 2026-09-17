#!/usr/bin/env node
/**
 * 适配器依赖完整性检查（D-2 配套，规范 §6.5.1 CI 保障）：
 * 各适配器按 capabilities 声明能力 → 对应 Scope F 重依赖必须在 dependencies 声明。
 * 覆盖 8 个服务端适配器；输出缺失清单，任一缺失 exit 1。
 */
import { readFileSync } from "node:fs";

/** 能力 → 必备依赖映射（§6.5.1 依赖外部化策略） */
const CAPABILITY_DEPS = {
  mail: ["nodemailer"],
  domPurify: ["jsdom", "dompurify"],
  ip2region: ["@imaegoo/node-ip2region"],
  akismet: ["akismet-api"],
  tencentTms: ["tencentcloud-sdk-nodejs-tms"],
  imageUpload: ["form-data"],
  qqAvatar: ["axios"],
  ai: ["@xsai/generate-text"],
};

/** 全能力适配器必备的通用依赖（含策略一致的轻量库） */
const COMMON_DEPS = ["axios", "bowser", "html-to-text", "xml2js"];

/** EO Makers 的 Blob KV 依赖（受限能力形态） */
const EO_EXTRA_DEPS = ["@edgeone/pages-blob"];

/** 数据库依赖（按平台数据库实现） */
const DB_DEPS = {
  "server-cloudbase": [],
  "server-vercel": ["mongodb"],
  "server-netlify": ["mongodb"],
  "server-self-hosted": ["lokijs", "mongodb"],
  "server-aws-lambda": ["mongodb"],
  "server-deta": ["mongodb"],
  "server-vercel-min": [],
  "server-edgeone-makers": [],
};

/** 豁免清单：EO 受限能力；vercel-min 为纯转发壳（无自身业务与依赖需求） */
const RESTRICTED = {
  "server-edgeone-makers": {
    skipCapabilities: ["mail", "domPurify", "akismet", "tencentTms", "ai"],
    skipCommon: [],
    extra: EO_EXTRA_DEPS,
  },
  "server-vercel-min": {
    skipAll: true,
    extra: ["twikoo-vercel"],
  },
};

/** 适配器 → 包名（目录 ≠ 包名，§3.1.1） */
const ADAPTERS = [
  ["server-cloudbase", "twikoo-func"],
  ["server-vercel", "twikoo-vercel"],
  ["server-netlify", "twikoo-netlify"],
  ["server-self-hosted", "tkserver"],
  ["server-aws-lambda", "twikoo-aws-lambda"],
  ["server-deta", "twikoo-deta"],
  ["server-vercel-min", "twikoo-vercel-min"],
  ["server-edgeone-makers", "twikoo-edgeone-makers"],
];

let failed = false;
for (const [dir, pkgName] of ADAPTERS) {
  const pkg = JSON.parse(
    readFileSync(new URL(`../packages/${dir}/package.json`, import.meta.url), "utf8"),
  );
  const deps = Object.keys(pkg.dependencies ?? {});
  const restricted = RESTRICTED[dir];
  const missing = [];
  if (restricted?.skipAll) {
    for (const dep of restricted.extra) {
      if (!deps.includes(dep)) missing.push(dep);
    }
    if (missing.length) {
      failed = true;
      console.error(`✗ ${pkgName}（${dir}）：缺失依赖 → ${missing.join(", ")}`);
    } else {
      console.log(`✓ ${pkgName}：依赖完整（转发壳）`);
    }
    continue;
  }
  for (const dep of COMMON_DEPS) {
    if (restricted?.skipCommon?.includes(dep)) continue;
    if (!deps.includes(dep)) missing.push(dep);
  }
  for (const dep of DB_DEPS[dir] ?? []) {
    if (!deps.includes(dep)) missing.push(dep);
  }
  if (!restricted) {
    // 全能力形态：八项能力对应依赖全部必备
    for (const caps of Object.values(CAPABILITY_DEPS)) {
      for (const dep of caps) {
        if (!deps.includes(dep)) missing.push(dep);
      }
    }
    // pushoo 通知（notify 能力）
    if (!deps.includes("pushoo")) missing.push("pushoo");
  } else {
    for (const dep of restricted.extra) {
      if (!deps.includes(dep)) missing.push(dep);
    }
    // 受限形态仍必备的通道依赖（mail 受限但保留 SendGrid 走 axios；Cap 内嵌在 common）
    if (!deps.includes("@cap.js/server")) missing.push("@cap.js/server");
  }
  if (!deps.includes("@twikoojs/common")) missing.push("@twikoojs/common");
  if (!deps.includes("@twikoojs/shared")) missing.push("@twikoojs/shared");

  if (missing.length) {
    failed = true;
    console.error(`✗ ${pkgName}（${dir}）：缺失依赖 → ${missing.join(", ")}`);
  } else {
    console.log(`✓ ${pkgName}：依赖完整`);
  }
}

if (failed) {
  console.error("\n依赖完整性检查失败（D-2）：缺失依赖将在运行时才暴露，请补齐后重试");
  process.exit(1);
}
console.log("\n8 个服务端适配器依赖完整性检查全部通过");
