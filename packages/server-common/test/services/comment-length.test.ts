/** 评论长度同时受可读文本和 HTML 上限约束，覆盖图片与分隔线的边界。 */
import { describe, expect, it } from "vitest";
import type { ConfigData } from "../../src/ports/database";
import { preCheckSpam } from "../../src/services/spam";
import { getHtmlToText } from "../../src/utils/lib-loader";
import { createRequestLogger } from "../../src/utils/logger";

const logger = createRequestLogger("comment-length");

describe("评论长度限制", () => {
  it("默认上限允许 500 字正文，HTML 未超限时不计标签和链接地址", async () => {
    const comment = `<p><a href="https://example.com/${"x".repeat(600)}">${"字".repeat(500)}</a></p>`;
    await expect(preCheckSpam({ comment, nick: "n" }, {}, logger)).resolves.toBe(false);
    await expect(
      preCheckSpam({ comment: `<p>${"字".repeat(501)}</p>`, nick: "n" }, {}, logger),
    ).rejects.toThrow("评论内容过长");
  });

  it.each([
    ["<p><strong>一二三四五六七八九十</strong>&amp;</p>", 11],
    ['<img src="https://example.com/image.png" alt=" 一二三四五六七八九十 "> ', 10],
    ['<img src="https://example.com/image.png">', 10],
    ['<img alt="   ">', 10],
    ["<hr>", 10],
  ])("按转换后的文本检查边界：%s", async (comment, length) => {
    await expect(
      preCheckSpam({ comment, nick: "n" }, { LIMIT_LENGTH: length }, logger),
    ).resolves.toBe(false);
    await expect(
      preCheckSpam({ comment, nick: "n" }, { LIMIT_LENGTH: length - 1 }, logger),
    ).rejects.toThrow("评论内容过长");
  });

  it.each([500, 1000])("HTML 长度最多为文本上限 %i 的十倍", async (length) => {
    const comment = `<p>${"字".repeat(length)}</p>`.padEnd(length * 10, " ");
    const config: ConfigData = length === 500 ? {} : { LIMIT_LENGTH: length };
    await expect(preCheckSpam({ comment, nick: "n" }, config, logger)).resolves.toBe(false);
    await expect(
      preCheckSpam({ comment: `${comment} `, nick: "n" }, config, logger),
    ).rejects.toThrow("评论内容过长");
  });

  it("上限为 0 时仍允许不限长评论", async () => {
    await expect(
      preCheckSpam({ comment: "字".repeat(5001), nick: "n" }, { LIMIT_LENGTH: 0 }, logger),
    ).resolves.toBe(false);
  });

  it("通知使用的默认转换规则仍跳过图片", async () => {
    const toText = await getHtmlToText();
    expect(toText('<p>正文<img src="https://example.com/image.png" alt="表情"></p>')).toBe("正文");
  });
});
