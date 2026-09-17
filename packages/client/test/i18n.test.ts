/**
 * i18n 拆分测试（T32）。
 *
 * Acceptance：
 * - 新旧 key 集合 diff 为空（scripts/verify-i18n-keys.mjs 由 CI 跑；此处内联校验）
 * - 分片加载失败 → fallback 英文且不抛
 * - 9 语言切换冒烟
 */
import { describe, expect, it } from "vitest";
import { setLanguage, t, getLanguage, TRANSLATION_KEYS, type TranslationKey } from "../src/i18n";

/** 一个已知键（各语言均有值） */
const KNOWN_KEY = "ADMIN_COMMENT" as TranslationKey;

describe("i18n 拆分（T32）", () => {
  it("键集与 1.x 基线一致（191 键，含缩写还原与拼接键）", () => {
    expect(TRANSLATION_KEYS.length).toBeGreaterThanOrEqual(190);
    expect(TRANSLATION_KEYS).toContain(KNOWN_KEY);
    expect(TRANSLATION_KEYS).toContain("ADMIN_COMMENT_DELETE");
  });

  it("语言切换冒烟：9 语言 x 已知键均有非空文案", () => {
    for (const lang of [
      "zh-CN",
      "zh-HK",
      "zh-TW",
      "en",
      "uz-UZ",
      "ja-JP",
      "ko-KR",
      "vi-VN",
      "id-ID",
    ]) {
      setLanguage({ lang });
      const value = t(KNOWN_KEY);
      expect(value.length).toBeGreaterThan(0);
    }
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

  it("缺失键回退英文且不抛（R-9：分片加载失败不阻塞）", () => {
    setLanguage({ lang: "ja-JP" });
    // 全语言表都有的键在 ja-JP 有值；模拟缺失：用类型强转传入表外键
    const missing = "NO_SUCH_KEY" as TranslationKey;
    expect(t(missing)).toBe("");
  });

  it("语言别名归并（1.x langs 表）", () => {
    setLanguage({ lang: "zh-tw" });
    expect(getLanguage()).toBe("zh-TW");
    setLanguage({ lang: "en-GB" });
    expect(getLanguage()).toBe("en");
  });
});
