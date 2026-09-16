#!/usr/bin/env node
/**
 * T10: env:check —— Twikoo 2.0 测试环境变量信息报告（twikoo-2.0-refactor-plan §9.4 机制要求 3）。
 *
 * 行为约定：
 * - 列出全部 23 个测试环境变量（A 类密钥/账号 14 + B 类运行时配置 9）的已配置/缺失状态；
 * - 信息报告而非拦截：无论缺失多少，退出码恒为 0（数量守卫除外——清单漂移时 fail fast）；
 * - 末尾提示 A 类缺失的影响与补跑方式。
 *
 * 数据来源合并语义（与 test/setup/env.ts 一致）：
 * process.env（CI Secrets / 外部 shell）优先于根 .env 文件；空字符串视同未配置。
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// 期望的变量总数：与 .env.example 条目数一致，漂移即脚本自身缺陷，fail fast（exit 1）
const EXPECTED_TOTAL = 23;

/**
 * 变量清单（权威来源 §9.4，新增变量须同步 .env.example 并改 EXPECTED_TOTAL）。
 * cls: "A" = 第三方密钥/账号（缺失 → 对应用例 skip）；"B" = 运行时配置（有默认值）。
 */
const VARS = [
  { name: "TEST_SMTP_HOST", cls: "A", use: "邮件发送用例", fallback: "缺失 → 邮件相关用例 skip" },
  { name: "TEST_SMTP_PORT", cls: "A", use: "邮件发送用例", fallback: "缺失 → 邮件相关用例 skip" },
  { name: "TEST_SMTP_USER", cls: "A", use: "邮件发送用例", fallback: "缺失 → 邮件相关用例 skip" },
  { name: "TEST_SMTP_PASS", cls: "A", use: "邮件发送用例", fallback: "缺失 → 邮件相关用例 skip" },
  { name: "TEST_PUSHOO_CHANNEL", cls: "A", use: "通知用例", fallback: "缺失 → 通知用例 skip" },
  { name: "TEST_PUSHOO_TOKEN", cls: "A", use: "通知用例", fallback: "缺失 → 通知用例 skip" },
  { name: "TEST_AKISMET_KEY", cls: "A", use: "反垃圾用例", fallback: "缺失 → 反垃圾用例 skip" },
  { name: "TEST_AKISMET_BLOG", cls: "A", use: "反垃圾用例", fallback: "缺失 → 反垃圾用例 skip" },
  {
    name: "TEST_TENCENT_SECRET_ID",
    cls: "A",
    use: "内容安全用例",
    fallback: "缺失 → 内容安全用例 skip",
  },
  {
    name: "TEST_TENCENT_SECRET_KEY",
    cls: "A",
    use: "内容安全用例",
    fallback: "缺失 → 内容安全用例 skip",
  },
  { name: "TEST_AI_API_KEY", cls: "A", use: "AI 生成用例", fallback: "缺失 → AI 生成用例 skip" },
  { name: "TEST_AI_BASE_URL", cls: "A", use: "AI 生成用例", fallback: "缺失 → AI 生成用例 skip" },
  { name: "TEST_IMAGE_BED_TOKEN", cls: "A", use: "图床用例", fallback: "缺失 → 图床用例 skip" },
  {
    name: "TEST_QQ_API_URL",
    cls: "A",
    use: "QQ 昵称接口用例",
    fallback: "缺失 → QQ 昵称接口用例 skip",
  },
  {
    name: "TEST_MONGODB_URI",
    cls: "B",
    use: "Mongo 契约测试连接串",
    fallback: "有默认值：mongodb-memory-server 内存实例",
  },
  {
    name: "TEST_TWIKOO_DATA_DIR",
    cls: "B",
    use: "Loki 测试数据目录",
    fallback: "有默认值：系统临时目录",
  },
  { name: "TEST_SERVER_PORT", cls: "B", use: "demo / 集成测试端口", fallback: "有默认值 9820" },
  {
    name: "TEST_BASE_URL",
    cls: "B",
    use: "集成测试目标地址",
    fallback: "有默认值 http://localhost:9820",
  },
  {
    name: "TEST_LOG_LEVEL",
    cls: "B",
    use: "日志级别（映射 TWIKOO_LOG_LEVEL）",
    fallback: "有默认值 warn",
  },
  {
    name: "TEST_TIMEZONE",
    cls: "B",
    use: "时区（影响 toCommentDto 时间断言）",
    fallback: "有默认值 Asia/Shanghai",
  },
  { name: "TEST_LOCALE", cls: "B", use: "语言区域（影响 i18n 断言）", fallback: "有默认值 zh-CN" },
  { name: "TEST_ADMIN_PASSWORD", cls: "B", use: "管理员流程用例", fallback: "有默认值：随机生成" },
  {
    name: "TEST_IP_HEADERS",
    cls: "B",
    use: "IP 头覆盖（映射 TWIKOO_IP_HEADERS）",
    fallback: "有默认值：空",
  },
];

/**
 * 轻量解析根 .env（与 test/setup/env.ts 同一约定：注释/空行/KEY=VALUE/成对引号）。
 * @param content .env 文件全文
 * @returns 键值表
 */
function parseDotEnv(content) {
  const result = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

// 数量守卫：清单漂移说明有人改了 VARS 但没同步 EXPECTED_TOTAL / .env.example
if (VARS.length !== EXPECTED_TOTAL) {
  console.error(
    `env:check 内部错误：变量清单共 ${VARS.length} 项，期望 ${EXPECTED_TOTAL} 项（与 .env.example 漂移）。`,
  );
  process.exit(1);
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(repoRoot, ".env");
const hasDotEnvFile = existsSync(envPath);
const dotEnv = hasDotEnvFile ? parseDotEnv(readFileSync(envPath, "utf8")) : {};

// 合并判定：process.env 优先（CI Secrets > .env），空字符串视同未配置
function lookup(name) {
  const fromProcess = process.env[name];
  if (typeof fromProcess === "string" && fromProcess.trim() !== "") {
    return { configured: true, source: "process.env" };
  }
  const fromFile = dotEnv[name];
  if (typeof fromFile === "string" && fromFile.trim() !== "") {
    return { configured: true, source: ".env" };
  }
  return { configured: false, source: "-" };
}

const padName = (name) => name.padEnd(24, " ");
const aConfigured = [];
const aMissing = [];
const bConfigured = [];
const bMissing = [];

console.log(
  `Twikoo 2.0 测试环境变量检查：共 ${VARS.length} 项（A 类密钥/账号 14 + B 类运行时配置 9）`,
);
console.log(
  hasDotEnvFile
    ? `数据来源：process.env + 根 .env（已找到）——CI 环境变量优先`
    : `数据来源：process.env（根 .env 不存在，可复制 .env.example 创建）`,
);
console.log("");

for (const item of VARS) {
  const { configured, source } = lookup(item.name);
  const bucket =
    item.cls === "A" ? (configured ? aConfigured : aMissing) : configured ? bConfigured : bMissing;
  bucket.push(item);
  const status = configured ? "已配置" : "缺失";
  const note = configured ? `来源 ${source}` : item.fallback;
  console.log(`[${status}] ${item.cls} 类  ${padName(item.name)} ${item.use} —— ${note}`);
}

console.log("");
console.log("## 汇总");
console.log(
  `已配置 ${aConfigured.length + bConfigured.length}/${VARS.length}（A 类 ${aConfigured.length}/14，B 类 ${bConfigured.length}/9）；缺失 ${aMissing.length + bMissing.length} 项`,
);
if (aMissing.length > 0) {
  console.log("");
  console.log(
    `提示：A 类缺失 ${aMissing.length} 项 → 对应用例将 skip；如需补跑请填充 .env（复制 .env.example 后填真实值）。`,
  );
}
console.log("");
console.log("exit 0：本脚本为信息报告，不拦截 CI（Wave 2 起真实密钥用例依赖 hasEnv skip 模式）。");
process.exit(0);
