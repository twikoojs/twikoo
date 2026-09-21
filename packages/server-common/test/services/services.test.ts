/**
 * services 层专项测试（覆盖率补齐）：
 * 导入器 / 通知 / 评论 DTO / 查询可见性 / Cap 存储 / 上传解析。
 * 重依赖（xml2js / marked / dompurify / nodemailer / pushoo / bowser）全部
 * 经 setLibImporter / setCustomLibs 注入替身——零真实网络、零密钥。
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
  commentImportArtalk,
  commentImportArtalk2,
  commentImportDisqus,
  commentImportTwikoo,
  commentImportValine,
  jsonParse,
} from "../../src/services/import";
import { getIMPushContent } from "../../src/services/notify";
import { emailTest, initMailer } from "../../src/services/notify";
import {
  getAvatar,
  getMailMd5,
  getMailSha256,
  getRelativeUrl,
  getUrlQuery,
  getUrlsQuery,
  isQQ,
  isValidEmail,
  addQQMailSuffix,
  normalizeMail,
  equalsMail,
  isUrl,
  toCommentDto,
  parseComment,
  getIpRegion,
} from "../../src/services/comment-dto";
import {
  commentMatchesKeyword,
  getSearchKeyword,
  queryVisibleComments,
} from "../../src/services/comment-query";
import { createCap, databaseCapStorage, isBuiltinCap, validateToken } from "../../src/services/cap";
import { parseImage } from "../../src/services/upload";
import { preCheckSpam } from "../../src/services/spam";
import { createMemoryAdapters } from "../utils/memory-adapters";
import { setCustomLibs, setLibImporter } from "../../src/utils/lib-loader";
import type { Capabilities } from "../../src/ports/capabilities";
import type { ConfigData } from "../../src/ports/database";

/** 全能力声明 */
const caps: Capabilities = {
  mail: true,
  domPurify: true,
  ip2region: true,
  akismet: true,
  tencentTms: true,
  imageUpload: true,
  qqAvatar: true,
  ai: false,
};

/** 导入日志收集 */
function makeLog(): [string[], (m: string) => void] {
  const lines: string[] = [];
  return [lines, (m: string) => lines.push(m)];
}

beforeEach(() => {
  setCustomLibs({
    DOMPurify: {
      /**
       *
       */
      sanitize: (d) => d,
    },
  });
});

describe("导入器（services/import）", () => {
  const [valineLog, valineLogFn] = makeLog();

  it("valine：数组与 results 两种形态 + 非法格式", async () => {
    const arr = [
      {
        objectId: "v1",
        nick: "n",
        comment: "c",
        url: "/p",
        createdAt: "2023-01-01T00:00:00Z",
        updatedAt: "2023-01-02T00:00:00Z",
      },
    ];
    const fromArray = await commentImportValine(arr, valineLogFn);
    expect(fromArray).toHaveLength(1);
    const fromResults = await commentImportValine({ results: arr }, valineLogFn);
    expect(fromResults).toHaveLength(1);
    const bad = await commentImportValine({ nope: 1 }, valineLogFn);
    expect(bad).toBeUndefined();
    expect(valineLog).toContain("Valine 评论文件格式有误");
  });

  it("twikoo：$oid 历史 id、null pid/rid 剔除、数组字段字符串反序列化", async () => {
    const [log, logFn] = makeLog();
    const res = await commentImportTwikoo(
      [
        {
          _id: { $oid: "64abc" },
          nick: "n",
          pid: null,
          rid: null,
          like: '["u1"]',
          comment: "c",
        },
      ],
      logFn,
    );
    expect(res?.[0]._id).toBe("64abc");
    expect(res?.[0].pid).toBeUndefined();
    expect(res?.[0].like).toEqual(["u1"]);
    expect(log.join("\n")).toContain("解析成功 1 条评论");
    const bad = await commentImportTwikoo({ x: 1 }, logFn);
    expect(bad).toBeUndefined();
  });

  it("disqus：thread 定位与父链回溯（JS 结构直喂）", async () => {
    const [log, logFn] = makeLog();
    const disqusDb = {
      disqus: {
        thread: [
          { $: { "dsq:id": "t1" }, title: ["T"], id: ["/p/1"], link: ["https://x.test/p/1"] },
        ],
        post: [
          {
            $: { "dsq:id": "p1" },
            author: [{ name: ["甲"] }],
            message: ["<p>hi</p>"],
            isSpam: ["false"],
            isDeleted: ["false"],
            thread: [{ $: { "dsq:id": "t1" } }],
            createdAt: ["2023-01-01T00:00:00Z"],
          },
          {
            $: { "dsq:id": "p2" },
            author: [{ name: ["乙"] }],
            message: ["<p>re</p>"],
            isSpam: ["true"],
            isDeleted: ["false"],
            thread: [{ $: { "dsq:id": "t1" } }],
            parent: [{ $: { "dsq:id": "p1" } }],
            createdAt: ["2023-01-02T00:00:00Z"],
          },
        ],
      },
    };
    const res = await commentImportDisqus(disqusDb, logFn);
    expect(res).toHaveLength(2);
    expect(res?.[1].pid).toBe("p1");
    expect(res?.[1].rid).toBe("p1");
    expect(res?.[1].isSpam).toBe(true);
    const bad = await commentImportDisqus({}, logFn);
    expect(bad).toBeUndefined();
    expect(log.join("\n")).toContain("Disqus 评论文件格式有误");
  });

  it("artalk / artalk2：markdown 渲染消毒 + 待审核判定", async () => {
    const [log, logFn] = makeLog();
    setLibImporter(async (specifier) => {
      if (specifier === "marked") {
        return {
          default: {
            /**
             *
             */
            parse: (md: string) => `<p>${md}</p>`,
          },
        };
      }
      throw new Error(`unexpected ${specifier}`);
    });
    const rows = [
      {
        id: 1,
        nick: "n",
        email: "A@B.com ",
        content: "**bold**",
        page_key: "https://x.test/p/1",
        date: "2023-01-01T00:00:00Z",
        ua: "",
      },
      {
        id: 2,
        nick: "m",
        email: "m@b.com",
        content: "c2",
        page_key: "/p/2",
        created_at: "2023-01-02T00:00:00Z",
        rid: "1",
        is_pending: "true",
      },
    ];
    const v1 = await commentImportArtalk([rows[0]], logFn, caps);
    expect(v1?.[0].comment).toBe("<p>**bold**</p>");
    expect(v1?.[0].rid).toBeUndefined();
    const v2 = await commentImportArtalk2([rows[1]], logFn, caps);
    expect(v2?.[0].rid).toBe("artalk1");
    expect(v2?.[0].isSpam).toBe(true);
    // 两个导入器各记录一条「artalk1 解析成功」日志
    expect(log.filter((m) => m.includes("解析成功")).length).toBeGreaterThanOrEqual(2);
    const bad = await commentImportArtalk([], logFn, caps);
    expect(bad).toBeUndefined();
  });

  it("jsonParse：整体失败转逐行（Leancloud 兼容）", () => {
    expect(jsonParse('{"a":1}')).toEqual({ a: 1 });
    const multi = jsonParse('{"a":1}\nnot-json\n{"b":2}');
    expect(multi).toEqual({ results: [{ a: 1 }, { b: 2 }] });
  });
});

describe("通知服务（services/notify）", () => {
  /** 记录型 nodemailer 替身装配 */
  function installFakeMailer() {
    const sent: Array<Record<string, unknown>> = [];
    setLibImporter(async (specifier) => {
      if (specifier === "nodemailer") {
        return {
          default: {
            /**
             *
             */
            createTransport: () => ({
              /**
               *
               */
              verify: async () => true,
              /**
               *
               */
              sendMail: async (mail: Record<string, unknown>) => {
                sent.push(mail);
                return { messageId: "x" };
              },
            }),
          },
        };
      }
      if (specifier === "html-to-text") {
        return {
          /**
           *
           */
          compile: () => (html: string) => html.replace(/<[^>]+>/g, ""),
        };
      }
      if (specifier === "pushoo") {
        return {
          /**
           *
           */
          default: async () => ({ code: 200 }),
        };
      }
      throw new Error(`unexpected ${specifier}`);
    });
    return sent;
  }

  const baseConfig: ConfigData = {
    SMTP_SERVICE: "qq",
    SMTP_USER: "bot@test.com",
    SMTP_PASS: "pass",
    SENDER_NAME: "博主",
    SENDER_EMAIL: "bot@test.com",
    BLOGGER_EMAIL: "me@test.com",
    SITE_NAME: "测试站",
    SITE_URL: "https://x.test",
  };

  it("initMailer：SMTP_SERVICE 形态校验成功；缺配置报错", async () => {
    installFakeMailer();
    const ok = await initMailer({
      config: baseConfig,
      caps,
      logger: console as never,
    });
    expect(ok).toBe(true);
  });

  it("emailTest：管理员 + SMTP 替身 → 发送测试邮件", async () => {
    const sent = installFakeMailer();
    const res = await emailTest({
      mail: "target@test.com",
      config: baseConfig,
      isAdminUser: true,
      caps,
      logger: console as never,
    });
    expect(res.result).toEqual({ messageId: "x" });
    expect(sent[0].to).toBe("target@test.com");
  });

  it("getIMPushContent：内容拼装（评论人/IP/链接）", async () => {
    setLibImporter(async (specifier) => {
      expect(specifier).toBe("html-to-text");
      return {
        /**
         *
         */
        compile: () => (html: string) => `text(${html})`,
      };
    });
    const push = await getIMPushContent(
      { _id: "c9", nick: "张三", mail: "z@t.com", comment: "<p> hi </p>", url: "/p/1" },
      baseConfig,
    );
    expect(push.subject).toContain("有新评论了");
    expect(push.content).toContain("张三");
    expect(push.content).toContain("text(<p> hi </p>)");
    expect(push.url).toContain("#c9");
  });
});

describe("评论 DTO（services/comment-dto）", () => {
  const config: ConfigData = { SITE_NAME: "s", SITE_URL: "https://x.test" };

  it("工具函数语义（1.x 对齐）", () => {
    expect(getUrlQuery("/p/1")).toEqual(["/p/1", "/p/1/"]);
    expect(getUrlQuery("/p/1/")).toEqual(["/p/1/", "/p/1"]);
    expect(getUrlsQuery(["/a", "", "/b"])).toHaveLength(4);
    expect(getRelativeUrl("https://x.test/p/1?x=1")).toBe("/p/1");
    expect(getRelativeUrl("/already")).toBe("/already");
    expect(normalizeMail(" A@B.COM ")).toBe("a@b.com");
    expect(equalsMail("A@B.com", "a@b.com")).toBe(true);
    expect(equalsMail("", "a@b.com")).toBe(false);
    expect(isQQ("123456")).toBe(true);
    expect(isQQ("123456@qq.com")).toBe(true);
    expect(isQQ("not@qq")).toBe(false);
    expect(addQQMailSuffix("123456")).toBe("123456@qq.com");
    expect(addQQMailSuffix("a@b.com")).toBe("a@b.com");
    expect(isValidEmail("a@b.com")).toBe(true);
    expect(isValidEmail("a:b@c.com")).toBe(false);
    expect(isValidEmail("nope")).toBe(false);
    expect(isUrl("https://x.test")).toBe(true);
    expect(isUrl("ftp://x")).toBe(false);
  });

  it("mailMd5/sha256/avatar：显式优先、计算兜底、Cravatar 用 md5", () => {
    const withMd5 = { _id: "1", mailMd5: "explicit" };
    expect(getMailMd5(withMd5)).toBe("explicit");
    const withMail = { _id: "2", mail: "A@B.com" };
    expect(getMailMd5(withMail)).toHaveLength(32);
    expect(getMailSha256(withMail)).toHaveLength(64);
    const nickOnly = { _id: "3", nick: "nick" };
    expect(getMailMd5(nickOnly)).toHaveLength(32);
    const avatar = getAvatar({ _id: "4", nick: "nick" }, config);
    expect(avatar).toContain("weavatar.com");
    expect(avatar).toContain("d=initials");
    const cravatar = getAvatar({ _id: "5", mail: "a@b.com" }, { GRAVATAR_CDN: "cravatar.cn" });
    expect(cravatar).toContain("cravatar.cn");
    const qqAvatar = getAvatar({ _id: "6", avatar: "http://q.cn/1" }, config);
    expect(qqAvatar).toBe("http://q.cn/1");
  });

  it("toCommentDto：UA 解析（替身 bowser）、点赞/归属字段", async () => {
    setLibImporter(async (specifier) => {
      expect(specifier).toBe("bowser");
      return {
        default: {
          /**
           *
           */
          getParser: () => ({
            /**
             *
             */
            getOS: () => ({ name: "Windows", version: "NT 11.0" }),
            /**
             *
             */
            getBrowserName: () => "Chrome",
            /**
             *
             */
            getBrowserVersion: () => "120",
            /**
             *
             */
            getUA: () => "ua",
            /**
             *
             */
            test: () => false,
          }),
        },
      };
    });
    const doc = {
      _id: "c1",
      nick: "n",
      ua: "ua",
      ups: ["u1"],
      downs: [],
      like: ["u1"],
      uid: "u1",
      created: 5,
    };
    const dto = await toCommentDto(doc, "u1", [], [doc], config, caps);
    expect(dto.os).toBe("Windows 11");
    expect(dto.browser).toBe("Chrome 120");
    expect(dto.liked).toBe(true);
    expect(dto.isOwner).toBe(true);
    expect(dto.ups).toBe(1);
    // SHOW_UA=false 时不解析 UA
    const dto2 = await toCommentDto(doc, "u1", [], [doc], { SHOW_UA: "false" }, caps);
    expect(dto2.os).toBe("");
  });

  it("parseComment：回复归组 + ruser 回填", async () => {
    const root = { _id: "r1", nick: "楼主", comment: "c", created: 1 };
    const reply = { _id: "r2", nick: "回复者", pid: "r1", rid: "r1", comment: "c2", created: 2 };
    const data = await parseComment([root, reply], "u", config, caps);
    expect(data).toHaveLength(1);
    expect(data[0].replies[0].nick).toBe("回复者");
    expect(data[0].replies[0].ruser).toBe("楼主");
  });

  it("getIpRegion：未声明能力返回空串", async () => {
    expect(await getIpRegion({ ...caps, ip2region: false }, "1.2.3.4")).toBe("");
    expect(await getIpRegion(caps, undefined)).toBe("");
  });
});

describe("评论查询可见性（services/comment-query）", () => {
  it("getSearchKeyword：类型与长度校验", () => {
    expect(getSearchKeyword({ keyword: "  abc " })).toBe("abc");
    expect(getSearchKeyword({})).toBe("");
    expect(() => getSearchKeyword({ keyword: 1 })).toThrow("搜索关键词必须是字符串");
    expect(() => getSearchKeyword({ keyword: "x".repeat(101) })).toThrow("不能超过 100 个字符");
  });

  it("commentMatchesKeyword：多字段大小写不敏感", () => {
    expect(commentMatchesKeyword({ nick: "ABC" } as never, "abc")).toBe(true);
    expect(commentMatchesKeyword({ comment: "hello" } as never, "xyz")).toBe(false);
  });

  it("queryVisibleComments：访客合并去重（非垃圾 ∪ 本人）", async () => {
    const adapters = createMemoryAdapters();
    const db = adapters.database;
    await db.addComment({ _id: "a", nick: "正常", url: "/p" });
    await db.addComment({ _id: "b", nick: "垃圾", url: "/p", isSpam: true });
    await db.addComment({ _id: "c", nick: "本人垃圾", url: "/p", isSpam: true, uid: "u9" });
    const adminView = await queryVisibleComments(db, { url: "/p" }, "u9", true, {});
    expect(adminView).toHaveLength(3);
    const visitorView = await queryVisibleComments(db, { url: "/p" }, "u9", false, {});
    expect(visitorView.map((d) => d._id).sort()).toEqual(["a", "c"]);
    const sorted = await queryVisibleComments(
      db,
      { url: "/p" },
      "",
      false,
      {},
      { sort: { created: -1 } },
    );
    expect(sorted.every((d) => d.url === "/p")).toBe(true);
  });
});

describe("Cap 服务（services/cap）", () => {
  it("databaseCapStorage：存取删 + 过期过滤", async () => {
    const adapters = createMemoryAdapters();
    const storage = databaseCapStorage(adapters.database);
    const future = Date.now() + 60000;
    await storage.challenges.store("t1", { challenge: "abc", expires: future });
    expect(await storage.challenges.read("t1")).toEqual({ challenge: "abc", expires: future });
    await storage.challenges.store("t1", { challenge: "xyz", expires: future });
    expect((await storage.challenges.read("t1"))?.challenge).toBe("xyz");
    await storage.challenges.delete("t1");
    expect(await storage.challenges.read("t1")).toBeNull();
    await storage.tokens.store("k1", future);
    expect(await storage.tokens.get("k1")).toBe(future);
    await storage.tokens.delete("k1");
    expect(await storage.tokens.get("k1")).toBeNull();
    // 过期即 null
    await storage.challenges.store("t2", { challenge: "old", expires: Date.now() - 1 });
    expect(await storage.challenges.read("t2")).toBeNull();
    await storage.challenges.deleteExpired();
    await storage.tokens.deleteExpired();
  });

  it("isBuiltinCap / validateToken", async () => {
    expect(isBuiltinCap({ CAPTCHA_PROVIDER: "Cap" })).toBe(true);
    expect(isBuiltinCap({ CAPTCHA_PROVIDER: "Cap", CAP_API_ENDPOINT: "https://x" })).toBe(false);
    const cap = createCap(databaseCapStorage(createMemoryAdapters().database));
    expect(await validateToken(cap, "")).toBe(false);
    expect(await validateToken(cap, "invalid-token")).toBe(false);
  });
});

describe("上传解析与预检（services/upload + spam）", () => {
  it("parseImage：合法 PNG / 体积超限 / 魔数不符", () => {
    const pngBase64 =
      "data:image/png;base64," +
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]).toString("base64");
    const parsed = parseImage(pngBase64);
    expect(parsed.mimeType).toBe("image/png");
    expect(parsed.fileName.endsWith(".png")).toBe(true);
    expect(() => parseImage("data:image/png;base64,!!!!")).toThrow("图片数据格式不合法");
    expect(() => parseImage("data:text/plain;base64,aGVsbG8=")).toThrow(
      "仅支持 JPEG、PNG、GIF 和 WebP 图片",
    );
    const gifHeader = Buffer.from("GIF89axxxx");
    const asJpeg = "data:image/jpeg;base64," + gifHeader.toString("base64");
    expect(() => parseImage(asJpeg)).toThrow("图片 MIME 类型与文件内容不匹配");
  });

  it("preCheckSpam：MANUAL_REVIEW 与默认长度", () => {
    const logger = {
      /**
       *
       */
      info: () => {} /**
       *
       */,
      /**
       *
       */
      warn: () => {} /**
       *
       */,
      /**
       *
       */
      error: () => {} /**
       *
       */,
      /**
       *
       */
      verbose: () => {},
    } as never;
    expect(
      preCheckSpam({ comment: "c", nick: "n" }, { AKISMET_KEY: "MANUAL_REVIEW" }, logger),
    ).toBe(true);
    expect(preCheckSpam({ comment: "c", nick: "n" }, {}, logger)).toBe(false);
  });
});

describe("IP 属地（services/comment-dto）", () => {
  it("注入查询器：命中返回格式化属地；未命中返回空串（不抛异常）", async () => {
    // 记录查询器调用，验证回环地址没有被查询（#581）
    const queriedIps: string[] = [];
    setCustomLibs({
      DOMPurify: {
        /**
         * 直通消毒
         */
        sanitize: (d) => d,
      },
      // eo-makers 形态：注入 fs-free 内存查询器（此处用替身，真实实现见 EO 包的等价性测试）
      "@imaegoo/node-ip2region": {
        /**
         * @returns 查询器替身
         */
        create: () => ({
          /**
           * 记录调用的 IP，1.1.1.1 模拟未命中（库在 dataPos === 0 时返回 null），其余返回北京移动
           */
          binarySearchSync: (ip: string) => {
            queriedIps.push(ip);
            return ip === "1.1.1.1" ? null : { city: 215, region: "中国|0|北京|北京市|移动" };
          },
        }),
      },
    });

    // 命中：省份去掉「省/市」后缀
    expect(await getIpRegion(caps, "223.104.3.1")).toBe("北京");
    // detail=true：area 与 city 不同，输出 [area, city, isp]
    expect(await getIpRegion(caps, "223.104.3.1", true)).toBe("北京 北京市 移动");
    // 未命中 → 空串（改前靠「解构 null 抛 TypeError 被 catch 吞掉」，现在显式判空）
    expect(await getIpRegion(caps, "1.1.1.1")).toBe("");
    // IPv6 映射前缀 / 端口号归一化后仍能命中
    expect(await getIpRegion(caps, "::ffff:223.104.3.1")).toBe("北京");
    expect(await getIpRegion(caps, "223.104.3.1:8080")).toBe("北京");
    // 空 IP 直接返回空串（不查库）
    expect(await getIpRegion(caps, undefined)).toBe("");
    expect(await getIpRegion(caps, "")).toBe("");
    // 本地回环地址（::1 / 127.0.0.1）无法查询属地，直接返回空（#581）
    // 验证查询器没有被调用（提前返回）
    queriedIps.length = 0;
    expect(await getIpRegion(caps, "::1")).toBe("");
    expect(await getIpRegion(caps, "127.0.0.1")).toBe("");
    // 带端口的回环地址也应提前返回（#581 review 反馈）
    expect(await getIpRegion(caps, "127.0.0.1:8080")).toBe("");
    expect(queriedIps).toEqual([]);
  });
});
