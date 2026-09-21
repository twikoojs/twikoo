/**
 * 组件集成测试。
 *
 * 覆盖：TkError 卡片 / TkSubmit 表单与预览 / TkComments 列表与空态 / TkComment 标签与操作栏 /
 * TkAvatar 头像回退 / TkAction 计数与事件 / TkPagination 页码 / TkFooter 版本 / App 根渲染。
 *
 * 数据通道以替身 tcb（`app.callFunction`）驱动，避免依赖真实后端。
 */
import { afterEach, describe, expect, it, vi } from "vitest";
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
import TwikooApp from "../src/App.vue";
import { VERSION } from "@twikoojs/shared";
import { TwikooError, setAppState } from "../src/utils/api";
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
