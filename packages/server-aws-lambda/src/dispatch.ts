/**
 * AWS Lambda 的 POST_SUBMIT 派发实现（规范「后置副作用异步语义」）。
 *
 * **与 1.x 的差异（修正）**：1.x 的 aws-lambda 适配器是
 * `require('twikoo-vercel')` 纯转发壳，继承了 vercel 的 HTTP 递归——而 vercel
 * 取的是 `VERCEL_URL`，在 Lambda 上并不存在，自调用实际发不出去（副作用静默
 * 丢失）。2.0 独立实现，改用 Lambda **原生异步调用**：这是最干净的机制，
 * `InvocationType: "Event"` 让平台立即返回 202，副作用在被调用的实例里
 * 独立跑完，无需任何有界竞速。
 *
 * **依赖说明**：`@aws-sdk/client-lambda` 由 Lambda 的 Node.js 运行时内置
 * （Node 18+ 运行时随附 AWS SDK v3），因此**不声明为包依赖**，与仓库
 * `lib-loader` 的「变量 specifier 动态加载」同一手法，避免打包期解析。
 *
 * 副作用链本身仍在 common 的 postSubmit 服务里。
 */
import { RECURSION_HEADER, getRecursionToken, type PostSubmitDispatcher } from "@twikoojs/common";

/** `@aws-sdk/client-lambda` 的最小结构面（只声明本实现用到的成员） */
interface LambdaSdkLike {
  /** 客户端构造器 */
  LambdaClient: new (config: Record<string, unknown>) => {
    /**
     * 发送命令。
     * @param command 命令实例
     * @returns 响应
     */
    send(command: unknown): Promise<unknown>;
  };
  /** Invoke 命令构造器 */
  InvokeCommand: new (input: {
    FunctionName: string;
    InvocationType: string;
    Payload: Uint8Array;
  }) => unknown;
}

/**
 * 解析自身函数名（运行时注入的 `AWS_LAMBDA_FUNCTION_NAME`）。
 * @returns 函数名；缺失时为空串
 */
function resolveFunctionName(): string {
  return process.env.AWS_LAMBDA_FUNCTION_NAME ?? "";
}

/** AWS Lambda 的 POST_SUBMIT 派发实现（原生异步 Invoke） */
export const lambdaPostSubmitDispatcher: PostSubmitDispatcher = {
  /**
   * 异步调用本函数执行 POST_SUBMIT（平台级 fire-and-forget，不等待）。
   * @param comment 已入库的评论
   * @param ctx 当前请求上下文
   */
  async dispatch(comment, ctx): Promise<void> {
    const name = resolveFunctionName();
    if (!name) {
      ctx.logger.warn("POST_SUBMIT 派发跳过：未取到函数名（AWS_LAMBDA_FUNCTION_NAME）");
      return;
    }
    const specifier = "@aws-sdk/client-lambda";
    const sdk = (await import(/* @vite-ignore */ specifier)) as unknown as LambdaSdkLike;
    const client = new sdk.LambdaClient({});
    /**
     * 载荷构造为 API Gateway 代理事件形态——被调用的实例与处理真实请求时
     * 走完全相同的归一化路径（toTkRequest），因此 IP、请求头、body 语义一致。
     */
    const payload = {
      httpMethod: "POST",
      requestContext: { http: { method: "POST", sourceIp: ctx.request.ip } },
      headers: { ...ctx.request.headers, [RECURSION_HEADER]: getRecursionToken(ctx.config) },
      body: JSON.stringify({ event: "POST_SUBMIT", comment }),
      isBase64Encoded: false,
    };
    await client.send(
      new sdk.InvokeCommand({
        FunctionName: name,
        /** 异步调用：平台立即返回 202，副作用在另一实例中执行 */
        InvocationType: "Event",
        Payload: new TextEncoder().encode(JSON.stringify(payload)),
      }),
    );
  },
};
