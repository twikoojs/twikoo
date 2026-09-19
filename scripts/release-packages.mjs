/**
 * 发布包清单（Scope C 单一真相源）。
 *
 * 9 个包共享同一版本号；仓库内 `version` 恒为 `0.0.0`，仅由 publish.yml 在 CI 中覆写后发布。
 * 分批顺序：
 * - 第一批：@twikoojs/shared、@twikoojs/common、pushoo、twikoo（无服务端依赖）
 * - 第二批：twikoo-func、twikoo-vercel、tkserver、twikoo-netlify、@twikoojs/aws-lambda
 *   （依赖 common，必须等第一批可见）
 *
 * 注：`@twikoojs/aws-lambda` 于 2026-09-19 由「私有」改为发布 —— AWS Lambda 的一键部署模板
 * （`templates/aws-lambda`）要靠 npm 上的 `latest` 取实现，不发包就没有可部署产物。
 */

/** 基线版本（仓库内所有发布包必须保持此值） */
export const BASELINE_VERSION = "0.0.0";

/** 单个发布包定义 */
export const PUBLISH_PACKAGES = [
  // ---- 第一批 ----
  { name: "@twikoojs/shared", dir: "packages/shared", batch: 1 },
  { name: "@twikoojs/common", dir: "packages/server-common", batch: 1 },
  { name: "pushoo", dir: "packages/pushoo", batch: 1 },
  { name: "twikoo", dir: "packages/client", batch: 1 },
  // ---- 第二批 ----
  { name: "twikoo-func", dir: "packages/server-cloudbase", batch: 2 },
  { name: "twikoo-vercel", dir: "packages/server-vercel", batch: 2 },
  { name: "tkserver", dir: "packages/server-self-hosted", batch: 2 },
  { name: "twikoo-netlify", dir: "packages/server-netlify", batch: 2 },
  { name: "@twikoojs/aws-lambda", dir: "packages/server-aws-lambda", batch: 2 },
];

/**
 * 取某一批次的发布包。
 * @param batch 批次号（1 / 2）
 * @returns 该批次的包定义
 */
export function packagesOfBatch(batch) {
  return PUBLISH_PACKAGES.filter((p) => p.batch === batch);
}

/**
 * 语义化版本比较（仅支持 `x.y.z` 与 `x.y.z-pre.n` 形态）。
 * @param a 版本 a
 * @param b 版本 b
 * @returns a > b 返回 1，a < b 返回 -1，相等返回 0
 */
export function compareVersions(a, b) {
  const parse = (v) => {
    const [core, pre = ""] = String(v).split("-");
    const [major, minor, patch] = core.split(".").map((n) => parseInt(n, 10));
    return { major, minor, patch, pre };
  };
  const pa = parse(a);
  const pb = parse(b);
  for (const key of ["major", "minor", "patch"]) {
    if (pa[key] !== pb[key]) return pa[key] > pb[key] ? 1 : -1;
  }
  // 有预发布标识者小于同核心版本（semver）
  if (pa.pre === pb.pre) return 0;
  if (pa.pre === "") return 1;
  if (pb.pre === "") return -1;
  return pa.pre > pb.pre ? 1 : -1;
}

/**
 * 取版本的核心部分（`x.y.z`，去掉预发布标识）。
 * @param version 版本号
 * @returns `x.y.z`
 */
export function coreOf(version) {
  return String(version).split("-")[0];
}

/**
 * 取版本的 major.minor 前缀。
 * @param version 版本号
 * @returns `x.y`
 */
export function majorMinorOf(version) {
  return coreOf(version).split(".").slice(0, 2).join(".");
}
