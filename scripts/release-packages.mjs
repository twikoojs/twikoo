/**
 * 发布包清单（Scope C 单一真相源）。
 *
 * 10 个包共享同一版本号；仓库内 `version` 恒为 `0.0.0`，仅由 publish.yml 在 CI 中覆写后发布。
 * 发布为**单阶段**：10 个包一次性并行发布，不按依赖分批。
 * `npm publish` 不校验 dependencies 是否已存在于 registry，故依赖 `@twikoojs/common` 的服务端
 * 适配器与 common 同批发布不会失败；分批只会为等一轮 npm 可见性 gate（最长 600s）白花时间。
 *
 * 注：`@twikoojs/aws-lambda` 于 2026-09-19 由「私有」改为发布 —— AWS Lambda 的一键部署模板
 * （`templates/aws-lambda`）要靠 npm 上的 `latest` 取实现，不发包就没有可部署产物。
 */

/** 基线版本（仓库内所有发布包必须保持此值） */
export const BASELINE_VERSION = "0.0.0";

/** 单个发布包定义 */
export const PUBLISH_PACKAGES = [
  { name: "@twikoojs/shared", dir: "packages/shared" },
  { name: "@twikoojs/common", dir: "packages/server-common" },
  { name: "pushoo", dir: "packages/pushoo" },
  { name: "twikoo", dir: "packages/client" },
  { name: "twikoo-func", dir: "packages/server-cloudbase" },
  { name: "twikoo-vercel", dir: "packages/server-vercel" },
  { name: "tkserver", dir: "packages/server-self-hosted" },
  { name: "twikoo-netlify", dir: "packages/server-netlify" },
  { name: "@twikoojs/aws-lambda", dir: "packages/server-aws-lambda" },
  { name: "@twikoojs/cloudflare-workers", dir: "packages/server-cloudflare-workers" },
];

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
