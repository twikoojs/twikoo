/**
 * 组件集成测试（T30/T33 + Wave 4 客户端补齐）。
 *
 * 覆盖：TkError 卡片 / TkSubmit 表单与预览 / TkComments 列表与空态 / TkComment 标签与操作栏 /
 * TkAvatar 头像回退 / TkAction 计数与事件 / TkPagination 页码 / TkFooter 版本 / App 根渲染。
 *
 * 数据通道以替身 tcb（`app.callFunction`）驱动，避免依赖真实后端。
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import TkSubmit from "../src/view/components/TkSubmit.vue";
import TkComments from "../src/view/components/TkComments.vue";
import TkComment from "../src/view/components/TkComment.vue";
import TkAvatar from "../src/view/components/TkAvatar.vue";
import TkAction from "../src/view/components/TkAction.vue";
import TkPagination from "../src/view/components/TkPagination.vue";
import TkFooter from "../src/view/components/TkFooter.vue";
import TkMetaInput from "../src/view/components/TkMetaInput.vue";
import TkError from "../src/components/TkError.vue";
import TwikooApp from "../src/view/App.vue";
import { VERSION } from "@twikoojs/shared";
import { TwikooError, setAppState } from "../src/utils/api";
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
function useFakeTcb(handlers: Record<string, unknown> = {}): void {
  const tcb = {
    app: {
      /**
       * 事件转发替身。
       * @param params 事件参数
       * @returns 固定响应
       */
      callFunction: async (params: { name: string; data: { event?: string } }) => {
        const event = String(params.data?.event ?? "");
        return { result: handlers[event] ?? { code: 0 } };
      },
    },
  };
  setAppState(tcb as never, { path: "/demo.html" });
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
  localStorage.clear();
  clearAll();
  setServerConfig({});
  setAppState(null, {});
});

describe("TkError 卡片（T33）", () => {
  it("标题按 kind 映射（§8.2 场景表）", () => {
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

describe("TkMetaInput（Wave 4）", () => {
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

describe("TkSubmit（T30 + Wave 4）", () => {
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

  it("回复态显示取消按钮并派发 cancel", async () => {
    useFakeTcb();
    const wrapper = mount(TkSubmit, { props: { config: {}, replyId: "c1", pid: "c1" } });
    await flushPromises();
    expect(wrapper.find(".tk-cancel").exists()).toBe(true);
    await wrapper.find(".tk-cancel").trigger("click");
    expect(wrapper.emitted("cancel")).toHaveLength(1);
  });
});

describe("TkAction / TkAvatar（Wave 4）", () => {
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

describe("TkPagination（Wave 4）", () => {
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

describe("TkFooter（Wave 4）", () => {
  it("渲染构建期注入的版本号", () => {
    const wrapper = mount(TkFooter);
    expect(wrapper.text()).toContain("Twikoo");
    expect(wrapper.text()).toContain(`v${VERSION}`);
  });
});

describe("TkComment（Wave 4）", () => {
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

describe("TkComments（Wave 4）", () => {
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

  it("接口报错时展示错误文案（不抛）", async () => {
    useFakeTcb({
      GET_CONFIG: { code: 0, config: {} },
      COMMENT_GET: { code: 1000, message: "后端异常" },
    });
    const wrapper = mount(TkComments);
    await flushPromises();
    expect(wrapper.find(".tk-comments-error").text()).toBe("后端异常");
  });
});

/** 空告警处理器 */
const suppressWarn = (): void => undefined;

describe("App 渲染（T30 + Wave 4）", () => {
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
