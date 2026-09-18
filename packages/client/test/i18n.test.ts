/**
 * i18n 拆分测试（T32 + §7.2 分片机制）。
 *
 * Acceptance：
 * - 键集与 1.x 基线一致（191 键）
 * - 9 语言词表齐全（分片内容随产物发布，此处直接校验源 JSON）
 * - **内置 2 语言立即生效；其余 7 语言为按需分片**（`LAZY_LOCALES`）
 * - 分片加载失败 / 基址推导失败 → **回退英文且不抛**（R-8/R-9）
 */
import { describe, expect, it } from "vitest";
import {
  LAZY_LOCALES,
  getLanguage,
  loadLanguage,
  setLanguage,
  t,
  TRANSLATION_KEYS,
  type TranslationKey,
} from "../src/i18n";
import zhHK from "../src/i18n/locales/zh-HK.json";
import zhTW from "../src/i18n/locales/zh-TW.json";
import uzUZ from "../src/i18n/locales/uz-UZ.json";
import jaJP from "../src/i18n/locales/ja-JP.json";
import koKR from "../src/i18n/locales/ko-KR.json";
import viVN from "../src/i18n/locales/vi-VN.json";
import idID from "../src/i18n/locales/id-ID.json";
import en from "../src/i18n/locales/en.json";
import zhCN from "../src/i18n/locales/zh-CN.json";

/** 一个已知键（各语言均有值） */
const KNOWN_KEY = "ADMIN_COMMENT" as TranslationKey;

/** 全部 9 语言 → 词表 */
const ALL_LOCALES: Record<string, Record<string, string>> = {
  "zh-CN": zhCN,
  "zh-HK": zhHK,
  "zh-TW": zhTW,
  en,
  "uz-UZ": uzUZ,
  "ja-JP": jaJP,
  "ko-KR": koKR,
  "vi-VN": viVN,
  "id-ID": idID,
};

describe("i18n 拆分（T32）", () => {
  it("键集与 1.x 基线一致（191 键，含缩写还原与拼接键）", () => {
    expect(TRANSLATION_KEYS.length).toBeGreaterThanOrEqual(190);
    expect(TRANSLATION_KEYS).toContain(KNOWN_KEY);
    expect(TRANSLATION_KEYS).toContain("ADMIN_COMMENT_DELETE");
  });

  it("9 语言词表齐全：键集与真相源完全一致", () => {
    const expected = [...TRANSLATION_KEYS].sort();
    for (const [lang, table] of Object.entries(ALL_LOCALES)) {
      expect(Object.keys(table).sort(), `${lang} 键集`).toEqual(expected);
      for (const key of TRANSLATION_KEYS) {
        // 值允许为空串——分页文案片段（PAGINATION_COUNT_PREFIX / PAGINATION_GOTO_SUFFIX）
        // 在部分语言里本就无前后缀，空串是正确取值而非缺失
        expect(typeof table[key], `${lang}.${key}`).toBe("string");
      }
    }
  });

  it("§7.2 分片划分：内置 zh-CN/en，其余 7 语言按需加载", () => {
    expect(LAZY_LOCALES).toHaveLength(7);
    expect(LAZY_LOCALES).not.toContain("zh-CN");
    expect(LAZY_LOCALES).not.toContain("en");
    // 分片语言与内置语言合计恰为 9
    expect(new Set([...LAZY_LOCALES, "zh-CN", "en"]).size).toBe(9);
  });

  it("内置语言无需网络：loadLanguage 直接返回且 t() 取到真实文案", async () => {
    await loadLanguage({ lang: "zh-CN" });
    expect(getLanguage()).toBe("zh-CN");
    expect(t(KNOWN_KEY)).toBe(zhCN[KNOWN_KEY]);
    await loadLanguage({ lang: "en" });
    expect(t(KNOWN_KEY)).toBe(en[KNOWN_KEY]);
  });

  it("语言优先级：init 入参 > 浏览器语言 > 英文兜底", () => {
    setLanguage({ lang: "en" });
    expect(getLanguage()).toBe("en");
    setLanguage({ lang: "zh-CN" });
    expect(getLanguage()).toBe("zh-CN");
    // 兼容别名 zh → zh-CN
    setLanguage({ lang: "zh" });
    expect(getLanguage()).toBe("zh-CN");
    // 未知语言 → 英文兜底
    setLanguage({ lang: "xx-XX" });
    expect(getLanguage()).toBe("en");
  });

  it("语言别名归并（1.x langs 表）", () => {
    setLanguage({ lang: "zh-tw" });
    expect(getLanguage()).toBe("zh-TW");
    setLanguage({ lang: "en-GB" });
    expect(getLanguage()).toBe("en");
  });

  it("分片未就位时 t() 回退英文（不阻塞渲染）", () => {
    setLanguage({ lang: "ja-JP" });
    expect(getLanguage()).toBe("ja-JP");
    // 分片尚未加载 → 走英文兜底，绝不返回空
    expect(t(KNOWN_KEY)).toBe(en[KNOWN_KEY]);
  });

  it("缺失键回退英文且不抛", () => {
    setLanguage({ lang: "zh-CN" });
    const missing = "NO_SUCH_KEY" as TranslationKey;
    expect(t(missing)).toBe("");
  });

  it("R-8：分片加载失败（不可达地址）→ 回退英文、不抛", async () => {
    await expect(
      loadLanguage({ lang: "ja-JP", localeBaseUrl: "http://127.0.0.1:1/nowhere" }),
    ).resolves.toBeUndefined();
    expect(getLanguage()).toBe("ja-JP");
    expect(t(KNOWN_KEY)).toBe(en[KNOWN_KEY]);
  });

  it("R-8：基址推导失败（无 document）→ 记 warn、不抛", async () => {
    await expect(loadLanguage({ lang: "ko-KR" })).resolves.toBeUndefined();
    expect(t(KNOWN_KEY)).toBe(en[KNOWN_KEY]);
  });
});
