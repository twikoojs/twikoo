/**
 * 组件集成测试。
 *
 * 覆盖：TkError 卡片 / TkSubmit 表单与预览 / TkComments 列表与空态 / TkComment 标签与操作栏 /
 * TkAvatar 头像回退 / TkAction 计数与事件 / TkPagination 页码 / TkFooter 版本 / App 根渲染。
 *
 * 数据通道以替身 tcb（`app.callFunction`）驱动，避免依赖真实后端。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import TkSubmit from "../src/components/TkSubmit.vue";
import TkComments from "../src/components/TkComments.vue";
import TkComment from "../src/components/TkComment.vue";
import TkAvatar from "../src/components/TkAvatar.vue";
import TkAction from "../src/components/TkAction.vue";
import TkPagination from "../src/components/TkPagination.vue";
import TkFooter from "../src/components/TkFooter.vue";
import TkMetaInput from "../src/components/TkMetaInput.vue";
import TkError from "../src/components/TkError.vue";
import TkAdminComment from "../src/components/TkAdminComment.vue";
import TkAdminExport from "../src/components/TkAdminExport.vue";
import TkAdminImport from "../src/components/TkAdminImport.vue";
import TkAdminConfig from "../src/components/TkAdminConfig.vue";
import TkAdmin from "../src/components/TkAdmin.vue";
import TwikooApp from "../src/App.vue";
import { VERSION } from "@twikoojs/shared";
import { TwikooError, setAppState, getAppState } from "../src/utils/api";
import { t } from "../src/utils";
import { clearAll } from "../src/utils/bus";
import { setServerConfig } from "../src/utils/state";
import type { CommentDto } from "../src/types";

/** 评论 DTO 构造器（只填测试关心的字段） */
function makeComment(overrides: Partial<CommentDto> = {}): CommentDto {
  return {
    id: "c1",
    url: "/demo.html",
    nick: "测试用户",
    comment: "<p>正文</p>",
    created: Date.now() - 60000,
    ups: 3,
    downs: 0,
    liked: false,
    disliked: false,
    isSpam: false,
    top: false,
    master: false,
    isOwner: false,
    replies: [],
    ...overrides,
  } as CommentDto;
}

/**
 * 装配替身云开发实例（返回固定事件响应表）。
 * @param handlers 事件名 → 响应载荷
 */
/**
 * 数据通道替身。
 * @param handlers 事件 → 响应；值为函数时按 `(payload) => 响应` 调用（可顺便抓取 payload）
 * @param options 追加的 init 选项（如 onSubmit 钩子）
 */
function useFakeTcb(
  handlers: Record<string, unknown> = {},
  options: Record<string, unknown> = {},
): void {
  const tcb = {
    app: {
      /**
       * 事件转发替身。
       * @param params 事件参数
       * @returns 固定响应
       */
      callFunction: async (params: { name: string; data: { event?: string } }) => {
        const event = String(params.data?.event ?? "");
        const handler = handlers[event];
        /** 函数形 handler 可读取 payload 并自行决定响应 */
        const result =
          typeof handler === "function"
            ? (handler as (data: Record<string, unknown>) => unknown)(params.data ?? {})
            : (handler ?? { code: 0 });
        return { result };
      },
    },
  };
  setAppState(tcb as never, { path: "/demo.html", ...options });
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
  localStorage.clear();
  clearAll();
  setServerConfig({});
  setAppState(null, {});
});

describe("TkError 卡片", () => {
  it("标题按 kind 映射（场景表）", () => {
    const err = new TwikooError("CORS", "请求被跨域策略拦截", { httpStatus: 0 });
    const wrapper = mount(TkError, { props: { error: err } });
    expect(wrapper.find(".tk-error__title").text()).toBe("请求被跨域策略拦截");
    expect(wrapper.find(".tk-error__message").text()).toContain("跨域");
  });

  it("详情默认收起，点击展开显示 requestId", async () => {
    const err = new TwikooError("SERVER_ERROR", "后端异常", {
      httpStatus: 500,
      requestId: "req-42",
    });
    const wrapper = mount(TkError, { props: { error: err } });
    const detailEl = wrapper.find(".tk-error__detail").element as HTMLElement;
    expect(detailEl.style.display).toBe("none");
    await wrapper.find(".tk-error__toggle").trigger("click");
    const detailEl2 = wrapper.find(".tk-error__detail").element as HTMLElement;
    expect(detailEl2.style.display).not.toBe("none");
    expect(wrapper.find(".tk-error__detail").text()).toContain("req-42");
  });
});

describe("TkMetaInput", () => {
  it("默认三字段可见且 nick/mail 必填", async () => {
    const wrapper = mount(TkMetaInput, { props: { config: {} } });
    expect(wrapper.findAll(".tk-input").length).toBe(3);
    // 初始（localStorage 空）→ 无效
    const updates = wrapper.emitted("update") ?? [];
    expect(updates.length).toBeGreaterThan(0);
    expect((updates.at(-1)?.[0] as { valid: boolean }).valid).toBe(false);
  });

  it("DISPLAYED_FIELDS / REQUIRED_FIELDS 生效", () => {
    const wrapper = mount(TkMetaInput, {
      props: { config: { DISPLAYED_FIELDS: "nick,mail", REQUIRED_FIELDS: "nick" } },
    });
    expect(wrapper.findAll(".tk-input").length).toBe(2);
  });
});

describe("TkSubmit", () => {
  it("输入时实时校验，change 后才保存资料并更新头像", async () => {
    useFakeTcb();
    const saved = { nick: "原昵称", mail: "old@example.com", link: "" };
    localStorage.setItem("twikoo", JSON.stringify(saved));
    const wrapper = mount(TkSubmit, { props: { config: {} } });
    await flushPromises();
    await wrapper.find("textarea").setValue("测试内容");
    const avatar = wrapper.find(".tk-avatar img").attributes("src");
    const nickInput = wrapper.find('input[name="nick"]');
    const mailInput = wrapper.find('input[name="mail"]');

    (mailInput.element as HTMLInputElement).value = "";
    await mailInput.trigger("input");
    expect(wrapper.find(".tk-send").attributes("disabled")).toBeDefined();
    (mailInput.element as HTMLInputElement).value = "new@example.com";
    await mailInput.trigger("input");
    (nickInput.element as HTMLInputElement).value = "新昵称";
    await nickInput.trigger("input");
    expect(wrapper.find(".tk-send").attributes("disabled")).toBeUndefined();
    expect(localStorage.getItem("twikoo")).toBe(JSON.stringify(saved));
    expect(wrapper.find(".tk-avatar img").attributes("src")).toBe(avatar);

    await mailInput.trigger("change");
    expect(JSON.parse(localStorage.getItem("twikoo") ?? "{}")).toEqual({
      nick: "新昵称",
      mail: "new@example.com",
      link: "",
    });
    expect(wrapper.find(".tk-avatar img").attributes("src")).not.toBe(avatar);
    wrapper.unmount();
  });

  it("meta 未就绪时发送按钮禁用，填写齐备后可用", async () => {
    useFakeTcb();
    const wrapper = mount(TkSubmit, { props: { config: {} } });
    await flushPromises();
    expect(wrapper.find(".tk-send").attributes("disabled")).toBeDefined();

    const inputs = wrapper.findAll("input");
    await inputs[0].setValue("测试用户");
    await inputs[0].trigger("change");
    await inputs[1].setValue("user@example.com");
    await inputs[1].trigger("change");
    await wrapper.find("textarea").setValue("测试内容");
    await flushPromises();
    expect(wrapper.find(".tk-send").attributes("disabled")).toBeUndefined();
  });

  it("预览：marked 渲染 + 消毒", async () => {
    useFakeTcb();
    const wrapper = mount(TkSubmit, { props: { config: {} } });
    await flushPromises();
    await wrapper.find("textarea").setValue("**加粗预览**");
    await wrapper.find(".tk-preview").trigger("click");
    await flushPromises();
    expect(wrapper.find(".tk-preview-container").exists()).toBe(true);
    expect(wrapper.find(".tk-preview-container").html()).toContain("<strong>加粗预览</strong>");
  });

  it("提交前回调：onSubmit 可原地修改待发送字段", async () => {
    /** 抓取实际提交的 payload */
    let submitted: Record<string, unknown> | undefined;
    useFakeTcb(
      {
        /**
         * 提交替身。
         * @param data 待发送载荷
         * @returns 成功响应
         */
        COMMENT_SUBMIT: (data: Record<string, unknown>) => {
          submitted = data;
          return { id: "c9" };
        },
      },
      {
        /**
         * 钩子：改写昵称。
         * @param payload 待发送载荷
         */
        onSubmit: (payload: Record<string, unknown>) => {
          payload.nick = "钩子改过的昵称";
        },
      },
    );
    const wrapper = mount(TkSubmit, { props: { config: {} } });
    await flushPromises();
    const inputs = wrapper.findAll("input");
    await inputs[0].setValue("测试用户");
    await inputs[0].trigger("change");
    await inputs[1].setValue("user@example.com");
    await inputs[1].trigger("change");
    await wrapper.find("textarea").setValue("测试内容");
    await wrapper.find(".tk-send").trigger("click");
    await flushPromises();
    expect(submitted).toBeDefined();
    expect(submitted?.nick).toBe("钩子改过的昵称");
  });

  it("提交前回调抛错：中止发送并上报 error", async () => {
    let submitCount = 0;
    useFakeTcb(
      {
        /**
         * 提交替身（回调抛错时不应到达）。
         * @returns 成功响应
         */
        COMMENT_SUBMIT: () => {
          submitCount += 1;
          return { id: "c9" };
        },
      },
      {
        /**
         * 钩子：直接抛错。
         */
        onSubmit: () => {
          throw new Error("钩子拦截");
        },
      },
    );
    const wrapper = mount(TkSubmit, { props: { config: {} } });
    await flushPromises();
    const inputs = wrapper.findAll("input");
    await inputs[0].setValue("测试用户");
    await inputs[0].trigger("change");
    await inputs[1].setValue("user@example.com");
    await inputs[1].trigger("change");
    await wrapper.find("textarea").setValue("测试内容");
    await wrapper.find(".tk-send").trigger("click");
    await flushPromises();
    expect(submitCount).toBe(0);
    expect(wrapper.emitted("error")).toBeTruthy();
  });

  it("回复态显示取消按钮并派发 cancel", async () => {
    useFakeTcb();
    const wrapper = mount(TkSubmit, { props: { config: {}, replyId: "c1", pid: "c1" } });
    await flushPromises();
    expect(wrapper.find(".tk-cancel").exists()).toBe(true);
    await wrapper.find(".tk-cancel").trigger("click");
    expect(wrapper.emitted("cancel")).toHaveLength(1);
  });

  it("提交失败：上报 error 事件，且自身不再渲染错误卡片（交给评论区统一渲染）", async () => {
    useFakeTcb({ COMMENT_SUBMIT: { code: 1000, message: "包含屏蔽词" } });
    const wrapper = mount(TkSubmit, { props: { config: {} } });
    await flushPromises();
    const inputs = wrapper.findAll("input");
    await inputs[0].setValue("测试用户");
    await inputs[0].trigger("change");
    await inputs[1].setValue("user@example.com");
    await inputs[1].trigger("change");
    await wrapper.find("textarea").setValue("测试内容");
    await flushPromises();

    await wrapper.find(".tk-send").trigger("click");
    await flushPromises();

    const emitted = wrapper.emitted("error");
    expect(emitted, "未上报 error 事件").toBeTruthy();
    expect((emitted![0][0] as TwikooError).rawMessage).toBe("包含屏蔽词");
    expect(wrapper.find(".tk-error").exists()).toBe(false);
  });
});

describe("TkAction / TkAvatar", () => {
  it("TkAction：计数为 0 时不显示数字；事件逐项派发", async () => {
    const wrapper = mount(TkAction, {
      props: {
        likeCount: 0,
        dislikeCount: 2,
        repliesCount: 1,
        showDelete: true,
        showDislike: true,
      },
    });
    // 删除按钮的计数位恒为空；点赞 0 也不显示数字
    const counts = wrapper.findAll(".tk-action-count").map((el) => el.text());
    expect(counts).toEqual(["", "", "2", "1"]);
    const buttons = wrapper.findAll("button");
    await buttons[0].trigger("click");
    await buttons[1].trigger("click");
    await buttons[2].trigger("click");
    await buttons[3].trigger("click");
    expect(wrapper.emitted("delete")).toHaveLength(1);
    expect(wrapper.emitted("like")).toHaveLength(1);
    expect(wrapper.emitted("dislike")).toHaveLength(1);
    expect(wrapper.emitted("reply")).toHaveLength(1);
  });

  it("TkAction：showDislike=false 时不渲染点踩按钮", () => {
    const wrapper = mount(TkAction, { props: { showDislike: false, showDelete: false } });
    expect(wrapper.findAll("button")).toHaveLength(2);
  });

  it("TkAvatar：有头像时渲染 img 并标记 tk-has-avatar", () => {
    const wrapper = mount(TkAvatar, { props: { avatar: "https://img.test/a.png", nick: "n" } });
    expect(wrapper.classes()).toContain("tk-has-avatar");
    expect(wrapper.find("img").attributes("src")).toBe("https://img.test/a.png");
  });

  it("TkAvatar：无任何来源时回退默认图标（无 img）", () => {
    const wrapper = mount(TkAvatar, { props: {} });
    expect(wrapper.classes()).not.toContain("tk-has-avatar");
    expect(wrapper.find("img").exists()).toBe(false);
    expect(wrapper.find("svg").exists()).toBe(true);
  });
});

describe("TkPagination", () => {
  it("按总数生成页码，首页高亮，点击派发 current-change", async () => {
    const wrapper = mount(TkPagination, { props: { pageSize: 5, total: 26 } });
    const pagers = wrapper.findAll(".tk-pagination-pager");
    // 6 页：1..6（当前页 1，距离 <3 的 1/2/3 与末页 6）
    expect(pagers.length).toBeGreaterThanOrEqual(4);
    expect(wrapper.find(".tk-pagination-pager.__current").text()).toBe("1");
    await pagers[2].trigger("click");
    expect(wrapper.emitted("current-change")).toBeTruthy();
  });

  it("total 为 0 时隐藏条数/跳转区块", () => {
    const wrapper = mount(TkPagination, { props: { pageSize: 10, total: 0 } });
    expect(wrapper.findAll(".tk-pagination-options")).toHaveLength(0);
  });
});

describe("TkFooter", () => {
  it("渲染构建期注入的版本号", () => {
    const wrapper = mount(TkFooter);
    expect(wrapper.text()).toContain("Twikoo");
    expect(wrapper.text()).toContain(`v${VERSION}`);
  });
});

describe("TkComment", () => {
  const originalAlert = window.alert;
  const originalConfirm = window.confirm;
  afterEach(() => {
    window.alert = originalAlert;
    window.confirm = originalConfirm;
  });

  it.each([
    ["isSpam", "ADMIN_COMMENT_HIDE", ".tk-tag-yellow"],
    ["top", "ADMIN_COMMENT_TOP", ".tk-tag-red"],
  ] as const)("管理操作 %s：失败保留状态，成功后更新", async (field, label, tag) => {
    const update = vi.fn().mockReturnValue({ code: 1000, message: "请先登录" });
    const alert = vi.fn();
    window.alert = alert;
    useFakeTcb({ COMMENT_SET_FOR_ADMIN: update });
    setServerConfig({ IS_ADMIN: true });
    const wrapper = mount(TkComment, {
      props: { comment: makeComment() },
    });
    await flushPromises();
    const button = wrapper.findAll(".tk-actions button").find((item) => item.text() === t(label))!;
    await button.trigger("click");
    await flushPromises();
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ id: "c1", set: { [field]: true } }),
    );
    expect(alert).toHaveBeenCalledWith("请先登录");
    expect(wrapper.find(tag).exists()).toBe(false);

    update.mockReturnValue({ code: 0 });
    await button.trigger("click");
    await flushPromises();
    expect(wrapper.find(tag).exists()).toBe(true);
    wrapper.unmount();
  });

  it("管理员删除：取消不请求，失败不刷新，成功才刷新", async () => {
    const remove = vi.fn().mockReturnValue({ code: 1000, message: "请先登录" });
    const ownRemove = vi.fn();
    const confirm = vi.fn().mockReturnValue(false);
    const alert = vi.fn();
    window.confirm = confirm;
    window.alert = alert;
    useFakeTcb({ COMMENT_DELETE_FOR_ADMIN: remove, COMMENT_DELETE_FOR_USER: ownRemove });
    setServerConfig({ IS_ADMIN: true });
    const wrapper = mount(TkComment, { props: { comment: makeComment() } });
    await flushPromises();
    const button = wrapper
      .findAll(".tk-actions button")
      .find((item) => item.text() === t("ADMIN_COMMENT_DELETE"))!;
    await button.trigger("click");
    expect(remove).not.toHaveBeenCalled();
    expect(confirm).toHaveBeenCalledWith(t("ADMIN_COMMENT_DELETE_CONFIRM"));

    confirm.mockReturnValue(true);
    await button.trigger("click");
    await flushPromises();
    expect(remove).toHaveBeenCalledWith(expect.objectContaining({ id: "c1" }));
    expect(alert).toHaveBeenCalledWith("请先登录");
    expect(wrapper.emitted("load")).toBeUndefined();

    remove.mockReturnValue({ code: 0 });
    await button.trigger("click");
    await flushPromises();
    expect(wrapper.emitted("load")).toHaveLength(1);
    expect(ownRemove).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("本人删除仍使用用户接口，普通用户不显示管理按钮", async () => {
    const remove = vi.fn().mockReturnValue({ code: 0 });
    const adminRemove = vi.fn();
    const confirm = vi.fn().mockReturnValue(true);
    window.confirm = confirm;
    useFakeTcb({ COMMENT_DELETE_FOR_USER: remove, COMMENT_DELETE_FOR_ADMIN: adminRemove });
    const wrapper = mount(TkComment, { props: { comment: makeComment({ isOwner: true }) } });
    await flushPromises();
    expect(wrapper.find(".tk-actions").exists()).toBe(false);
    await wrapper.findComponent(TkAction).find(".tk-action-link").trigger("click");
    await flushPromises();
    expect(confirm).toHaveBeenCalledWith(t("COMMENT_DELETE_CONFIRM"));
    expect(remove).toHaveBeenCalledWith(expect.objectContaining({ id: "c1" }));
    expect(adminRemove).not.toHaveBeenCalled();
    expect(wrapper.emitted("load")).toHaveLength(1);
    wrapper.unmount();
  });

  it("渲染昵称/正文/站长标签与回复列表", async () => {
    useFakeTcb();
    const wrapper = mount(TkComment, {
      props: {
        comment: makeComment({
          master: true,
          top: true,
          replies: [makeComment({ id: "c1-r1", nick: "回复者", pid: "c1", rid: "c1" })],
        }),
        config: {},
      },
    });
    await flushPromises();
    expect(wrapper.find(".tk-nick").text()).toBe("测试用户");
    expect(wrapper.find(".tk-content").html()).toContain("正文");
    expect(wrapper.findAll(".tk-tag-green")).toHaveLength(1);
    expect(wrapper.findAll(".tk-tag-red")).toHaveLength(1);
    expect(wrapper.findAll(".tk-replies .tk-comment")).toHaveLength(1);
  });

  it("点赞：派发 COMMENT_LIKE 并本地累加", async () => {
    const events: string[] = [];
    const tcb = {
      app: {
        /**
         * 记录事件名。
         * @param params 事件参数
         * @returns 成功响应
         */
        callFunction: async (params: { data: { event?: string } }) => {
          events.push(String(params.data?.event));
          return { result: { code: 0 } };
        },
      },
    };
    setAppState(tcb as never, {});
    const wrapper = mount(TkComment, { props: { comment: makeComment({ ups: 3 }), config: {} } });
    await flushPromises();
    const likeBtn = wrapper.findAll(".tk-action-link")[0];
    await likeBtn.trigger("click");
    await flushPromises();
    expect(events).toContain("COMMENT_LIKE");
    expect(likeBtn.classes()).toContain("tk-liked");
    expect(likeBtn.find(".tk-action-count").text()).toBe("4");
  });

  it("展开/收起：内容与回复列表按钮按 ref 高度判定后渲染", async () => {
    useFakeTcb();
    const wrapper = mount(TkComment, { props: { comment: makeComment(), config: {} } });
    await flushPromises();
    // happy-dom 下 scrollHeight 为 0，故默认不显示展开按钮（与 1.x 同判定）
    expect(wrapper.find(".tk-expand").exists()).toBe(false);
  });
});

describe("评论图片放大", () => {
  it.each(["comment", "admin"])(
    "%s：放大普通图片，加载和缩放后居中，关闭后清理监听",
    async (view) => {
      useFakeTcb({
        GET_CONFIG_FOR_ADMIN: { code: 0, config: { LIGHTBOX: "true" } },
        COMMENT_GET_FOR_ADMIN: {
          code: 0,
          count: 1,
          data: [
            {
              _id: "c1",
              nick: "甲",
              comment:
                '<p><img src="https://example.com/photo.png"></p><p><img class="tk-owo-emotion" src="https://example.com/emoji.png"></p>',
              created: 1,
            },
          ],
        },
      });
      setServerConfig({ LIGHTBOX: "true" });
      const container = document.createElement("div");
      container.className = "twikoo";
      document.body.appendChild(container);
      const wrapper =
        view === "admin"
          ? mount(TkAdminComment, { attachTo: container })
          : mount(TkComment, {
              attachTo: container,
              props: {
                comment: makeComment({
                  comment:
                    '<p><img src="https://example.com/photo.png"></p><p><img class="tk-owo-emotion" src="https://example.com/emoji.png"></p>',
                }),
              },
            });
      await flushPromises();
      await wrapper.find(".tk-content img.tk-owo-emotion").trigger("click");
      expect(container.querySelector(".tk-lightbox")).toBeNull();
      await wrapper.findAll(".tk-content img")[0].trigger("click");
      const lightbox = container.querySelector<HTMLElement>(".tk-lightbox")!;
      const image = lightbox.querySelector<HTMLImageElement>("img")!;
      expect(image.src).toBe("https://example.com/photo.png");
      Object.defineProperties(image, {
        complete: { value: true },
        naturalWidth: { value: 301 },
      });
      vi.spyOn(window, "devicePixelRatio", "get").mockReturnValue(2);
      const bounds = vi
        .spyOn(lightbox, "getBoundingClientRect")
        .mockReturnValue(new DOMRect(0, 0, 1000, 800));
      vi.spyOn(image, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 301, 201));
      image.dispatchEvent(new Event("load"));
      expect(image.style.left).toBe("349.5px");
      expect(image.style.top).toBe("299.5px");
      expect(image.style.transform).toBe("none");
      bounds.mockReturnValue(new DOMRect(0, 0, 1200, 900));
      window.dispatchEvent(new Event("resize"));
      expect(image.style.left).toBe("449.5px");
      expect(image.style.top).toBe("349.5px");
      lightbox.click();
      expect(container.querySelector(".tk-lightbox")).toBeNull();
      bounds.mockClear();
      window.dispatchEvent(new Event("resize"));
      image.dispatchEvent(new Event("load"));
      expect(bounds).not.toHaveBeenCalled();
      wrapper.unmount();
    },
  );
});

describe("TkComments", () => {
  it("空列表渲染空态与总数", async () => {
    useFakeTcb({
      GET_CONFIG: { code: 0, config: {} },
      COMMENT_GET: { code: 0, data: [], more: false, count: 0 },
    });
    const wrapper = mount(TkComments);
    await flushPromises();
    expect(wrapper.find(".tk-comments-no").exists()).toBe(true);
    expect(wrapper.find(".tk-comments-count").text()).toContain("0");
  });

  it("有数据时渲染评论列表与「加载更多」", async () => {
    useFakeTcb({
      GET_CONFIG: { code: 0, config: { SHOW_ORDER: "true" } },
      COMMENT_GET: {
        code: 0,
        data: [makeComment({ id: "c1" }), makeComment({ id: "c2", nick: "另一个" })],
        more: true,
        count: 12,
      },
    });
    const wrapper = mount(TkComments);
    await flushPromises();
    expect(wrapper.findAll(".tk-comment")).toHaveLength(2);
    expect(wrapper.find(".tk-expand").exists()).toBe(true);
    expect(wrapper.find(".tk-comments-count").text()).toContain("12");
  });

  it("showAdminEntry=true 时渲染管理入口齿轮并派发 admin", async () => {
    useFakeTcb({
      GET_CONFIG: { code: 0, config: {} },
      COMMENT_GET: { code: 0, data: [makeComment()], more: false, count: 1 },
    });
    const wrapper = mount(TkComments, { props: { showAdminEntry: true } });
    await flushPromises();
    const icons = wrapper.findAll(".tk-icon.__comments");
    await icons[icons.length - 1].trigger("click");
    expect(wrapper.emitted("admin")).toHaveLength(1);
  });

  it("接口报错时展示统一的 TkError 卡片", async () => {
    useFakeTcb({
      GET_CONFIG: { code: 0, config: {} },
      COMMENT_GET: { code: 1000, message: "后端异常" },
    });
    const wrapper = mount(TkComments);
    await flushPromises();
    const card = wrapper.find(".tk-error");
    expect(card.exists()).toBe(true);
    expect(card.find(".tk-error__title").text()).toBe("请求失败");
    expect(card.find(".tk-error__message").text()).toBe("后端异常");
    // 出错时空态块整体不渲染——卡片与空态块互斥，不会同时出现
    expect(wrapper.find(".tk-comments-no").exists()).toBe(false);
  });

  it("整个评论区只有一张错误卡片：提交框上报的错误复用同一张", async () => {
    useFakeTcb({ GET_CONFIG: { code: 0, config: {} }, COMMENT_GET: { code: 0, data: [] } });
    const wrapper = mount(TkComments);
    await flushPromises();
    expect(wrapper.find(".tk-error").exists()).toBe(false);

    // 主提交框上报错误（真实链路由 TkSubmit 在提交失败时发出）
    wrapper
      .findComponent(TkSubmit)
      .vm.$emit("error", new TwikooError("REJECTED", "请求过于频繁", { rawMessage: "429" }));
    await flushPromises();
    const cards = wrapper.findAll(".tk-error");
    expect(cards).toHaveLength(1);
    expect(cards[0].find(".tk-error__title").text()).toBe("请求过于频繁");

    // 新的错误直接覆盖同一张卡片
    wrapper
      .findComponent(TkSubmit)
      .vm.$emit(
        "error",
        new TwikooError("NETWORK", "无法连接到后端", { rawMessage: "Failed to fetch" }),
      );
    await flushPromises();
    expect(wrapper.findAll(".tk-error")).toHaveLength(1);
    expect(wrapper.find(".tk-error__title").text()).toBe("无法连接到后端");
  });
});

/** 空告警处理器 */
const suppressWarn = (): void => undefined;

describe("App 渲染", () => {
  it("挂载产出 .twikoo 容器、评论区与管理面板", async () => {
    useFakeTcb({
      GET_CONFIG: { code: 0, config: {} },
      COMMENT_GET: { code: 0, data: [], more: false, count: 0 },
    });
    const wrapper = mount(TwikooApp, {
      /** 挂载配置：压制开发告警 */
      global: {
        config: { warnHandler: suppressWarn },
      },
    });
    await flushPromises();
    expect(wrapper.find(".twikoo").exists()).toBe(true);
    expect(wrapper.find(".tk-comments").exists()).toBe(true);
    expect(wrapper.find(".tk-footer").exists()).toBe(true);
    expect(wrapper.find(".tk-admin-container").exists()).toBe(true);
    wrapper.unmount();
  });
});

describe("操作失败与响应丢失", () => {
  const originalAlert = window.alert;
  const originalConfirm = window.confirm;

  beforeEach(() => {
    window.alert = vi.fn();
    window.confirm = vi.fn(() => true);
  });

  afterEach(() => {
    window.alert = originalAlert;
    window.confirm = originalConfirm;
  });

  it.each(["delete-user", "delete-admin", "isSpam", "top", "like", "dislike"])(
    "%s 响应丢失后提示原因并刷新到服务端状态",
    async (action) => {
      vi.spyOn(window, "confirm").mockReturnValue(true);
      const alert = vi.spyOn(window, "alert").mockImplementation(() => undefined);
      let comment: CommentDto | null = makeComment({ isOwner: true });
      const read = vi.fn(() => ({
        code: 0,
        data: comment ? [{ ...comment }] : [],
        count: comment ? 1 : 0,
      }));
      const mutate = vi.fn(() => {
        if (action.startsWith("delete")) comment = null;
        else if (action === "isSpam") comment!.isSpam = true;
        else if (action === "top") comment!.top = true;
        else if (action === "like") Object.assign(comment!, { ups: 4, liked: true });
        else Object.assign(comment!, { downs: 1, disliked: true });
        throw new TwikooError("NETWORK", "响应丢失");
      });
      useFakeTcb({
        GET_CONFIG: { code: 0, config: { IS_ADMIN: true } },
        COMMENT_GET: read,
        COMMENT_DELETE_FOR_USER: mutate,
        COMMENT_DELETE_FOR_ADMIN: mutate,
        COMMENT_SET_FOR_ADMIN: mutate,
        COMMENT_LIKE: mutate,
      });
      const wrapper = mount(TkComments);
      await flushPromises();
      const item = wrapper.findComponent(TkComment);
      if (action === "delete-user" || action === "like" || action === "dislike") {
        item.findComponent(TkAction).vm.$emit(action === "delete-user" ? "delete" : action);
      } else {
        const label =
          action === "delete-admin"
            ? "ADMIN_COMMENT_DELETE"
            : action === "top"
              ? "ADMIN_COMMENT_TOP"
              : "ADMIN_COMMENT_HIDE";
        await item
          .findAll(".tk-actions button")
          .find((button) => button.text() === t(label))!
          .trigger("click");
      }
      await flushPromises();
      expect(alert).toHaveBeenCalledWith("响应丢失");
      expect(mutate).toHaveBeenCalledTimes(1);
      expect(read).toHaveBeenCalledTimes(2);
      if (action.startsWith("delete"))
        expect(wrapper.findComponent(TkComment).exists()).toBe(false);
      else if (action === "isSpam") expect(wrapper.find(".tk-tag-yellow").exists()).toBe(true);
      else if (action === "top") expect(wrapper.find(".tk-tag-red").exists()).toBe(true);
      else
        expect(wrapper.find(action === "like" ? ".tk-liked" : ".tk-disliked").exists()).toBe(true);
      wrapper.unmount();
    },
  );

  it.each([
    ["isSpam", "ADMIN_COMMENT_HIDE", "ADMIN_COMMENT_SHOW", ".tk-tag-yellow"],
    ["top", "ADMIN_COMMENT_TOP", "ADMIN_COMMENT_UNTOP", ".tk-tag-red"],
  ] as const)(
    "%s 先成功再取消时响应丢失，也能同步回最初的属性值",
    async (field, enable, disable, tag) => {
      let comment = makeComment();
      let updates = 0;
      useFakeTcb({
        GET_CONFIG: { code: 0, config: { IS_ADMIN: true } },
        COMMENT_GET: () => ({ code: 0, data: [{ ...comment }], count: 1 }),
        COMMENT_SET_FOR_ADMIN: () => {
          comment = { ...comment, [field]: ++updates === 1 };
          if (updates > 1) throw new Error("响应丢失");
          return { code: 0 };
        },
      });
      const wrapper = mount(TkComments);
      await flushPromises();
      await wrapper
        .findAll(".tk-actions button")
        .find((button) => button.text() === t(enable))!
        .trigger("click");
      await flushPromises();
      expect(wrapper.find(tag).exists()).toBe(true);
      await wrapper
        .findAll(".tk-actions button")
        .find((button) => button.text() === t(disable))!
        .trigger("click");
      await flushPromises();
      expect(wrapper.find(tag).exists()).toBe(false);
      wrapper.unmount();
    },
  );

  it.each(["like", "dislike"] as const)("%s 业务失败不修改计数，并允许重试", async (action) => {
    const alert = vi.spyOn(window, "alert").mockImplementation(() => undefined);
    const update = vi.fn().mockReturnValue({ code: 1000, message: "禁止操作" });
    useFakeTcb({ COMMENT_LIKE: update });
    const wrapper = mount(TkComment, { props: { comment: makeComment() } });
    await flushPromises();
    wrapper.findComponent(TkAction).vm.$emit(action);
    await flushPromises();
    expect(alert).toHaveBeenCalledWith("禁止操作");
    expect(wrapper.findComponent(TkAction).props()).toMatchObject({
      likeCount: 3,
      dislikeCount: 0,
    });
    expect(wrapper.emitted("load")).toBeUndefined();
    update.mockReturnValue({ code: 0 });
    wrapper.findComponent(TkAction).vm.$emit(action);
    await flushPromises();
    expect(wrapper.find(action === "like" ? ".tk-liked" : ".tk-disliked").exists()).toBe(true);
    wrapper.unmount();
  });

  it.each(["ADMIN_COMMENT_DELETE", "ADMIN_COMMENT_HIDE", "ADMIN_COMMENT_TOP"] as const)(
    "管理面板 %s 检查业务码，处理响应丢失和刷新失败，并允许重试",
    async (label) => {
      vi.spyOn(window, "confirm").mockReturnValue(true);
      const alert = vi.spyOn(window, "alert").mockImplementation(() => undefined);
      let data = [{ ...makeComment(), _id: "c1" }];
      const read = vi.fn(() => ({ code: 0, data, count: data.length }));
      const mutate = vi.fn().mockReturnValue({ code: 1000, message: "请先登录" });
      useFakeTcb({
        COMMENT_GET_FOR_ADMIN: read,
        COMMENT_SET_FOR_ADMIN: mutate,
        COMMENT_DELETE_FOR_ADMIN: mutate,
      });
      const wrapper = mount(TkAdminComment);
      await flushPromises();
      const button = wrapper.findAll("button").find((button) => button.text() === t(label))!;
      await button.trigger("click");
      await flushPromises();
      expect(alert).toHaveBeenCalledWith("请先登录");
      expect(read).toHaveBeenCalledTimes(1);
      mutate.mockImplementation(() => {
        throw new Error("响应丢失");
      });
      read.mockImplementationOnce(() => {
        throw new Error("刷新失败");
      });
      await button.trigger("click");
      await flushPromises();
      expect(alert).toHaveBeenCalledWith("响应丢失");
      expect(alert).toHaveBeenCalledWith("刷新失败");
      mutate.mockImplementation(() => {
        data = [];
        throw new Error("响应丢失");
      });
      await button.trigger("click");
      await flushPromises();
      expect(mutate).toHaveBeenCalledTimes(3);
      expect(wrapper.find(".tk-admin-comment-item").exists()).toBe(false);
      wrapper.unmount();
    },
  );

  it("配置保存和邮件测试失败时显示原因并解除加载状态", async () => {
    const readConfig = vi.fn().mockReturnValue({ code: 0, config: {} });
    const save = vi.fn().mockReturnValue({ code: 1000, message: "配置被拒绝" });
    const email = vi.fn(() => {
      throw new Error("邮件连接失败");
    });
    useFakeTcb({
      GET_CONFIG_FOR_ADMIN: readConfig,
      SET_CONFIG: save,
      EMAIL_TEST: email,
    });
    const wrapper = mount(TkAdminConfig);
    await flushPromises();
    await wrapper.find("form").trigger("submit");
    await flushPromises();
    expect(wrapper.find(".tk-admin-config-message").text()).toBe("配置被拒绝");
    save.mockImplementation(() => {
      throw new Error("保存响应丢失");
    });
    await wrapper.find("form").trigger("submit");
    await flushPromises();
    expect(wrapper.find(".tk-admin-config-message").text()).toBe("保存响应丢失");
    expect(save).toHaveBeenCalledTimes(2);
    expect(readConfig).toHaveBeenCalledTimes(1);
    await wrapper
      .findAll("button")
      .find((button) => button.text() === t("ADMIN_CONFIG_EMAIL_TEST_BTN"))!
      .trigger("click");
    await flushPromises();
    expect(wrapper.text()).toContain("邮件连接失败");
    wrapper.unmount();
  });

  it.each(["COMMENT_EXPORT_FOR_ADMIN", "GET_CONFIG_FOR_ADMIN"])(
    "%s 导出失败提示原因并允许重试",
    async (event) => {
      const alert = vi.spyOn(window, "alert").mockImplementation(() => undefined);
      const request = vi.fn().mockReturnValue({ code: 1000, message: "无权导出" });
      useFakeTcb({ [event]: request });
      const wrapper = mount(TkAdminExport);
      const label =
        event === "COMMENT_EXPORT_FOR_ADMIN" ? "ADMIN_EXPORT_COMMENT" : "ADMIN_CONFIG_EXPORT";
      const button = wrapper.findAll("button").find((button) => button.text() === t(label))!;
      await button.trigger("click");
      await flushPromises();
      expect(alert).toHaveBeenCalledWith("无权导出");
      request.mockImplementation(() => {
        throw new Error("导出连接失败");
      });
      await button.trigger("click");
      await flushPromises();
      expect(alert).toHaveBeenCalledWith("导出连接失败");
      expect(button.attributes("disabled")).toBeUndefined();
      wrapper.unmount();
    },
  );

  it("设置密码响应丢失后重新检查并切换到登录表单", async () => {
    let status = false;
    useFakeTcb({
      GET_PASSWORD_STATUS: () => ({ code: 0, status }),
      SET_PASSWORD: () => {
        status = true;
        throw new Error("密码响应丢失");
      },
    });
    const wrapper = mount(TkAdmin);
    await wrapper.setProps({ show: true } as never);
    await flushPromises();
    const inputs = wrapper.findAll(".tk-regist input");
    for (const input of inputs) await input.setValue("password");
    await wrapper.find(".tk-regist-button").trigger("click");
    await flushPromises();
    expect(wrapper.find(".tk-regist").exists()).toBe(false);
    expect(wrapper.find(".tk-login-msg").text()).toContain("密码响应丢失");
    expect(wrapper.find("[data-tk-loading]").exists()).toBe(false);
    wrapper.unmount();
  });

  it("登录请求失败显示原因并允许重试", async () => {
    const login = vi.fn(() => {
      throw new Error("登录连接失败");
    });
    useFakeTcb({ GET_PASSWORD_STATUS: { code: 0, status: true }, LOGIN: login });
    const wrapper = mount(TkAdmin, { props: { show: false } });
    await wrapper.setProps({ show: true } as never);
    await flushPromises();
    await wrapper.find("input[type='password']").setValue("password");
    const button = wrapper.findAll("button").find((button) => button.text() === t("ADMIN_LOGIN"))!;
    await button.trigger("click");
    await flushPromises();
    expect(wrapper.find(".tk-login-msg").text()).toContain("登录连接失败");
    await button.trigger("click");
    await flushPromises();
    expect(login).toHaveBeenCalledTimes(2);
    wrapper.unmount();
  });
});

describe("TkAdminComment 管理操作（#1140 回归）", () => {
  /**
   * 挂载管理评论页签，并用替身 tcb 记录上报的事件载荷。
   * @returns 组件包装器与调用记录
   */
  async function mountAdminComment() {
    const calls: Array<{ event: string; data: Record<string, unknown> }> = [];
    const tcb = {
      app: {
        /**
         * 事件转发替身：记录载荷，按事件名返回固定响应。
         * @param params 事件参数
         * @returns 固定响应
         */
        callFunction: async (params: {
          name: string;
          data: { event?: string } & Record<string, unknown>;
        }) => {
          const event = String(params.data?.event ?? "");
          calls.push({ event, data: params.data });
          if (event === "COMMENT_GET_FOR_ADMIN") {
            // 管理端下发的是**原始评论文档**：主键为 _id，没有 id、没有 replies
            return {
              result: {
                code: 0,
                count: 1,
                data: [{ _id: "c1", nick: "甲", comment: "x", url: "/demo.html", created: 1 }],
              },
            };
          }
          return { result: { code: 0 } };
        },
      },
    };
    setAppState(tcb as never, { path: "/demo.html" });
    const wrapper = mount(TkAdminComment);
    await flushPromises();
    return { wrapper, calls };
  }

  it("删除/隐藏/置顶上报的 id 取自文档 _id（不是 id）", async () => {
    vi.stubGlobal("confirm", () => true);
    const { wrapper, calls } = await mountAdminComment();

    /**
     * 按按钮文案定位元素。
     * @param label 按钮文案
     * @returns 找到的按钮包装器
     */
    const findByText = (label: string) => {
      const btn = wrapper.findAll("button").find((b) => b.text() === label);
      if (!btn) throw new Error(`未找到按钮：${label}`);
      return btn;
    };

    await findByText(t("ADMIN_COMMENT_DELETE")).trigger("click");
    await flushPromises();
    expect(calls.find((c) => c.event === "COMMENT_DELETE_FOR_ADMIN")?.data.id).toBe("c1");

    await findByText(t("ADMIN_COMMENT_HIDE")).trigger("click");
    await flushPromises();
    const hide = calls.find((c) => c.event === "COMMENT_SET_FOR_ADMIN");
    expect(hide?.data.id).toBe("c1");
    expect(hide?.data.set).toEqual({ isSpam: true });

    await findByText(t("ADMIN_COMMENT_TOP")).trigger("click");
    await flushPromises();
    expect(calls.filter((c) => c.event === "COMMENT_SET_FOR_ADMIN").at(-1)?.data.id).toBe("c1");

    wrapper.unmount();
  });
});

describe("配置导出 / 导入（复用 GET_CONFIG_FOR_ADMIN + SET_CONFIG，不新增事件）", () => {
  /**
   * 直接挂在 window 上的替身值（SFC 内的裸标识符读的是 window，
   * vi.stubGlobal 在模块隔离下到不了组件上下文）。
   */
  const savedGlobals: Record<string, unknown> = {};

  /**
   * 替换 window 上的全局函数（用例结束自动还原）。
   * @param key 属性名
   * @param value 替身值
   */
  function stubWindow(key: string, value: unknown): void {
    const target = window as unknown as Record<string, unknown>;
    if (!(key in savedGlobals)) savedGlobals[key] = target[key];
    target[key] = value;
  }

  afterEach(() => {
    const target = window as unknown as Record<string, unknown>;
    for (const [key, value] of Object.entries(savedGlobals)) target[key] = value;
    for (const key of Object.keys(savedGlobals)) delete savedGlobals[key];
  });

  /**
   * 装配事件调用记录器（返回固定响应表）。
   * @param responses 事件名 → 响应载荷
   * @returns 调用记录（按发生顺序）
   */
  function useRecordingTcb(
    responses: Record<string, unknown> = {},
  ): Array<{ event: string; data: Record<string, unknown> }> {
    const calls: Array<{ event: string; data: Record<string, unknown> }> = [];
    setAppState(
      {
        app: {
          /**
           * 记录事件并返回固定响应。
           * @param params 事件参数
           * @returns 响应包络
           */
          callFunction: async (params: { name: string; data: Record<string, unknown> }) => {
            const event = String(params.data?.event ?? "");
            calls.push({ event, data: params.data });
            return { result: responses[event] ?? { code: 0 } };
          },
        },
      } as never,
      { path: "/demo.html" },
    );
    return calls;
  }

  /**
   * 在导入页签的文件选择框里注入文件。
   * @param wrapper 组件实例
   * @param content 文件内容
   */
  function injectFile(wrapper: ReturnType<typeof mount>, content: string): void {
    const input = wrapper.find('input[type="file"]').element as HTMLInputElement;
    Object.defineProperty(input, "files", {
      value: [new File([content], "config.json", { type: "application/json" })],
      writable: true,
    });
  }

  /**
   * 按文案定位按钮。
   * @param wrapper 组件实例
   * @param label 按钮文案
   * @returns 按钮包装器
   */
  function findButton(wrapper: ReturnType<typeof mount>, label: string) {
    const button = wrapper.findAll("button").find((item) => item.text().includes(label));
    if (!button) throw new Error(`未找到按钮：${label}`);
    return button;
  }

  /**
   * 挂载导入页签并选好来源。
   * @param source 导入来源
   * @returns 组件包装器
   */
  async function mountImport(source = "twikoo") {
    const wrapper = mount(TkAdminImport);
    await wrapper.find("select").setValue(source);
    return wrapper;
  }

  it("导出配置：只调用 GET_CONFIG_FOR_ADMIN，且导出内容去掉 VERSION", async () => {
    const calls = useRecordingTcb({
      GET_CONFIG_FOR_ADMIN: { code: 0, config: { SITE_NAME: "站名", VERSION: "2.0.0" } },
    });
    const blobs: Blob[] = [];
    stubWindow("URL", {
      ...URL,
      createObjectURL: (blob: Blob) => {
        blobs.push(blob);
        return "blob:test";
      },
      revokeObjectURL: () => undefined,
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    const wrapper = mount(TkAdminExport);
    await findButton(wrapper, t("ADMIN_CONFIG_EXPORT")).trigger("click");
    await flushPromises();

    expect(calls.map((call) => call.event)).toEqual(["GET_CONFIG_FOR_ADMIN"]);
    const exported = JSON.parse(await blobs[0].text()) as Record<string, unknown>;
    expect(exported.SITE_NAME).toBe("站名");
    // VERSION 是服务端回填的展示字段，导出文件里不该有，否则回灌会写进库
    expect(exported.VERSION).toBeUndefined();
    wrapper.unmount();
  });

  it("导入配置：源系统不是 Twikoo → 日志框提示且不发起任何请求", async () => {
    const calls = useRecordingTcb();
    const wrapper = await mountImport("valine");
    await findButton(wrapper, t("ADMIN_CONFIG_IMPORT")).trigger("click");
    await flushPromises();

    expect((wrapper.find("textarea").element as HTMLTextAreaElement).value).toContain(
      t("ADMIN_CONFIG_IMPORT_SOURCE_INVALID"),
    );
    expect(calls).toEqual([]);
    wrapper.unmount();
  });

  it("导入配置：固定覆盖语义提交全部键，且摘除 CREDENTIALS", async () => {
    const calls = useRecordingTcb();
    const wrapper = await mountImport("twikoo");
    injectFile(wrapper, JSON.stringify({ SITE_NAME: "新站名", CREDENTIALS: "试图覆盖" }));
    await findButton(wrapper, t("ADMIN_CONFIG_IMPORT")).trigger("click");
    await vi.waitFor(() => expect(calls.map((call) => call.event)).toEqual(["SET_CONFIG"]));
    expect(calls[0].data.config).toEqual({ SITE_NAME: "新站名" });
    wrapper.unmount();
  });

  it.each([
    ["数组", "[1,2]"],
    ["含 null 值的配置", '{"SITE_NAME":null}'],
    ["含嵌套对象的配置", '{"SITE_NAME":{"a":1}}'],
  ])("导入配置：%s → 不提交并记录格式错误", async (_label, content) => {
    const calls = useRecordingTcb();
    const wrapper = await mountImport();
    injectFile(wrapper, content);
    await findButton(wrapper, t("ADMIN_CONFIG_IMPORT")).trigger("click");
    await vi.waitFor(() =>
      expect((wrapper.find("textarea").element as HTMLTextAreaElement).value).toContain(
        t("ADMIN_CONFIG_IMPORT_INVALID"),
      ),
    );
    expect(calls).toEqual([]);
    expect(findButton(wrapper, t("ADMIN_CONFIG_IMPORT")).attributes("disabled")).toBeUndefined();
    wrapper.unmount();
  });

  it("评论导入业务失败不显示成功，并解除加载状态", async () => {
    useRecordingTcb({ COMMENT_IMPORT_FOR_ADMIN: { code: 1000, message: "无权导入" } });
    Object.assign(getAppState().tcb!.app, {
      uploadFile: async () => ({ fileID: "file" }),
    });
    const wrapper = await mountImport();
    injectFile(wrapper, "[]");
    await findButton(wrapper, t("ADMIN_IMPORT_COMMENT")).trigger("click");
    await vi.waitFor(() => {
      const log = (wrapper.find("textarea").element as HTMLTextAreaElement).value;
      expect(log).toContain("无权导入");
      expect(log).not.toContain(t("ADMIN_IMPORT_IMPORTED"));
    });
    expect(findButton(wrapper, t("ADMIN_IMPORT_COMMENT")).attributes("disabled")).toBeUndefined();
    wrapper.unmount();
  });
});
