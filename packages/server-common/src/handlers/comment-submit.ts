/**
 * COMMENT_SUBMIT 事件处理器（1.x commentSubmit 全链路）。
 *
 * 步骤（1.x 注释原样保留）：
 * 1. 参数校验；2. 预检测垃圾评论（限流、验证码、人工审核、违禁词）；
 * 3. 保存到数据库；4. **派发** postSubmit 副作用（IM 通知、邮件通知、
 * 第三方垃圾检测）到独立执行单元——不等待其完成，见 `ports/post-submit.ts`
 * 的 PostSubmitDispatcher（1.x 各平台分别用 HTTP 递归 / callFunction /
 * 进程内直调，2.0 把这层平台差异收敛到适配器的 postSubmit 端口）。
 */
import type { CommentDoc } from "../ports/database";
import type { EventHandler } from "../core/types";
import { RES_CODE } from "../utils/constants";
import { validate } from "../utils/validate";
import { getDomPurify } from "../utils/lib-loader";
import { md5, sha256 } from "../utils/crypto";
import {
  addQQMailSuffix,
  equalsMail,
  getQQAvatar,
  isQQ,
  isValidEmail,
  normalizeMail,
} from "../services/comment-dto";
import { isAdmin } from "../services/user";
import {
  checkCapCaptcha,
  checkGeeTestCaptcha,
  checkTurnstileCaptcha,
  limitFilter,
  preCheckSpam,
} from "../services/spam";
// 静态导入而非 `await import(...)`：cap.ts 已被 cap-challenge.ts 静态引入（其处理器在
// handlers/index.ts 注册），构建器必然把它放进主 chunk，动态导入只会得到
// [INEFFECTIVE_DYNAMIC_IMPORT]（无法拆出独立 chunk）。@cap.js/server 是本包常规
// dependency（非 optional peer），无「未安装则加载失败」顾虑，故无需惰性装载。
import { createCap, databaseCapStorage, isBuiltinCap, validateToken } from "../services/cap";

/**
 * 安全字符串化（字段值非字符串时 JSON 化，避免 [object Object]）。
 * @param v 任意字段值
 * @returns 字符串
 */
function toStr(v: unknown): string {
  if (typeof v === "string") return v;
  if (v === undefined || v === null) return "";
  return JSON.stringify(v);
}

/**
 * 将评论转为数据库存储格式（1.x parse 逐字段对齐）。
 * @param ctx 请求上下文
 * @returns 存储形态评论
 */
async function parseCommentDoc(ctx: Parameters<EventHandler>[0]): Promise<CommentDoc> {
  const { config, accessToken, adapters, request } = ctx;
  const comment = request.body as Record<string, unknown>;
  const timestamp = Date.now();
  const isAdminUser = isAdmin(config, accessToken);
  const isBloggerMail = equalsMail(comment.mail, config.BLOGGER_EMAIL);
  if (isBloggerMail && !isAdminUser) {
    throw new Error("请先登录管理面板，再使用博主身份发送评论");
  }
  if (comment.mail && !isValidEmail(comment.mail)) {
    throw new Error("邮箱格式不合法");
  }
  const hashMethod = config.GRAVATAR_CDN === "cravatar.cn" ? md5 : sha256;
  // 反 XSS 消毒（domPurify 能力 / setCustomLibs 直通注入，1.x DOMPurify.sanitize 对齐）
  const DOMPurify = await getDomPurify(adapters.capabilities);
  const commentDo: CommentDoc = {
    uid: accessToken,
    nick: comment.nick ? toStr(comment.nick) : "匿名",
    mail: comment.mail ? toStr(comment.mail) : "",
    mailMd5: comment.mail ? hashMethod(normalizeMail(comment.mail)) : "",
    link: comment.link ? toStr(comment.link) : "",
    ua: comment.ua as string,
    ip: request.ip,
    master: isBloggerMail,
    url: comment.url as string,
    href: comment.href as string,
    comment: DOMPurify.sanitize(toStr(comment.comment), {
      FORBID_TAGS: ["style"],
      FORBID_ATTR: ["style"],
    }),
    pid: comment.pid ? toStr(comment.pid) : toStr(comment.rid),
    rid: comment.rid as string | undefined,
    isSpam: isAdminUser
      ? false
      : preCheckSpam(
          {
            comment: toStr(comment.comment),
            nick: toStr(comment.nick),
            link: comment.link as string,
            mail: comment.mail as string,
          },
          config,
          ctx.logger,
        ),
    created: timestamp,
    updated: timestamp,
  };
  if (typeof comment.mail === "string" && isQQ(comment.mail)) {
    commentDo.mail = addQQMailSuffix(comment.mail);
    commentDo.mailMd5 = hashMethod(normalizeMail(commentDo.mail));
    commentDo.avatar = (await getQQAvatar(comment.mail)) ?? undefined;
  }
  return commentDo;
}

/**
 * 验证码检测分发（1.x checkCaptcha 逐分支对齐）。
 * @param ctx 请求上下文
 */
async function checkCaptcha(ctx: Parameters<EventHandler>[0]): Promise<void> {
  const { config, adapters, request } = ctx;
  const comment = request.body as Record<string, unknown>;
  const provider = config.CAPTCHA_PROVIDER;
  if (provider === "Turnstile" && config.TURNSTILE_SITE_KEY && config.TURNSTILE_SECRET_KEY) {
    await checkTurnstileCaptcha({
      caps: adapters.capabilities,
      ip: request.ip,
      turnstileToken: comment.turnstileToken as string,
      turnstileTokenSecretKey: config.TURNSTILE_SECRET_KEY as string,
    });
  } else if (provider === "Geetest" && config.GEETEST_CAPTCHA_ID && config.GEETEST_CAPTCHA_KEY) {
    await checkGeeTestCaptcha({
      geeTestCaptchaId: config.GEETEST_CAPTCHA_ID as string,
      geeTestCaptchaKey: config.GEETEST_CAPTCHA_KEY as string,
      geeTestLotNumber: comment.geeTestLotNumber as string,
      geeTestCaptchaOutput: comment.geeTestCaptchaOutput as string,
      geeTestPassToken: comment.geeTestPassToken as string,
      geeTestGenTime: comment.geeTestGenTime as string,
    });
  } else if (provider === "Cap" && isBuiltinCap(config)) {
    if (!comment.capToken) {
      throw new Error("验证码 token 缺失，请刷新页面重试");
    }
    await checkCapCaptcha(
      {
        capToken: comment.capToken as string,
        cap: createCap(databaseCapStorage(adapters.database)),
      },
      validateToken as (cap: unknown, token: string) => Promise<boolean>,
    );
  } else if (provider === "Cap" && config.CAP_API_ENDPOINT && config.CAP_SECRET_KEY) {
    if (!comment.capToken) {
      throw new Error("验证码 token 缺失，请刷新页面重试");
    }
    await checkCapCaptcha({
      capToken: comment.capToken as string,
      capSecretKey: config.CAP_SECRET_KEY as string,
      capApiEndpoint: config.CAP_API_ENDPOINT as string,
    });
  } else if (provider === "Cap") {
    throw new Error(
      "Cap 验证码配置不完整：内嵌模式无需额外配置，外部模式需填写 CAP_API_ENDPOINT 与 CAP_SECRET_KEY",
    );
  } else if (provider) {
    throw new Error(`不支持的验证码类型: ${String(provider)}`);
  }
}

/**
 * COMMENT_SUBMIT：提交评论（校验 → 限流 → 验证码 → 预检 → 保存 → 副作用）。
 * @param ctx 请求上下文
 * @returns 提交响应（id 为新评论 id）
 */
export const commentSubmit: EventHandler = async (ctx) => {
  const res: Record<string, unknown> = {};
  const event = ctx.request.body;
  // 参数校验
  validate(event, ["url", "ua", "comment"]);
  // 频率限制
  await limitFilter({ db: ctx.adapters.database, config: ctx.config, ip: ctx.request.ip });
  // 验证码
  await checkCaptcha(ctx);
  // 预检测、转换
  const data = await parseCommentDoc(ctx);
  // 保存
  const comment = await ctx.adapters.database.addComment(data);
  res.id = comment._id;
  res.code = RES_CODE.SUCCESS;
  // 派发后置副作用（垃圾检测 + 通知）到独立执行单元，**不等待**其完成。
  // 内联 await 会导致两个问题：用户提交要等整条链跑完；超出云函数超时时间时
  // 整个调用失败——而评论其实已入库，客户端却报错、重试还会产生重复评论。
  ctx.logger.verbose("派发 POST_SUBMIT（垃圾检测 + 通知）");
  await ctx.adapters.postSubmit.dispatch(comment, ctx).catch((e: unknown) => {
    ctx.logger.error("POST_SUBMIT 派发失败", e instanceof Error ? e.message : String(e));
  });
  return res;
};
