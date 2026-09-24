/**
 * twikoo-edgeone-makers 主逻辑（EdgeOne Makers 薄适配器）。
 * 受限能力：mail restricted（SendGrid/MailChannels/Go SMTP Bridge）、domPurify false
 * （直通注入）、akismet/tencentTms false；BlobKV 注入 BlobKvDatabase；
 * ip2region 注入 fs-free 内存查询器（db 内联，见 `ip2region/`）。核对：EdgeOne Makers 官方文档（2026-09-17）。
 */
import {
  BlobKvDatabase,
  createHandler,
  scaffoldAdapters,
  setCustomLibs,
  type BlobKvStoreLike,
  type Capabilities,
  type Database,
  type TkRequest,
  type TkResponse,
} from "@twikoojs/common";
import { getIp2RegionOverride } from "./ip2region/inline";
import { createEoNodemailer, createMailBridgeContext, withMailBridgeContext } from "./mail";

/** EO Makers 受限能力声明（EO 行，能力受限）*/
export const eoCapabilities: Capabilities = {
  mail: "restricted",
  domPurify: false,
  ip2region: true,
  akismet: false,
  tencentTms: false,
  imageUpload: true,
  qqAvatar: true,
  ai: false,
};

/** EO 事件的最小结构面（Makers HTTP 请求：body 已解析挂载） */
export interface EoEventLike {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  /** 平台解析好的客户端 IP（`context.clientIp`；缺省时由转发头回落，见 `toTkRequest`） */
  ip?: string;
  /** 平台环境变量（`context.env`；入口已合并进 `process.env`，此处仅留档备查） */
  env?: Record<string, string | undefined>;
}

/** EO 返回体（HTTP 形态） */
export interface EoResult {
  status: number;
  headers: Record<string, string>;
  body: string;
}

/**
 * EO 事件 → 内部统一请求（headers 小写化）。
 *
 * IP 优先取入口从 `context.clientIp` 填入的 `event.ip`（平台解析，不依赖部署形态）；
 * 缺省时回落 `x-real-ip` / `x-forwarded-for` 首跳。
 * @param event 平台事件
 * @returns 内部统一请求
 */
export function toTkRequest(event: EoEventLike): TkRequest {
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(event.headers ?? {})) {
    if (value !== undefined) headers[key.toLowerCase()] = Array.isArray(value) ? value[0] : value;
  }
  const forwarded = headers["x-forwarded-for"];
  const ip = event.ip || headers["x-real-ip"] || (forwarded ? forwarded.split(",")[0].trim() : "");
  const body = (
    event.body && typeof event.body === "object" ? event.body : {}
  ) as TkRequest["body"];
  return {
    method: String(event.method ?? "POST").toUpperCase(),
    path: "/",
    query: {},
    body,
    headers,
    ip,
    raw: event,
  };
}

/** 内部统一响应 → EO 返回体（状态码与响应头透传；204 无体，业务体 JSON 字符串化）。 */
export function fromTkResponse(tkRes: TkResponse): EoResult {
  if (tkRes.status === 204) {
    return { status: 204, headers: { ...tkRes.headers }, body: "" };
  }
  return {
    status: tkRes.status,
    headers: { ...tkRes.headers, "Content-Type": "application/json" },
    body: JSON.stringify(tkRes.body),
  };
}

/**
 * 组装受限能力下的公共库运行态（DOMPurify 直通 + HTTP 邮件 + fs-free ip2region + BlobKV 数据库）。
 *
 * 为 async 的原因是 ip2region 的内联数据模块（6.06 MB base64）要**按需**加载：不查 IP 属地
 * 就不付解压代价；加载失败也不阻断请求 —— 只是不注入，回落既有降级路径（属地为空）。
 *
 * 邮件走 `customLibs.nodemailer` 覆写而非能力门：EO 不能裸 TCP，改发 SendGrid /
 * MailChannels 的 HTTP API 或经 Go SMTP Bridge 转发；覆写优先于能力门，所以
 * `eoCapabilities.mail` 的 `"restricted"` 表达的就是「能力存在但通道受限」。
 * @param store BlobKV store
 * @returns 数据库端口实现
 */
export async function prepareEoRuntime(store: BlobKvStoreLike): Promise<Database> {
  setCustomLibs({
    DOMPurify: {
      /**
       * domPurify: false → 注入直通 DOMPurify（内容原样返回，1.x 形态对齐）
       */
      sanitize: (dirty) => dirty,
    },
    // EO 无法建立 SMTP 连接（edge 运行时无裸 TCP），注入 HTTP 版 nodemailer
    nodemailer: createEoNodemailer(),
    // ip2region: true，但依赖 fs 版的 8.33MB db → 注入 fs-free 内存查询器
    // （覆写优先于能力门与动态加载，见 lib-loader 的 getIpToRegion）
    ...(await getIp2RegionOverride()),
  });
  return new BlobKvDatabase(store);
}

/** 创建 EO Makers 请求处理器（store 可注入供测试；缺省懒加载 @edgeone/pages-blob）。 */
export function createEoMakersFunc(
  options: { store?: BlobKvStoreLike } = {},
): (event: EoEventLike) => Promise<EoResult> {
  let store: BlobKvStoreLike | null = options.store ?? null;
  let sdkPromise: Promise<BlobKvStoreLike> | null = null;
  /** 注入优先；否则动态加载 @edgeone/pages-blob（强一致 store） */
  const getStore = async (): Promise<BlobKvStoreLike> => {
    if (store) return store;
    sdkPromise ??= (async () => {
      const specifier = "@edgeone/pages-blob";
      const blob = (await import(/* @vite-ignore */ specifier)) as unknown as {
        getStore(options: { name: string; consistency: string }): BlobKvStoreLike;
      };
      return blob.getStore({ name: "twikoo", consistency: "strong" });
    })();
    store = await sdkPromise;
    return store;
  };
  return async (event) => {
    const request = toTkRequest(event);
    // Bridge 上下文覆盖整个请求（含进程内不 await 的 postSubmit：邮件在那里发出，
    // 仍属同一异步上下文，因而能读到本次请求的 Bridge 候选地址）
    return withMailBridgeContext(createMailBridgeContext(request), async () => {
      const db = await prepareEoRuntime(await getStore());
      const handler = createHandler(
        scaffoldAdapters({
          request: {
            /** 请求恒等透传（归一化见 toTkRequest） */
            toTkRequest: () => request,
          },
          response: {
            /** TkResponse 恒等透传（序列化见 fromTkResponse） */
            fromTkResponse: (r: TkResponse) => r,
          },
          database: db,
          capabilities: eoCapabilities,
          // 后置副作用派发**刻意不传**：scaffoldAdapters 的默认实现即「进程内
          // 直调 postSubmit 服务且不 await」，与 1.x eo-makers
          // `postSubmit(...).catch(...)` 行为一致（见
          // src/server/eo-makers/cloud-functions/index.js）。
        }),
      );
      return fromTkResponse(await handler(request));
    });
  };
}

/** 装配缓存（handler 懒加载语义） */
let handlerFn: ((event: EoEventLike) => Promise<EoResult>) | null = null;

/** EO Makers 函数入口。 */
export async function handler(event: EoEventLike): Promise<EoResult> {
  handlerFn ??= createEoMakersFunc();
  return handlerFn(event);
}
