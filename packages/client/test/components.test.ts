/**
 * 组件集成测试（T30/T33）：App 渲染 / TkSubmit 表单 / TkError 卡片。
 */
import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import TkSubmit from "../src/components/TkSubmit.vue";
import TkError from "../src/components/TkError.vue";
import TwikooApp from "../src/view/App.vue";
import { TwikooError } from "../src/utils/api";

describe("TkSubmit（T30）", () => {
  it("必填字段未填 → 发送按钮禁用", () => {
    const wrapper = mount(TkSubmit);
    const buttons = wrapper.findAll("button");
    const sendBtn = buttons.find((b) => b.text() === "发送");
    expect(sendBtn?.attributes("disabled")).toBeDefined();
  });

  it("填写昵称与内容 → 发送按钮可用", async () => {
    const wrapper = mount(TkSubmit);
    const inputs = wrapper.findAll("input");
    await inputs[0].setValue("测试用户");
    await wrapper.find("textarea").setValue("测试内容");
    const buttons = wrapper.findAll("button");
    const sendBtn = buttons.find((b) => b.text() === "发送");
    expect(sendBtn?.attributes("disabled")).toBeUndefined();
  });

  it("预览：marked 渲染 + 消毒", async () => {
    const wrapper = mount(TkSubmit);
    const inputs = wrapper.findAll("input");
    await inputs[0].setValue("用户");
    await wrapper.find("textarea").setValue("**加粗预览**");
    const previewBtn = wrapper.findAll("button").find((b) => b.text() === "预览");
    await previewBtn?.trigger("click");
    expect(wrapper.find(".tk-preview-container").exists()).toBe(true);
    expect(wrapper.find(".tk-preview-container").html()).toContain("<strong>加粗预览</strong>");
  });
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

/** 空告警处理器 */
const suppressWarn = (): void => undefined;

describe("App 渲染（T30）", () => {
  it("挂载产出 .twikoo 容器与提交区", () => {
    const wrapper = mount(TwikooApp, {
      /** 挂载配置：压制开发告警 */
      global: {
        config: { warnHandler: suppressWarn },
      },
    });
    expect(wrapper.find(".twikoo").exists()).toBe(true);
    expect(wrapper.find("#twikoo-submit").exists()).toBe(true);
    wrapper.unmount();
  });
});
