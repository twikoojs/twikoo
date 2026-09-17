/**
 * 云开发实例安装（1.x utils/tcb.ts 语义对齐；HTTP 地址形态返回 null）。
 */

/** 云开发实例最小结构面（callFunction） */
export interface TcbInstance {
  /** 云开发应用 */
  app: {
    /**
     * 调用云函数
     * @param params 函数名与数据
     * @returns 云函数结果
     */
    callFunction(params: { name: string; data: unknown }): Promise<{ result: unknown }>;
  };
}

/** init 选项中的云开发配置 */
interface TcbOptions {
  envId?: string;
  region?: string;
}

/**
 * 初始化云开发实例（全局 cloudbase 由 main.all 形态的 SDK 提供）。
 * @param cloudbase 全局 cloudbase 对象
 * @param options 选项（envId/region）
 * @returns 云开发实例
 */
export function install(cloudbase: unknown, options: TcbOptions): Promise<TcbInstance> {
  const cb = cloudbase as {
    init(options: { env: string; region?: string }): TcbInstance["app"];
  };
  const app = cb.init({ env: options.envId ?? "", region: options.region });
  return Promise.resolve({ app });
}

/**
 * 初始化入口（1.x initTcb 对齐）：全局 cloudbase 未定义时报错提示。
 * @param options 选项
 * @returns 云开发实例或 null
 */
export async function initTcb(options: TcbOptions): Promise<TcbInstance | null> {
  const globalCloudbase = (globalThis as { cloudbase?: unknown }).cloudbase;
  if (typeof globalCloudbase === "undefined") {
    console.error(
      'Please import cloudbase firstly:\n<script src="https://imgcache.qq.com/qcloud/cloudbase-jsdk/1.3.3/cloudbase.full.js"></script>',
    );
    return null;
  }
  return await install(globalCloudbase, options);
}
