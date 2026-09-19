/**
 * 云开发实例安装（1.x `utils/tcb.js` 语义对齐；HTTP 地址形态返回 null）。
 *
 * 1.x 流程：`sdk.init({ env, region })` → `app.auth({ persistence: 'local' })` →
 * 无登录态则匿名登录。管理面板的「自定义登录」与评论区的「取 uid」都依赖这里
 * 装配出的 `auth`，因此 2.0 必须一并迁入（1.x 的 tcb 对象是 `{ sdk, app, auth }`）。
 *
 * 类型统一收敛：结构面定义在 `utils/api.ts`（`TcbApp` / `TcbAuth` / `TcbInstance`），
 * 通信层与实例装配层共用同一份类型。
 */
import type { TcbApp, TcbAuth, TcbInstance } from "./api";
import { isNotSet } from ".";
import { logger } from "./logger";

export type { TcbApp, TcbAuth, TcbInstance };

/** init 选项中的云开发配置 */
interface TcbOptions {
  /** 云开发环境 ID */
  envId?: string;
  /** 环境地域 */
  region?: string;
}

/** 必须存在的 init 选项（1.x builtInOptions） */
const builtInOptions: Array<{ key: keyof TcbOptions; required: boolean }> = [
  { key: "envId", required: true },
];

/** 云开发 SDK 最小结构面（`@cloudbase/js-sdk/app` 的 init） */
type CloudbaseSdk = {
  init(options: { env: string; region?: string }): TcbApp & {
    auth(config: { persistence: string }): TcbAuth;
  };
};

/**
 * 校验必填选项（1.x checkOptions 对齐）。
 * @param options 选项
 */
function checkOptions(options: TcbOptions): void {
  const missing = builtInOptions
    .filter((option) => option.required && isNotSet(options[option.key]))
    .map((option) => option.key);
  if (missing.length === 0) return;
  for (const key of missing) logger.warn(`${key} is required`);
  throw new Error("Twikoo: failed to init");
}

/**
 * 初始化云开发实例（全局 cloudbase 由 main.all 形态的 SDK 提供）。
 * @param cloudbase 云开发 SDK（`main.all` 内置；`main` 形态由使用方先引脚本）
 * @param options 选项（envId/region）
 * @returns 云开发实例
 */
export async function install(cloudbase: unknown, options: TcbOptions): Promise<TcbInstance> {
  const sdk = cloudbase as CloudbaseSdk;
  checkOptions(options);
  const app = sdk.init({ env: options.envId ?? "", region: options.region });
  const auth = app.auth({ persistence: "local" });
  if (!auth.hasLoginState?.()) {
    await auth.anonymousAuthProvider().signIn();
  }
  // `app` 同时具备 callFunction 与 uploadFile 等能力，结构上兼容 TcbApp
  return { app, auth };
}
