/** 通知中的单路失败不能让请求生命周期提前结束，其他分支仍可能访问数据库。 */
import { afterEach, expect, it, vi } from "vitest";
import { sendNotice } from "../../src/services/notify";
import { FULL_CAPABILITIES } from "../../src/ports/capabilities";
import { resetCustomLibs, setCustomLibs, setLibImporter } from "../../src/utils/lib-loader";
import { createRequestLogger } from "../../src/utils/logger";

afterEach(() => {
  resetCustomLibs();
  vi.resetModules();
});

it("推送失败时仍等待 SMTP 校验、父评论读取和回复邮件完成", async () => {
  let releaseVerify!: () => void;
  const verify = new Promise<boolean>((resolve) => {
    releaseVerify = () => resolve(true);
  });
  let pushed!: () => void;
  const pushFailed = new Promise<void>((resolve) => {
    pushed = resolve;
  });
  const sent: unknown[] = [];
  setCustomLibs({
    nodemailer: {
      /** 邮件校验暂停，模拟慢速 SMTP 认证。 */
      createTransport: () => ({
        /** 等待测试放行连接。 */
        verify: () => verify,
        /** 记录最终完成的邮件。 */
        sendMail: async (mail) => {
          sent.push(mail);
        },
      }),
    },
  });
  setLibImporter(async (specifier) => {
    if (specifier === "html-to-text") return { compile: () => (html: string) => html };
    if (specifier === "pushoo")
      return {
        /** 推送先失败，不能取消仍在执行的回复通知。 */
        default: async () => {
          pushed();
          throw new Error("push unavailable");
        },
      };
    throw new Error(`unexpected ${specifier}`);
  });
  let databaseClosed = false;
  let parentRead = false;
  const logger = createRequestLogger();
  const error = vi.spyOn(logger, "error");
  const pending = sendNotice({
    comment: {
      _id: "reply",
      pid: "parent",
      mail: "reply@example.com",
      comment: "hello",
      url: "/p",
    },
    config: {
      SMTP_HOST: "smtp.example.com",
      SMTP_USER: "user",
      SMTP_PASS: "pass",
      SENDER_EMAIL: "blog@example.com",
      PUSHOO_CHANNEL: "bark",
      PUSHOO_TOKEN: "token",
    },
    caps: FULL_CAPABILITIES,
    logger,
    /** 生命周期结束后才读父评论会导致真实 MongoDB 报连接已关闭。 */
    getParentComment: async () => {
      if (databaseClosed) throw new Error("database closed prematurely");
      parentRead = true;
      return { _id: "parent", mail: "parent@example.com", comment: "parent" };
    },
  }).then(() => {
    databaseClosed = true;
  });
  try {
    await pushFailed;
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(databaseClosed).toBe(false);
    expect(parentRead).toBe(false);
    releaseVerify();
    await pending;
    expect(parentRead).toBe(true);
    expect(sent).toEqual([expect.objectContaining({ to: "parent@example.com" })]);
    expect(error).toHaveBeenCalledWith(
      "通知异常：",
      expect.objectContaining({ message: "push unavailable" }),
    );
  } finally {
    releaseVerify();
    await pending;
  }
});
