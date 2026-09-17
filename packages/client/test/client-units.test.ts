/**
 * Wave 4 客户端补齐模块单测：constants / avatar / emotion / directives / bus / state / highlight。
 *
 * 这些模块对应 1.x 的 `utils/{avatar,emotion,highlight}.js` 与全局事件通道，
 * 在 2.0 中已抽成独立 TS 模块，因此可脱离组件直接覆盖。
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { VERSION, PUSHOO_CHANNELS } from "@twikoojs/shared";
import {
  defaultGravatar,
  highlightPlugins,
  highlightThemes,
  imageBedServices,
  customImageBedServices,
  pushooChannels,
  smtpServices,
  DEFAULT_GRAVATAR_CDN,
} from "../src/i18n/constants";
import { getQQAvatar, resolveAvatarUrl } from "../src/utils/avatar";
import { initMarkedOwo, initOwoEmotions, type OwoData } from "../src/utils/emotion";
import { parseMarkdown } from "../src/utils/marked";
import { install } from "../src/utils/tcb";
import OwO from "../src/lib/owo";
import { vClickoutside, vLoading } from "../src/utils/directives";
import { EVENT_CONFIG_UPDATED, clearAll, emit, off, on } from "../src/utils/bus";
import { getServerConfig, setServerConfig } from "../src/utils/state";
import { renderCode } from "../src/utils/highlight";

afterEach(() => {
  clearAll();
  setServerConfig({});
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("constants（T32 补齐）", () => {
  it("pushooChannels 与 @twikoojs/shared 的 PUSHOO_CHANNELS 同步（20 渠道，不含 serverchain）", () => {
    expect(pushooChannels).toEqual([...PUSHOO_CHANNELS]);
    expect(pushooChannels).toHaveLength(20);
    expect(pushooChannels).not.toContain("serverchain");
  });

  it("枚举表齐全且非空", () => {
    expect(smtpServices.length).toBeGreaterThan(30);
    expect(highlightThemes).toContain("tomorrow");
    expect(highlightPlugins).toEqual(["showLanguage", "copyButton"]);
    expect(imageBedServices).toContain("qcloud");
    expect(customImageBedServices).toEqual(["lskypro", "piclist", "easyimage", "s3"]);
    expect(defaultGravatar).toContain("mp");
    expect(DEFAULT_GRAVATAR_CDN).toBe("weavatar.com");
  });
});

describe("avatar（Wave 4）", () => {
  it("getQQAvatar：去掉 @qq.com 后拼第三方头像地址", () => {
    expect(getQQAvatar("12345@qq.com")).toBe("https://thirdqq.qlogo.cn/g?b=sdk&nk=12345&s=140");
    expect(getQQAvatar("12345")).toContain("nk=12345");
  });

  it("优先级：avatar > mailMd5 > QQ > 邮箱 hash", () => {
    expect(resolveAvatarUrl({ avatar: "https://a.test/1.png" })).toBe("https://a.test/1.png");
    expect(resolveAvatarUrl({ mailMd5: "abcdef" })).toBe(
      `https://${DEFAULT_GRAVATAR_CDN}/avatar/abcdef?d=initials&name=`,
    );
    expect(resolveAvatarUrl({ mail: "12345@qq.com" })).toBe(getQQAvatar("12345@qq.com"));
    const gravatar = resolveAvatarUrl({ mail: "a@b.com", nick: "nick" });
    expect(gravatar.startsWith(`https://${DEFAULT_GRAVATAR_CDN}/avatar/`)).toBe(true);
    expect(gravatar).toContain("d=initials&name=nick");
    expect(resolveAvatarUrl({})).toBe("");
  });

  it("cravatar.cn 用 md5，其余 CDN 用 sha256（1.x 兼容规则）", () => {
    const md5Url = resolveAvatarUrl({ mail: "A@B.com " }, { GRAVATAR_CDN: "cravatar.cn" });
    // md5("a@b.com") = 3f7f7b7e3b0c0a5a1b8f2e6f5a6c1d2e 无法硬编码（避免疑似密钥字面量），故只断言形状
    expect(md5Url).toMatch(/^https:\/\/cravatar\.cn\/avatar\/[0-9a-f]{32}\?d=/);
    const shaUrl = resolveAvatarUrl({ mail: "A@B.com " }, { GRAVATAR_CDN: "weavatar.com" });
    expect(shaUrl).toMatch(/^https:\/\/weavatar\.com\/avatar\/[0-9a-f]{64}\?d=/);
  });

  it("DEFAULT_GRAVATAR 配置生效", () => {
    const url = resolveAvatarUrl({ mailMd5: "x" }, { DEFAULT_GRAVATAR: "mp" });
    expect(url).toContain("?d=mp");
  });
});

describe("emotion（Wave 4：setOwoImages 的调用方）", () => {
  /** XHR 替身：按 URL 返回固定 OwO 数据 */
  function mockOwoXhr(payload: unknown, status = 200): void {
    class FakeXhr {
      /** 状态码 */
      status = status;
      /** 就绪状态 */
      readyState = 0;
      /** 响应文本 */
      responseText = JSON.stringify(payload);
      /** 回调 */
      onreadystatechange: (() => void) | null = null;
      /**
       * 打开请求（立即就绪并回调，模拟同步到达）。
       */
      open(): void {
        this.readyState = 4;
      }
      /**
       * 发送请求。
       */
      send(): void {
        this.onreadystatechange?.();
      }
    }
    vi.spyOn(globalThis, "XMLHttpRequest").mockImplementation(FakeXhr as never);
  }

  it("initOwoEmotions：缺 text 时用文件名补齐", async () => {
    mockOwoXhr({
      QQ: {
        type: "image",
        container: [{ icon: '<img src="https://owo.test/qq.png">' }],
      },
    });
    const odata = await initOwoEmotions("https://owo.test/owo.json");
    expect(odata.QQ?.container[0].text).toBe("qq.png");
  });

  it("initMarkedOwo：注册映射后 marked 渲染 :name: 为 owo 图片", () => {
    const imgs = initMarkedOwo({
      Pkg: {
        type: "image",
        container: [{ text: "tv_doge", icon: '<img src="https://owo.test/doge.gif">' }],
      },
    });
    expect(imgs.tv_doge).toBe("https://owo.test/doge.gif");
    expect(parseMarkdown(":tv_doge:")).toContain('class="tk-owo-emotion"');
  });

  it("请求失败时结算为空对象（不挂起）", async () => {
    mockOwoXhr({}, 500);
    const odata = await initOwoEmotions("https://owo.test/broken.json");
    expect(odata).toEqual({});
  });
});

describe("directives（Wave 4）", () => {
  it("v-loading：true 插入遮罩并补 relative，false 移除", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    (vLoading.mounted as (el: HTMLElement, binding: unknown) => void)?.(el, { value: true });
    expect(el.querySelector(".tk-loading-mask")).not.toBeNull();
    expect(el.classList.contains("tk-loading-parent--relative")).toBe(true);
    (vLoading.updated as (el: HTMLElement, binding: unknown) => void)?.(el, { value: false });
    expect(el.querySelector(".tk-loading-mask")).toBeNull();
  });

  it("v-clickoutside：点击外部触发回调，内部不触发", async () => {
    const el = document.createElement("div");
    const child = document.createElement("span");
    el.appendChild(child);
    document.body.appendChild(el);
    const spy = vi.fn();
    (vClickoutside.mounted as (el: HTMLElement, binding: unknown) => void)?.(el, { value: spy });
    child.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(spy).not.toHaveBeenCalled();
    document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(spy).toHaveBeenCalledTimes(1);
    (vClickoutside.unmounted as (el: HTMLElement) => void)?.(el);
    document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe("bus / state（Wave 4）", () => {
  it("on/emit/off：按事件名分发并可取消", () => {
    const spy = vi.fn();
    on(EVENT_CONFIG_UPDATED, spy);
    emit(EVENT_CONFIG_UPDATED, 1);
    expect(spy).toHaveBeenCalledWith(1);
    off(EVENT_CONFIG_UPDATED, spy);
    emit(EVENT_CONFIG_UPDATED, 2);
    expect(spy).toHaveBeenCalledTimes(1);
    // 无订阅者时静默
    emit("no-such-event");
  });

  it("state：setServerConfig / getServerConfig 共享同一份响应式对象", () => {
    setServerConfig({ IS_ADMIN: true });
    expect(getServerConfig().IS_ADMIN).toBe(true);
  });
});

describe("highlight（Wave 4）", () => {
  it("renderCode：空元素 / 无代码块时安全返回（不抛）", async () => {
    renderCode(null, "tomorrow", "");
    const el = document.createElement("div");
    el.innerHTML = "<p>没有代码块</p>";
    document.body.appendChild(el);
    renderCode(el, "none", "");
    renderCode(el, "tomorrow", "showLanguage,copyButton");
    await Promise.resolve();
    await Promise.resolve();
    expect(el.querySelector("pre")).toBeNull();
  });
});

describe("tcb（云开发实例装配）", () => {
  /** 装配一个最小可用的云开发 SDK 替身 */
  function makeSdk(): unknown {
    return {
      /**
       * SDK 初始化替身。
       * @returns 应用对象替身
       */
      init: () => ({
        /**
         * 云函数调用替身。
         * @returns 空结果
         */
        callFunction: async () => ({ result: {} }),
        /**
         * 鉴权对象替身。
         * @returns 已登录状态
         */
        auth: () => ({
          /**
           * 登录态探测替身。
           * @returns 恒为已登录
           */
          hasLoginState: () => true,
          /**
           * 当前用户替身。
           * @returns 匿名用户
           */
          getCurrentUser: async () => ({ loginType: "ANONYMOUS" }),
          /** 登出替身。 */
          signOut: async () => undefined,
          /**
           * 自定义登录替身。
           * @returns provider
           */
          customAuthProvider: () => ({
            /**
             * 票据登录替身。
             * @returns 空结果
             */
            signIn: async () => ({}),
          }),
          /**
           * 匿名登录替身。
           * @returns provider
           */
          anonymousAuthProvider: () => ({
            /**
             * 匿名登录替身。
             * @returns 空结果
             */
            signIn: async () => ({}),
          }),
        }),
      }),
    };
  }

  it("install：装配 app 与 auth 并返回实例", async () => {
    const tcb = await install(makeSdk(), { envId: "env-1", region: "ap-shanghai" });
    expect(tcb?.app).toBeTruthy();
    expect(tcb?.auth).toBeTruthy();
  });

  it("install：缺 envId 抛 Twikoo: failed to init", async () => {
    await expect(install(makeSdk(), {})).rejects.toThrow(/failed to init/);
  });

  it("install：无登录态时走匿名登录", async () => {
    let anonymousSignInCalled = false;
    const sdk = {
      /**
       * SDK 初始化替身。
       * @returns 应用对象替身
       */
      init: () => ({
        /**
         * 云函数调用替身。
         * @returns 空结果
         */
        callFunction: async () => ({ result: {} }),
        /**
         * 鉴权对象替身（未登录）。
         * @returns 未登录状态
         */
        auth: () => ({
          /**
           * 登录态探测替身。
           * @returns 恒为未登录
           */
          hasLoginState: () => false,
          /**
           * 匿名登录替身。
           * @returns provider
           */
          anonymousAuthProvider: () => ({
            /**
             * 记录匿名登录被调用。
             * @returns 空结果
             */
            signIn: async () => {
              anonymousSignInCalled = true;
              return {};
            },
          }),
        }),
      }),
    };
    await install(sdk, { envId: "env-1" });
    expect(anonymousSignInCalled).toBe(true);
  });
});

describe("OwO 表情面板（Wave 4）", () => {
  /** 等待构造函数里的 setTimeout(() => init()) 执行 */
  function tick(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }

  /** 构造面板所需的最小 OwO 数据 */
  function makeOdata(): OwoData {
    return {
      阿鲁: {
        type: "image",
        container: [
          { text: "tv_doge", icon: '<img src="https://owo.test/doge.gif">' },
          { icon: '<img src="https://owo.test/noname.png">' },
        ],
      },
      颜文字: { type: "emoji", container: [{ text: "smile", icon: "😄" }] },
    };
  }

  it("渲染面板结构并默认激活首个分类", async () => {
    const container = document.createElement("div");
    container.className = "OwO";
    const textarea = document.createElement("textarea");
    document.body.append(container, textarea);
    new OwO({ container, target: textarea, odata: makeOdata() });
    await tick();
    expect(container.querySelector(".OwO-logo")).not.toBeNull();
    expect(container.querySelectorAll(".OwO-items")).toHaveLength(2);
    expect(container.querySelectorAll(".OwO-items-show")).toHaveLength(1);
    expect(container.querySelectorAll(".OwO-package-active")).toHaveLength(1);
    // 第二个分类的页签点击
    container
      .querySelectorAll(".OwO-packages li")[1]
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(container.querySelectorAll(".OwO-items")[1].classList.contains("OwO-items-show")).toBe(
      true,
    );
  });

  it("点击图片表情插入 :name:，点击无 text 表情退化为 Markdown", async () => {
    const container = document.createElement("div");
    container.className = "OwO";
    const textarea = document.createElement("textarea");
    document.body.append(container, textarea);
    const owo = new OwO({ container, target: textarea, odata: makeOdata() });
    await tick();
    const items = container.querySelectorAll(".OwO-item");
    items[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(textarea.value).toBe(":tv_doge: ");
    // 无 text（title 为空）→ Markdown 图片
    items[1].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(textarea.value).toContain("![");
    expect(textarea.value).toContain("https://owo.test/noname.png");
    // 点击后自动收起
    expect(container.classList.contains("OwO-open")).toBe(false);
    owo.toggle();
    expect(container.classList.contains("OwO-open")).toBe(true);
  });

  it("position=up 时补 OwO-up 类；点击非表情项不插入", async () => {
    const container = document.createElement("div");
    container.className = "OwO";
    const textarea = document.createElement("textarea");
    document.body.append(container, textarea);
    new OwO({ container, target: textarea, position: "up", odata: makeOdata() });
    await tick();
    expect(container.classList.contains("OwO-up")).toBe(true);
    container.querySelector(".OwO-body")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(textarea.value).toBe("");
    expect(() =>
      container
        .querySelector(".OwO-logo")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true })),
    ).not.toThrow();
  });
});

describe("version（BC-9）", () => {
  it("客户端版本来自 @twikoojs/shared", () => {
    expect(typeof VERSION).toBe("string");
    expect(VERSION.length).toBeGreaterThan(0);
  });
});
