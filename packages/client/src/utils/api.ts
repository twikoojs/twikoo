/**
 * 客户端通信层（1.x utils/api.js 语义对齐 + 错误模型改进）。
 *
 * - call(tcb, event, data)：云开发通道 or HTTP XHR 通道；
 * - accessToken：localStorage `twikoo-access-token`（BC 保留）；
 * - 0.1.x 旧函数名 fallback **已移除**；
 * - TwikooError 八分类：NETWORK/CORS/TIMEOUT/REJECTED/NOT_FOUND/
 *   CLIENT_ERROR/SERVER_ERROR/UNKNOWN，携带 httpStatus/rawMessage/requestId。
 */

/** TwikooError kind 八分类（分类表）*/
export type TwikooErrorKind =
  | "NETWORK"
  | "CORS"
  | "TIMEOUT"
  | "REJECTED"
  | "NOT_FOUND"
  | "CLIENT_ERROR"
  | "SERVER_ERROR"
  | "UNKNOWN";

/** 统一错误模型（字段表）*/
export class TwikooError extends Error {
  /** 错误分类 */
  kind: TwikooErrorKind;
  /** 原始 HTTP 状态码（若有） */
  httpStatus?: number;
  /** 原始错误文本 */
  rawMessage: string;
  /** 请求 ID（后端贯穿）*/
  requestId?: string;

  /**
   * @param kind 错误分类
   * @param message 展示消息
   * @param options 附加字段
   */
  constructor(
    kind: TwikooErrorKind,
    message: string,
    options: {
      httpStatus?: number;
      rawMessage?: string;
      requestId?: string;
    } = {},
  ) {
    super(message);
    this.name = "TwikooError";
    this.kind = kind;
    this.httpStatus = options.httpStatus;
    this.rawMessage = options.rawMessage ?? message;
    this.requestId = options.requestId;
  }
}

/** 云开发应用最小结构面（仅需 callFunction） */
export type TcbApp = {
  /**
   * 调用云函数。
   * @param params 函数名与数据
   * @returns 云函数结果
   */
  callFunction(params: { name: string; data: unknown }): Promise<Record<string, unknown>>;
};

/** 云开发鉴权最小结构面（1.x 用到的四个能力：取当前用户、登出、自定义登录、匿名登录） */
export type TcbAuth = {
  /**
   * 取当前登录用户。
   * @returns 用户信息（`loginType === 'CUSTOM'` 表示管理员）
   */
  getCurrentUser(): Promise<{ loginType?: string; uid?: string }>;
  /** 登出 */
  signOut(): Promise<void>;
  /** 当前用户（同步快照；`TkSubmit` 取 uid 用） */
  currentUser?: { uid?: string };
  /**
   * 自定义登录（管理面板用票据换登录态）。
   * @returns provider
   */
  customAuthProvider(): {
    /**
     * 用票据登录。
     * @param ticket 登录票据
     * @returns 登录结果
     */
    signIn(ticket: string): Promise<unknown>;
  };
  /**
   * 匿名登录。
   * @returns provider
   */
  anonymousAuthProvider(): {
    /**
     * 匿名登录。
     * @returns 登录结果
     */
    signIn(): Promise<unknown>;
  };
  /**
   * 是否已有登录态。
   * @returns 是否已登录
   */
  hasLoginState?(): boolean;
};

/** 云开发实例（可选；HTTP 形态为 null） */
export type TcbInstance = { app: TcbApp; auth?: TcbAuth } | null;

/** 全局应用状态（view 渲染时注入；Options API 全局属性对齐）*/
const appState: { tcb: TcbInstance; options: Record<string, unknown> } = {
  tcb: null,
  options: {},
};

/**
 * 注入应用状态（view 渲染入口调用）。
 * @param tcb 云开发实例
 * @param options 前端选项
 */
export function setAppState(tcb: TcbInstance, options: Record<string, unknown>): void {
  appState.tcb = tcb;
  appState.options = options;
}

/**
 * 读取应用状态（组合式组件经此获取 tcb 与前端选项，替代 1.x 的 this.$tcb）。
 * @returns 应用状态
 */
export function getAppState(): { tcb: TcbInstance; options: Record<string, unknown> } {
  return appState;
}

/**
 * 判断是否 URL（1.x isUrl 对齐）。
 * @param s 待测字符串
 * @returns 是否 http(s):// 开头
 */
export function isUrl(s: unknown): boolean {
  return typeof s === "string" && /^http(s)?:\/\//.test(s);
}

/**
 * HTTP 通道（XHR POST；1.x call 的 HTTP 分支对齐）。
 * @param url 后端地址
 * @param payload 请求载荷
 * @returns 响应体
 */
function httpCall(url: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const accessToken = localStorage.getItem("twikoo-access-token");
    const xhr = new XMLHttpRequest();
    const startedAt = Date.now();
    xhr.onreadystatechange = () => {
      if (xhr.readyState !== 4) return;
      const elapsed = Date.now() - startedAt;
      if (xhr.status === 200) {
        try {
          const result = JSON.parse(xhr.responseText) as Record<string, unknown>;
          if (result.accessToken) {
            localStorage.setItem(
              "twikoo-access-token",
              typeof result.accessToken === "string" ? result.accessToken : "",
            );
          }
          resolve(result);
        } catch {
          reject(
            new TwikooError("UNKNOWN", "后端返回格式异常", {
              rawMessage: xhr.responseText.slice(0, 200),
            }),
          );
        }
      } else if (xhr.status === 0) {
        // status 0：网络失败或跨域拦截（判定表）
        reject(
          new TwikooError(elapsed > 30000 ? "TIMEOUT" : "CORS", "请求被跨域策略拦截或网络不可达", {
            rawMessage: xhr.statusText || "status 0",
          }),
        );
      } else if (xhr.status === 404) {
        reject(
          new TwikooError("NOT_FOUND", "接口地址不存在", {
            httpStatus: 404,
            rawMessage: xhr.responseText.slice(0, 200),
          }),
        );
      } else if (xhr.status === 401 || xhr.status === 403) {
        reject(
          new TwikooError("CLIENT_ERROR", "认证失败，请重新登录", {
            httpStatus: xhr.status,
            rawMessage: xhr.responseText.slice(0, 200),
          }),
        );
      } else if (xhr.status === 429) {
        reject(
          new TwikooError("REJECTED", "请求过于频繁", {
            httpStatus: 429,
            rawMessage: xhr.responseText.slice(0, 200),
          }),
        );
      } else if (xhr.status >= 500) {
        reject(
          new TwikooError("SERVER_ERROR", "后端异常", {
            httpStatus: xhr.status,
            rawMessage: xhr.responseText.slice(0, 200),
          }),
        );
      } else {
        reject(
          new TwikooError("CLIENT_ERROR", `请求失败（${xhr.status}）`, {
            httpStatus: xhr.status,
            rawMessage: xhr.responseText.slice(0, 200),
          }),
        );
      }
    };
    try {
      xhr.open("POST", url);
      xhr.setRequestHeader("Content-Type", "application/json");
      xhr.send(JSON.stringify({ accessToken, ...payload, envId: url }));
    } catch (e) {
      reject(new TwikooError("NETWORK", "无法连接到后端", { rawMessage: String(e) }));
    }
  });
}

/**
 * 统一事件调用（1.x call 语义对齐；0.1.x 旧函数名 fallback 已移除）。
 * @param tcb 云开发实例（可选）
 * @param event 事件名（24 个客户端事件之一）
 * @param data 事件参数
 * @returns 响应体
 */
export async function call(
  tcb: TcbInstance,
  event: string,
  data: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const activeTcb = tcb ?? appState.tcb;
  const envId: string | undefined =
    typeof data.envId === "string"
      ? data.envId
      : typeof appState.options.envId === "string"
        ? appState.options.envId
        : undefined;
  const funcName: string =
    typeof data.funcName === "string"
      ? data.funcName
      : typeof appState.options.funcName === "string"
        ? appState.options.funcName
        : "twikoo";
  if (activeTcb) {
    return await activeTcb.app.callFunction({
      name: funcName,
      data: { event, ...data },
    });
  }
  if (typeof envId === "string" && isUrl(envId)) {
    return await httpCall(envId, { event, ...data });
  }
  throw new Error("缺少 envId 配置 - https://twikoo.js.org");
}
