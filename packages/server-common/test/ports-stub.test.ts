/**
 * ports 契约的永久用例：
 * 1. stub 适配器 satisfies TkAdapters —— 类型契约（包 tsconfig include 覆盖 test/，
 *    `pnpm typecheck` 每次运行都强制；通过删方法演示 tsc 报缺失）；
 * 2. createHandler(stub) 类型可接受且运行时打通 GET_FUNC_VERSION（起
 *    createHandler 由真实 pipeline 承载）。
 *
 * stub 形态说明：端口方法位一律引用具名 helper 标识符而非内联箭头——
 * 的 jsdoc/require-jsdoc 对「对象属性位置的内联箭头函数」强制注释
 * （Property > ArrowFunctionExpression context），具名 helper 各带一条注释即可复用，
 * 避免 24 处属性位的注释噪音。
 */
import { describe, expect, it } from "vitest";
import { ABSENT, createHandler } from "../src/index";
import type {
  CapChallengeData,
  CommentDoc,
  ConfigData,
  CounterDoc,
  SemanticQuery,
  TkAdapters,
  TkRequest,
  TwikooHandler,
} from "../src/index";

/** 空操作异步函数（stub 通用实现） */
const noop = async (): Promise<void> => {};

/** 空评论列表 */
const noComments = async (): Promise<CommentDoc[]> => [];

/** 计数 0 */
const zero = async (): Promise<number> => 0;

/** 无单条评论 */
const noComment = async (): Promise<CommentDoc | null> => null;

/** 原样回显评论（addComment 身份实现） */
const echoComment = async (data: CommentDoc): Promise<CommentDoc> => data;

/** 无页面计数 */
const noCounter = async (): Promise<CounterDoc | null> => null;

/** 归零计数（incCounter 身份实现） */
const emptyCounter = async (): Promise<CounterDoc> => ({ url: "", time: 0 });

/** 无配置 */
const noConfig = async (): Promise<ConfigData | null> => null;

/** 无验证码值 */
const noValue = async (): Promise<unknown> => null;

/** 无 challenge */
const noChallenge = async (): Promise<CapChallengeData | null> => null;

/** 无 token 过期时间 */
const noExpiry = async (): Promise<number | null> => null;

/** 平台原始载荷 → 最小合法 TkRequest（stub 形态） */
const stubToTkRequest = (raw: unknown): TkRequest => ({
  method: "POST",
  path: "/",
  query: {},
  body: { event: "GET_FUNC_VERSION" },
  headers: {},
  ip: "0.0.0.0",
  raw,
});

/** 内部统一响应 → 平台返回体（stub 形态：恒空对象） */
const stubFromTkResponse = (): unknown => ({});

/** 全空实现的 stub 适配器：仅满足 TkAdapters 端口形态，不承载任何行为 */
const stubAdapters = {
  request: { toTkRequest: stubToTkRequest },
  response: { fromTkResponse: stubFromTkResponse },
  database: {
    init: noop,
    close: noop,
    getAllComments: noComments,
    getComments: noComments,
    countComments: zero,
    getComment: noComment,
    addComment: echoComment,
    updateComment: noop,
    deleteComment: noop,
    bulkAddComments: noop,
    getCounter: noCounter,
    incCounter: emptyCounter,
    getConfig: noConfig,
    saveConfig: noop,
    capGet: noValue,
    capSet: noop,
    capDel: noop,
  },
  storage: {
    challenges: {
      store: noop,
      read: noChallenge,
      delete: noop,
      deleteExpired: noop,
    },
    tokens: {
      store: noop,
      get: noExpiry,
      delete: noop,
      deleteExpired: noop,
    },
  },
  mailer: { send: noop },
  notifier: { notify: noop },
  postSubmit: {
    /**
     * 端口形态 stub：本用例只打通 GET_FUNC_VERSION，不触发副作用派发
     * @returns 立即 resolve
     */
    async dispatch(): Promise<void> {},
  },
  capabilities: {
    mail: false,
    domPurify: false,
    ip2region: false,
    akismet: false,
    tencentTms: false,
    imageUpload: false,
    qqAvatar: false,
    ai: false,
  },
} satisfies TkAdapters;

describe("ports 契约", () => {
  it("stub 满足 TkAdapters 且 createHandler 类型上接受 stub 并返回 TwikooHandler", () => {
    // 类型层断言（不经运行时调用）：签名兼容由 tsc 保证
    const factory: (adapters: TkAdapters) => TwikooHandler = createHandler;
    expect(typeof factory).toBe("function");
  });

  it("createHandler 接受 stub 并打通 GET_FUNC_VERSION（pipeline 已于接线）", async () => {
    const handler = createHandler(stubAdapters);
    const request = stubAdapters.request.toTkRequest(null);
    const response = await handler(request);
    expect(response.status).toBe(200);
    expect(response.body.code).toBe(0);
    expect(typeof response.body.version).toBe("string");
  });

  it("ABSENT 哨兵可表达语义查询对象", () => {
    const query: SemanticQuery = { rid: ABSENT, isSpam: false };
    expect(query.rid).toBe(ABSENT);
  });
});
