import { marked } from "marked";
import markdownToTxt from "markdown-to-txt";

export interface NoticeOptions {
  /**
   * Webhook通知方式的参数配置
   */
  webhook?: {
    /**
     * url 发送通知的地址
     */
    url: string;
    /**
     * method 请求方法，默认为 POST
     */
    method?: "GET" | "POST";
  };
  /**
   * bark通知方式的参数配置
   */
  bark?: {
    /**
     * url 用于点击通知后跳转的地址
     */
    url?: string;
    /**
     * 通知级别（active / timeSensitive / critical / passive）
     */
    level?: string;
    /**
     * 通知分组（同组通知在系统通知中心折叠展示）
     */
    group?: string;
    /**
     * 自定义图标地址
     */
    icon?: string;
    /**
     * 铃声名（Bark App 内置或自定义铃声）
     */
    sound?: string;
    /**
     * 角标数字
     */
    badge?: number | string;
    /**
     * 是否保存到通知历史（"1" 保存 / "0" 不保存）
     */
    isArchive?: "1" | "0";
  };
  /**
   * IFTTT通知方式的参数配置
   */
  ifttt?: {
    value1?: string;
    value2?: string;
    value3?: string;
  };
  /**
   * Discord通知方式的参数配置
   */
  discord?: {
    userName?: string;
    avatarUrl?: string;
  };
  /**
   * WxPusher通知方式的参数配置
   */
  wxpusher?: {
    uids?: string[];
    url?: string;
    verifyPay?: boolean;
  };
  /**
   * QMsg酱通知方式的参数配置
   */
  qmsg?: {
    qq?: string;
    url?: string;
    group?: boolean;
    bot?: string;
  };
  onebot?: {
    /**
     * 群号（群发时必填）
     */
    group_id?: number;
    /**
     * QQ号（私聊时必填）
     */
    user_id?: number;
    /**
     * 消息类型（group/private）
     */
    message_type?: string;
    access_token?: string;
  };
  dingtalk?: {
    /**
     * 消息类型，目前支持 text、markdown。不设置，默认为 text。
     */
    msgtype?: string;
  };
  /**
   * ntfy 通知方式的参数配置
   */
  ntfy?: {
    /**
     * 访问令牌（topic 受保护时使用，作为 Bearer 认证）
     */
    accessToken?: string;
    /**
     * 优先级，1-5 或 min/low/default/high/urgent
     */
    priority?: string | number;
    /**
     * 标签，逗号分隔
     */
    tags?: string;
    /**
     * 点击通知后跳转的地址
     */
    click?: string;
  };
}
export interface CommonOptions {
  token: string;
  title?: string;
  content: string;
  /**
   * 扩展选项
   */
  options?: NoticeOptions;
}

export type ChannelType =
  | "webhook"
  | "qmsg"
  | "serverchan"
  | "serverchain"
  | "pushplus"
  | "pushplushxtrip"
  | "dingtalk"
  | "wecom"
  | "bark"
  | "gocqhttp"
  | "onebot"
  | "atri"
  | "pushdeer"
  | "igot"
  | "telegram"
  | "feishu"
  | "lark"
  | "ifttt"
  | "wecombot"
  | "discord"
  | "wxpusher"
  | "ntfy"
  | "join";

function checkParameters(options: any, requires: string[] = []) {
  requires.forEach((require) => {
    if (!options[require]) {
      throw new Error(`${require} is required`);
    }
  });
}

/**
 * 发送请求：非 2xx 抛错（与 axios 一致），返回 { data, status } 供各渠道读取。
 *
 * 用原生 fetch 而非 axios，是为了能在 Cloudflare Workers 等只提供 Web 标准 API 的
 * 运行时里工作（axios 依赖 Node 的 http 模块）。
 * @param url 请求地址
 * @param init fetch 参数
 * @returns 响应数据与状态码
 */
async function sendRequest(
  url: string,
  init: RequestInit = {},
): Promise<{ data: any; status: number }> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`Request failed with status code ${response.status}`);
  }
  const text = await response.text();
  let data: any = text;
  try {
    data = text ? JSON.parse(text) : text;
  } catch {
    // 非 JSON 响应保持文本形态（与 axios 的 response.data 一致）
  }
  return { data, status: response.status };
}

/**
 * GET 请求（调用形态对齐 `axios.get(url, { params })`）。
 *
 * params 兼容普通对象与 URLSearchParams 两种形态（bark 传的是后者）。
 * @param url 请求地址
 * @param config 查询参数
 * @returns 响应数据与状态码
 */
function httpGet(
  url: string,
  config: { params?: Record<string, string> | URLSearchParams } = {},
) {
  const params = config.params;
  const entries =
    params instanceof URLSearchParams
      ? [...params]
      : (Object.entries(params ?? {}) as Array<[string, string]>);
  const queryString = new URLSearchParams(
    entries.filter(([, value]) => value !== undefined),
  ).toString();
  const requestUrl = queryString ? `${url}${url.includes("?") ? "&" : "?"}${queryString}` : url;
  return sendRequest(requestUrl, { method: "GET" });
}

/**
 * POST 请求（调用形态对齐 `axios.post(url, data, config)`）。
 *
 * 对象体走 JSON、字符串体走表单编码，与 axios 的默认推断一致——服务端常按
 * Content-Type 分流解析。
 * @param url 请求地址
 * @param body 请求体
 * @param config 请求头与超时（毫秒）
 * @returns 响应数据与状态码
 */
function httpPost(
  url: string,
  body?: unknown,
  config: { headers?: Record<string, string>; timeout?: number } = {},
) {
  const isStringBody = typeof body === "string";
  const headers: Record<string, string> = isStringBody
    ? { "Content-Type": "application/x-www-form-urlencoded", ...config.headers }
    : { "Content-Type": "application/json", ...config.headers };
  return sendRequest(url, {
    method: "POST",
    body: isStringBody ? body : JSON.stringify(body ?? {}),
    headers,
    signal: config.timeout ? AbortSignal.timeout(config.timeout) : undefined,
  });
}

function getHtml(content: string) {
  return marked.parse(content);
}

function getTxt(content: string) {
  return markdownToTxt(content);
}

function getTitle(content: string) {
  return getTxt(content).split("\n")[0];
}

function removeUrlAndIp(content: string) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const ipRegex = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/g;
  // 邮箱正则表达式来自 https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/email#validation
  const mailRegExp =
    /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*/g;
  return content.replace(urlRegex, "").replace(ipRegex, "").replace(mailRegExp, "");
}

/**
 * 自定义 Webhook 推送
 */
async function noticeWebhook(options: CommonOptions) {
  checkParameters(options, ["content"]);
  const method = options?.options?.webhook?.method || "POST";
  const url = options?.options?.webhook?.url;
  if (!url) {
    throw new Error("Webhook url is required");
  }
  if (method === "GET") {
    const params = new URLSearchParams({
      ...(options.token ? { token: options.token } : {}),
      ...(options.title ? { title: options.title } : {}),
      content: options.content,
    });
    const response = await httpGet(url, { params });
    return response.data;
  }
  if (method === "POST") {
    const payload: Record<string, any> = {
      ...(options.token && { token: options.token }),
      ...(options.title && { title: options.title }),
      content: options.content,
    };
    const response = await httpPost(url, payload);
    return response.data;
  }
  throw new Error(`Unsupported Webhook request method: ${method}`);
}

/**
 * https://qmsg.zendee.cn/
 */
async function noticeQmsg(options: CommonOptions) {
  checkParameters(options, ["token", "content"]);
  const url = options?.options?.qmsg?.url || "https://qmsg.zendee.cn";
  let msg = getTxt(options.content);
  if (options.title) {
    msg = `${options.title}\n${msg}`;
  }
  // 移除网址和 IP 以避免 Qmsg 酱被 Tencent 封号
  msg = removeUrlAndIp(msg);
  const param = new URLSearchParams({ msg });
  const qq = options?.options?.qmsg?.qq || false;
  if (qq) {
    param.append("qq", qq);
  }
  const bot = options?.options?.qmsg?.bot || false;
  if (bot) {
    param.append("bot", bot);
  }
  const group = options?.options?.qmsg?.group || false;
  const response = await httpPost(
    `${url}/${group ? "group" : "send"}/${options.token}`,
    param.toString(),
    {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    },
  );
  return response.data;
}

/**
 * https://github.com/Tianli0/push-bot-api/
 */
async function noticeAtri(options: CommonOptions) {
  checkParameters(options, ["token", "content"]);
  const url = "http://pushoo.tianli0.top/";
  let message = getTxt(options.content);
  if (options.title) {
    message = `${options.title}\n${message}`;
  }
  const param = new URLSearchParams({
    user_id: options.token,
    message,
  });
  const response = await httpPost(url, param.toString(), {
    headers: { "X-Requested-By": "pushoo" },
  });
  return response.data;
}

/**
 * Turbo: https://sct.ftqq.com/
 * V3: https://sc3.ft07.com/
 */
async function noticeServerChan(options: CommonOptions) {
  checkParameters(options, ["token", "content"]);
  let url: string;
  let param: URLSearchParams;
  if (options.token.startsWith("sctp")) {
    const sctpMatch = options.token.match(/^sctp(\d+)t/);
    if (!sctpMatch) throw new Error("invalid serverchan sctp token");
    url = `https://${sctpMatch[1]}.push.ft07.com/send`;
    param = new URLSearchParams({
      title: options.title || getTitle(options.content),
      desp: options.content,
    });
  } else if (options.token.substring(0, 3).toLowerCase() === "sct") {
    url = "https://sctapi.ftqq.com";
    param = new URLSearchParams({
      title: options.title || getTitle(options.content),
      desp: options.content,
    });
  } else {
    url = "https://sc.ftqq.com";
    param = new URLSearchParams({
      text: options.title || getTitle(options.content),
      desp: options.content,
    });
  }
  const response = await httpPost(`${url}/${options.token}.send`, param.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  return response.data;
}

/**
 * https://www.pushplus.plus/
 */
async function noticePushPlus(options: CommonOptions) {
  checkParameters(options, ["token", "content"]);
  const ppApiUrl = "http://www.pushplus.plus/send";
  const ppApiParam = {
    token: options.token,
    title: options.title || getTitle(options.content),
    content: options.content,
    template: "markdown",
  };
  const response = await httpPost(ppApiUrl, ppApiParam);
  return response.data;
}

/**
 * https://pushplus.hxtrip.com/
 */
async function noticePushPlusHxtrip(options: CommonOptions) {
  checkParameters(options, ["token", "content"]);
  const ppApiUrl = "http://pushplus.hxtrip.com/send";
  const ppApiParam = {
    token: options.token,
    title: options.title || getTitle(options.content),
    content: getHtml(options.content),
    template: "html",
  };
  const response = await httpPost(ppApiUrl, ppApiParam);
  return response.data;
}

/**
 * 文档: https://open.dingtalk.com/document/group/custom-robot-access
 * 教程: https://blog.ljcbaby.top/article/Twikoo-DingTalk/
 */
async function noticeDingTalk(options: CommonOptions) {
  checkParameters(options, ["token", "content"]);
  let url = "https://oapi.dingtalk.com/robot/send?access_token=";
  if (options.token.substring(0, 4).toLowerCase() === "http") {
    url = options.token;
  } else {
    url += options.token;
  }

  const msgtype = options.options?.dingtalk?.msgtype || "text";
  const content =
    msgtype === "text"
      ? (options.title ? `${options.title}\n` : "") + getTxt(options.content)
      : options.content;

  const msgBody: Record<string, unknown> = {
    msgtype,
  };

  if (msgtype === "text") {
    msgBody[msgtype] = { content };
  } else if (msgtype === "markdown") {
    msgBody[msgtype] = { title: options.title || getTitle(options.content), text: content };
  }
  const response = await httpPost(url, msgBody);
  return response.data;
}

/**
 * 文档: https://developer.work.weixin.qq.com/document/path/90236
 * 教程: https://sct.ftqq.com/forward
 */
async function noticeWeCom(options: CommonOptions) {
  checkParameters(options, ["token", "content"]);
  const [corpid, corpsecret, agentid, touser = "@all"] = options.token.split("#");
  checkParameters(
    {
      corpid,
      corpsecret,
      agentid,
    },
    ["corpid", "corpsecret", "agentid"],
  );
  // 获取 Access Token
  let accessToken;
  try {
    const accessTokenRes = await httpGet(
      `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${corpid}&corpsecret=${corpsecret}`,
    );
    accessToken = accessTokenRes.data.access_token;
  } catch (e) {
    console.error("获取企业微信 access token 失败，请检查 token", e);
    return {};
  }
  // 发送消息
  const url = `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${accessToken}`;
  let content = getTxt(options.content);
  if (options.title) {
    content = `${options.title}\n${content}`;
  }
  const param = {
    touser,
    msgtype: "text",
    agentid,
    text: { content },
  };
  const response = await httpPost(url, param);
  return response.data;
}

/**
 * https://github.com/Finb/Bark
 */
async function noticeBark(options: CommonOptions) {
  checkParameters(options, ["token", "content"]);
  let url = "https://api.day.app/";
  if (options.token.substring(0, 4).toLowerCase() === "http") {
    url = options.token;
  } else {
    url += options.token;
  }
  if (!url.endsWith("/")) url += "/";
  const title = encodeURIComponent(options.title || getTitle(options.content));
  const content = encodeURIComponent(getTxt(options.content));
  /** url 沿用 1.x：即使未配置也带上（行为基准）；其余可选参数有值才透传 */
  const params = new URLSearchParams({ url: options?.options?.bark?.url || "" });
  for (const [key, value] of Object.entries(options?.options?.bark ?? {})) {
    if (key === "url") continue;
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const response = await httpGet(`${url}${title}/${content}/`, { params });
  return response.data;
}

/**
 * 文档: https://docs.go-cqhttp.org/api/
 * 教程: https://twikoo.js.org/QQ_API.html
 */
async function noticeGoCqhttp(options: CommonOptions) {
  checkParameters(options, ["token", "content"]);
  const url = options.token;
  let message = getTxt(options.content);
  if (options.title) {
    message = `${options.title}\n${message}`;
  }
  const param = new URLSearchParams({ message });
  const response = await httpPost(url, param.toString());
  return response.data;
}

/**
 * 文档: https://github.com/botuniverse/onebot-11
 * 教程: https://ayakasuki.com/
 */
async function noticeNodeOnebot(options: CommonOptions) {
  checkParameters(options, ["token", "content"]);

  try {
    const urlObj = new URL(options.token);
    const { searchParams } = urlObj;

    const groupId = searchParams.get("group_id");
    const userId = searchParams.get("user_id");

    searchParams.delete("group_id");
    searchParams.delete("user_id");

    const apiUrl = urlObj.toString();

    const body: Record<string, any> = {
      message: options.title
        ? `${options.title}\n${getTxt(options.content)}`
        : getTxt(options.content),
    };

    if (groupId) body.group_id = Number(groupId);
    if (userId) body.user_id = Number(userId);

    const response = await httpPost(apiUrl, body, {
      timeout: 5000,
      headers: { "Content-Type": "application/json" },
    });

    if (response.data?.retcode !== 0) {
      throw new Error(`[${response.data.retcode}] ${response.data.status || "Unknown Error"}`);
    }

    return response.data;
  } catch (e: any) {
    console.error("[ONEBOT] 推送失败:", e.response?.data || e.message);
    throw new Error(`OneBot推送失败: ${e.message}`);
  }
}

async function noticePushdeer(options: CommonOptions) {
  checkParameters(options, ["token", "content"]);
  const url = "https://api2.pushdeer.com/message/push";
  const response = await httpPost(url, {
    pushkey: options.token,
    text: options.title || getTitle(options.content),
    desp: options.content,
  });
  return response.data;
}

async function noticeIgot(options: CommonOptions) {
  checkParameters(options, ["token", "content"]);
  const url = `https://push.hellyw.com/${options.token}`;
  const response = await httpPost(url, {
    title: options.title || getTitle(options.content),
    content: getTxt(options.content),
  });
  return response.data;
}

/**
 * 文档: https://core.telegram.org/method/messages.sendMessage
 * 教程: https://core.telegram.org/bots#3-how-do-i-create-a-bot
 */
async function noticeTelegram(options: CommonOptions) {
  checkParameters(options, ["token", "content"]);
  const [tgToken, chatId] = options.token.split("#");
  checkParameters(
    {
      tgToken,
      chatId,
    },
    ["tgToken", "chatId"],
  );
  let text = options.content.replace(/([*_])/g, "\\$1"); // * 和 _ 似乎需要转义，否则会抛出 400 Bad Request 以及消息显示不正常
  if (options.title) {
    text = `${options.title}\n\n${text}`;
  }
  const response = await httpPost(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
    text,
    chat_id: chatId,
    parse_mode: "Markdown",
  });
  return response.data;
}

/**
 * 飞书 / Lark 机器人推送：两端点仅开放平台 base URL 不同，其余请求语义一致。
 * @param baseUrl 开放平台 base URL
 * @param options 推送参数
 * @returns 接口返回体
 */
async function noticeFeishuBot(baseUrl: string, options: CommonOptions) {
  checkParameters(options, ["token", "content"]);
  const v1 = `${baseUrl}/open-apis/bot/hook/`;
  const v2 = `${baseUrl}/open-apis/bot/v2/hook/`;
  let url;
  let params;
  if (options.token.substring(0, 4).toLowerCase() === "http") {
    url = options.token;
  } else {
    url = v2 + options.token;
  }
  if (url.substring(0, v1.length) === v1) {
    params = {
      title: options.title || getTitle(options.content),
      text: getTxt(options.content),
    };
  } else {
    let text = getTxt(options.content);
    if (options.title) {
      text = `${options.title}\n${text}`;
    }
    params = {
      msg_type: "text",
      content: { text },
    };
  }
  const response = await httpPost(url, params);
  return response.data;
}

/**
 * https://www.feishu.cn/hc/zh-CN/articles/360024984973
 */
async function noticeFeishu(options: CommonOptions) {
  return noticeFeishuBot("https://open.feishu.cn", options);
}

/**
 * Lark（飞书国际版）：https://open.larksuite.com/
 */
async function noticeLark(options: CommonOptions) {
  return noticeFeishuBot("https://open.larksuite.com", options);
}

/**
 * https://ifttt.com/maker_webhooks
 * http://ift.tt/webhooks_faq
 */
async function noticeIfttt(options: CommonOptions) {
  checkParameters(options, ["token", "content"]);

  const [token, eventName] = options.token.split("#");
  checkParameters(
    {
      token,
      eventName,
    },
    ["token", "eventName"],
  );

  const url = `https://maker.ifttt.com/trigger/${eventName}/with/key/${token}`;

  const response = await httpPost(
    url,
    {
      value1: options.options?.ifttt?.value1 || getTxt(options.title || ""),
      value2: options.options?.ifttt?.value2 || getTxt(options.content),
      value3: options.options?.ifttt?.value3,
    },
    {
      headers: { "Content-Type": "application/json" },
    },
  );
  return response.data;
}

/**
 * 文档: https://developer.work.weixin.qq.com/document/path/91770
 * 教程: https://developer.work.weixin.qq.com/tutorial/detail/54
 */
async function noticeWecombot(options: CommonOptions) {
  checkParameters(options, ["token", "content"]);
  const url = `https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=${options.token}`;
  const content = getTxt(options.content);

  const response = await httpPost(
    url,
    {
      msgtype: "text",
      text: {
        content,
      },
    },
    {
      headers: { "Content-Type": "application/json" },
    },
  );

  return response.data;
}

/**
 * 文档：https://discord.com/developers/docs/resources/webhook#execute-webhook
 */
async function noticeDiscord(options: CommonOptions) {
  checkParameters(options, ["token", "content"]);
  const url = options.token.startsWith("https://")
    ? options.token
    : `https://discord.com/api/webhooks/${options.token.replace(/#/, "/")}`;

  const response = await httpPost(
    url,
    {
      content: options.content,
      username: options.options?.discord?.userName,
      avatar_url: options.options?.discord?.avatarUrl,
    },
    {
      headers: { "Content-Type": "application/json" },
    },
  );
  return `Delivered successfully, code ${response.status}.`;
}

/**
 * WXPusher 推送
 * 教程：https://wxpusher.zjiecode.com/admin/
 * 文档: https://wxpusher.zjiecode.com/docs/#/
 */
async function noticeWxPusher(options: CommonOptions) {
  checkParameters(options, ["token", "content"]);
  const url = "http://wxpusher.zjiecode.com/api/send/message";
  const [appToken, topicIds] = options.token.split("#");
  checkParameters({ appToken, topicIds }, ["appToken", "topicIds"]);

  const response = await httpPost(
    url,
    {
      appToken,
      content: options.content,
      summary: options.title || getTitle(options.content),
      contentType: 3,
      topicIds: topicIds.split(",").map((id) => Number(id)),
      uids: options?.options?.wxpusher?.uids || [],
      url: options?.options?.wxpusher?.url || "",
      verifyPayload: options?.options?.wxpusher?.verifyPay || false,
    },
    {
      headers: {
        "Content-Type": "application/json",
      },
    },
  );
  return response.data;
}

/**
 * Join 推送
 * 文档: https://joaoapps.com/join/api/
 */
async function noticeJoin(options: CommonOptions) {
  checkParameters(options, ["token", "content"]);
  const [apiKey, deviceId] = options.token.split("#");
  checkParameters({ apiKey, deviceId }, ["apiKey", "deviceId"]);

  const url = "https://joinjoaomgcd.appspot.com/_ah/api/messaging/v1/sendPush";
  const param = new URLSearchParams({
    apikey: apiKey,
    deviceId,
    title: options.title || getTitle(options.content),
    text: options.content,
  });
  const response = await httpPost(url, param.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  return response.data;
}

/**
 * 头部值编码：HTTP 头部只接受 latin1，非 ASCII 值按 RFC 2047 编码（ntfy 支持该形式）
 * @param value 原始头部值
 * @returns 可写入头部的值
 */
function encodeHeaderValue(value: string): string {
  if (/^[\x20-\x7e]*$/.test(value)) return value;
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  const base64 =
    typeof Buffer === "undefined" ? btoa(binary) : Buffer.from(bytes).toString("base64");
  return `=?UTF-8?B?${base64}?=`;
}

/**
 * ntfy 推送
 * 文档: https://docs.ntfy.sh/publish/
 * @param options 推送参数
 * @returns 接口返回体
 */
async function noticeNtfy(options: CommonOptions) {
  checkParameters(options, ["token", "content"]);
  // token 支持 topic 名（公共实例）或完整 URL（自建实例）
  const url = options.token.startsWith("http")
    ? options.token
    : `https://ntfy.sh/${options.token}`;
  const ntfy = options.options?.ntfy;
  const headers: Record<string, string> = {
    "Content-Type": "text/plain; charset=utf-8",
    Title: encodeHeaderValue(options.title || getTitle(options.content)),
  };
  if (ntfy?.priority !== undefined) headers.Priority = String(ntfy.priority);
  if (ntfy?.tags) headers.Tags = ntfy.tags;
  if (ntfy?.click) headers.Click = ntfy.click;
  if (ntfy?.accessToken) headers.Authorization = `Bearer ${ntfy.accessToken}`;
  const response = await httpPost(url, getTxt(options.content), { headers });
  return response.data;
}

async function notice(channel: ChannelType | string, options: CommonOptions) {
  try {
    let data: any;
    const noticeFn = {
      webhook: noticeWebhook,
      qmsg: noticeQmsg,
      serverchan: noticeServerChan,
      serverchain: noticeServerChan,
      pushplus: noticePushPlus,
      pushplushxtrip: noticePushPlusHxtrip,
      dingtalk: noticeDingTalk,
      wecom: noticeWeCom,
      bark: noticeBark,
      gocqhttp: noticeGoCqhttp,
      onebot: noticeNodeOnebot,
      atri: noticeAtri,
      pushdeer: noticePushdeer,
      igot: noticeIgot,
      telegram: noticeTelegram,
      feishu: noticeFeishu,
      lark: noticeLark,
      ifttt: noticeIfttt,
      wecombot: noticeWecombot,
      discord: noticeDiscord,
      wxpusher: noticeWxPusher,
      ntfy: noticeNtfy,
      join: noticeJoin,
    }[channel.toLowerCase()];
    if (noticeFn) {
      data = await noticeFn(options);
    } else if (
      typeof channel === "string" &&
      (channel.startsWith("http://") || channel.startsWith("https://"))
    ) {
      options.options = options.options || {};
      options.options.webhook = { url: channel };
      if (channel.endsWith(":GET")) {
        // hack: 如果 URL 以 :GET 结尾，则使用 GET 方法
        options.options.webhook.method = "GET";
        options.options.webhook.url = channel.slice(0, -4);
      }
      data = await noticeWebhook(options);
    } else {
      throw new Error(`<${channel}> is not supported`);
    }
    console.debug(`[PUSHOO] Send to <${channel}> result:`, data);
    return data;
  } catch (caught) {
    const e = caught instanceof Error ? caught : new Error(String(caught));
    console.error("[PUSHOO] Got error:", e.message);
    return { error: e };
  }
}

export default notice;

export {
  notice,
  noticeQmsg,
  noticeServerChan,
  noticePushPlus,
  noticePushPlusHxtrip,
  noticeDingTalk,
  noticeWeCom,
  noticeBark,
  noticeGoCqhttp,
  noticeNodeOnebot,
  noticeAtri,
  noticePushdeer,
  noticeIgot,
  noticeTelegram,
  noticeFeishu,
  noticeLark,
  noticeIfttt,
  noticeWecombot,
  noticeDiscord,
  noticeWxPusher,
  noticeNtfy,
  noticeJoin,
};
