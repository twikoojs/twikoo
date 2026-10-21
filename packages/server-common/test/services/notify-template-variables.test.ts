/**
 * 邮件模板变量测试（#1248：文章标题 / 评论时间 / 回复时间）。
 * 独立文件：notify.ts 的 transporter 是进程级缓存，与同文件其他用例会互相污染。
 */
import { describe, expect, it } from "vitest";
import { sendNotice } from "../../src/services/notify";
import { FULL_CAPABILITIES } from "../../src/ports/capabilities";
import { setLibImporter } from "../../src/utils/lib-loader";
import { createRequestLogger } from "../../src/utils/logger";
import { createMemoryAdapters } from "../utils/memory-adapters";

describe("邮件模板变量（#1248）", () => {
  it("${POST_TITLE} / ${COMMENT_TIME} / ${REPLY_TIME}", async () => {
    /** 发出的邮件 */
    const sent: Array<Record<string, unknown>> = [];
    setLibImporter(async (specifier) => {
      if (specifier === "nodemailer") {
        return {
          default: {
            /** 创建传输器 */
            createTransport: () => ({
              /** 校验配置 */
              verify: async () => true,
              /** 记录发出的邮件 */
              sendMail: async (mail: Record<string, unknown>) => {
                sent.push(mail);
                return { messageId: `m${sent.length}` };
              },
            }),
          },
        };
      }
      throw new Error(`unexpected ${specifier}`);
    });
    /** 站点配置（两块模板都声明全部变量） */
    const config = {
      SMTP_SERVICE: "qq",
      SMTP_USER: "bot@test.com",
      SMTP_PASS: "pass",
      SENDER_NAME: "博主",
      SENDER_EMAIL: "bot@test.com",
      BLOGGER_EMAIL: "me@test.com",
      SITE_NAME: "测试站",
      SITE_URL: "https://x.test",
      MAIL_TEMPLATE: "标题:${POST_TITLE}|评论时间:${COMMENT_TIME}|回复时间:${REPLY_TIME}",
      MAIL_TEMPLATE_ADMIN: "标题:${POST_TITLE}|评论时间:${COMMENT_TIME}",
    };
    const db = createMemoryAdapters().database;
    const parent = await db.addComment({
      _id: "parent-t",
      nick: "路人",
      mail: "p@t.com",
      comment: "父",
      created: 1700000000000,
    });
    const comment = await db.addComment({
      _id: "child-t",
      nick: "张三",
      mail: "z@t.com",
      comment: "子",
      url: "/p/1",
      pid: parent._id,
      title: "测试文章",
      created: 1700000060000,
    });
    await sendNotice({
      comment,
      config,
      caps: FULL_CAPABILITIES,
      logger: createRequestLogger(),
      /** 取父评论 */
      getParentComment: async (c) => (c.pid ? db.getComment(c.pid) : null),
    });
    expect(sent).toHaveLength(2);
    const adminMail = sent.find((mail) => mail.to === "me@test.com");
    const replyMail = sent.find((mail) => mail.to === "p@t.com");
    expect(String(adminMail?.html)).toBe(
      `标题:测试文章|评论时间:${new Date(1700000060000).toLocaleString()}`,
    );
    expect(String(replyMail?.html)).toBe(
      `标题:测试文章|评论时间:${new Date(1700000000000).toLocaleString()}|回复时间:${new Date(1700000060000).toLocaleString()}`,
    );
  });
});
