/**
 * T38 验收用例：文档站语言自动探测（D-7 / U-3 / §11.2）。
 *
 * QA+：zh→root 留、en→/en/、有 localStorage 不跳、`?lang=` 覆盖、内页不跳；
 * QA−：去掉「已有记录 → 不跳」这道闸，两页会互跳（证明防循环靠它，且该断言真会红）。
 */
import { describe, expect, it } from "vitest";
import {
  EN_HOME,
  LANG_STORAGE_KEY,
  ROOT_HOME,
  homeForLang,
  isChineseLang,
  isHomePath,
  resolveLangRedirect,
} from "../.vitepress/theme/lang-detect";

describe("T38 语言探测纯判定", () => {
  it("中文浏览器留在 root（不跳）", () => {
    const r = resolveLangRedirect({ pathname: ROOT_HOME, navigatorLang: "zh-CN" });
    expect(r.target).toBeNull();
    expect(r.reason).toBe("zh-preference");
  });

  it("非中文浏览器从 root 跳 /en/", () => {
    for (const lang of ["en-US", "ja-JP", "ko-KR", "vi-VN", "id-ID", "uz-UZ"]) {
      const r = resolveLangRedirect({ pathname: ROOT_HOME, navigatorLang: lang });
      expect(r.target, `${lang} 应跳英文站`).toBe(EN_HOME);
      expect(r.reason).toBe("non-zh-preference");
    }
  });

  it("中文浏览器从 /en/ 首页回 root", () => {
    const r = resolveLangRedirect({ pathname: EN_HOME, navigatorLang: "zh-TW" });
    expect(r.target).toBe(ROOT_HOME);
  });

  it("有 localStorage 记录 → 一律不跳（防循环闸门）", () => {
    expect(
      resolveLangRedirect({ pathname: ROOT_HOME, stored: "en", navigatorLang: "zh-CN" }),
    ).toEqual({ target: null, reason: "stored" });
    expect(
      resolveLangRedirect({ pathname: EN_HOME, stored: "zh", navigatorLang: "en-US" }),
    ).toEqual({ target: null, reason: "stored" });
  });

  it("内页不参与自动跳转", () => {
    for (const path of ["/api", "/en/api", "/quick-start", "/backend.html"]) {
      expect(isHomePath(path)).toBe(false);
      expect(resolveLangRedirect({ pathname: path, navigatorLang: "en-US" }).target).toBeNull();
      expect(resolveLangRedirect({ pathname: path, navigatorLang: "zh-CN" }).target).toBeNull();
    }
  });

  it("`?lang=` 覆盖优先级最高（含已存记录的场景）", () => {
    expect(
      resolveLangRedirect({
        pathname: ROOT_HOME,
        search: "?lang=en",
        stored: "zh",
        navigatorLang: "zh-CN",
      }),
    ).toEqual({ target: EN_HOME, reason: "query-override" });
    expect(
      resolveLangRedirect({
        pathname: EN_HOME,
        search: "?lang=zh",
        stored: "en",
        navigatorLang: "en-US",
      }),
    ).toEqual({ target: ROOT_HOME, reason: "query-override" });
    // 目标即当前页 → 不跳
    expect(
      resolveLangRedirect({ pathname: ROOT_HOME, search: "?lang=zh-CN", navigatorLang: "en-US" })
        .target,
    ).toBeNull();
  });

  it("辅助判定：语言标签与首页路径", () => {
    expect(isChineseLang("zh")).toBe(true);
    expect(isChineseLang("ZH-Hans")).toBe(true);
    expect(isChineseLang("en-US")).toBe(false);
    expect(homeForLang("zh-HK")).toBe(ROOT_HOME);
    expect(homeForLang("en")).toBe(EN_HOME);
    expect(isHomePath("/")).toBe(true);
    expect(isHomePath("/index.html")).toBe(true);
    expect(isHomePath("/en/")).toBe(true);
    expect(isHomePath("/en/index.html")).toBe(true);
  });

  it("localStorage 键名为文档站专用前缀", () => {
    expect(LANG_STORAGE_KEY).toBe("twikoo-docs-lang");
  });
});

describe("T38 QA−：跳转循环必须被闸门挡住", () => {
  it("两条规则本身是互指的（去掉「已有记录」闸门即会 ping-pong）", () => {
    /** 无记录时：/en/ 首页 + 中文浏览器 → 回 root */
    expect(resolveLangRedirect({ pathname: EN_HOME, navigatorLang: "zh-CN" }).target).toBe(
      ROOT_HOME,
    );
    /** 无记录时：root 首页 + 英文浏览器 → 去 /en/ */
    expect(resolveLangRedirect({ pathname: ROOT_HOME, navigatorLang: "en-US" }).target).toBe(
      EN_HOME,
    );
  });

  it("落盘偏好后两个方向都不再跳（循环被切断）", () => {
    /** 模拟第一次跳转：root → /en/ 前写入 en */
    const first = resolveLangRedirect({ pathname: ROOT_HOME, navigatorLang: "en-US" });
    expect(first.target).toBe(EN_HOME);
    const stored = first.target === EN_HOME ? "en" : "zh";
    /** 到达 /en/ 后再次判定：命中 stored → 不跳回 root */
    expect(
      resolveLangRedirect({ pathname: EN_HOME, stored, navigatorLang: "zh-CN" }).target,
    ).toBeNull();
  });
});
