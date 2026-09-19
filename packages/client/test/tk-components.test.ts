/**
 * tk-* 组件单测（组合式 API 组件）。
 *
 * 覆盖：button type×size×disabled×loading；input v-model/textarea/字数统计/focus()；
 * loading 遮罩显隐；icon 按需 SVG（含未注册告警）；mini 与 small 尺寸有可见差异。
 */
import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import TkButton from "../src/components/TkButton.vue";
import TkInput from "../src/components/TkInput.vue";
import TkLoading from "../src/components/TkLoading.vue";
import TkIcon from "../src/components/TkIcon.vue";

describe("TkButton（组合式）", () => {
  it("type×size 类名组合；mini 与 small 有可见差异（类名互斥）", () => {
    const primary = mount(TkButton, { props: { type: "primary", size: "small" } });
    expect(primary.classes()).toContain("tk-button--primary");
    expect(primary.classes()).toContain("tk-button--small");
    const mini = mount(TkButton, { props: { size: "mini" } });
    expect(mini.classes()).toContain("tk-button--mini");
    expect(mini.classes()).not.toContain("tk-button--small");
  });

  it("disabled 与 loading 状态类 + 原生禁用 + loading 时渲染 spinner 图标", () => {
    const wrapper = mount(TkButton, { props: { disabled: true, loading: true } });
    expect(wrapper.classes()).toContain("is-disabled");
    expect(wrapper.classes()).toContain("is-loading");
    expect(wrapper.attributes("disabled")).toBeDefined();
    // loading 时渲染 fontawesome SVG（按需引入）
    expect(wrapper.find(".tk-button__spinner svg").exists()).toBe(true);
  });

  it("click 事件转发；禁用态点击不触发", async () => {
    const enabled = mount(TkButton);
    await enabled.trigger("click");
    expect(enabled.emitted("click")).toHaveLength(1);
    const disabled = mount(TkButton, { props: { disabled: true } });
    await disabled.trigger("click");
    expect(disabled.emitted("click")).toBeUndefined();
  });
});

describe("TkInput（组合式）", () => {
  it("v-model 输入转发", async () => {
    const wrapper = mount(TkInput, { props: { modelValue: "" } });
    await wrapper.find("input").setValue("hello");
    expect(wrapper.emitted("update:modelValue")?.[0]).toEqual(["hello"]);
  });

  it("textarea 形态 + 字数统计（maxlength + showWordLimit）", () => {
    const wrapper = mount(TkInput, {
      props: { type: "textarea", rows: 4, maxlength: 100, showWordLimit: true, modelValue: "abc" },
    });
    expect(wrapper.find("textarea").exists()).toBe(true);
    expect(wrapper.find(".tk-input__count").text()).toBe("3/100");
  });

  it("focus() 经 defineExpose 暴露并聚焦原生输入框", () => {
    const wrapper = mount(TkInput, { props: { modelValue: "" } });
    const input = wrapper.find("input").element as HTMLInputElement;
    const focusSpy = vi.spyOn(input, "focus");
    (wrapper.vm as unknown as { focus(): void }).focus();
    expect(focusSpy).toHaveBeenCalled();
  });

  it("disabled 态样式类", () => {
    const wrapper = mount(TkInput, { props: { disabled: true } });
    expect(wrapper.classes()).toContain("is-disabled");
  });
});

describe("TkLoading（组合式）", () => {
  it("visible 控制遮罩显隐（v-show）", () => {
    const shown = mount(TkLoading, { props: { visible: true } });
    const shownEl = shown.find(".tk-loading-mask").element as HTMLElement;
    const hidden = mount(TkLoading, { props: { visible: false } });
    const hiddenEl = hidden.find(".tk-loading-mask").element as HTMLElement;
    expect(hiddenEl.style.display).toBe("none");
    expect(shownEl.style.display).not.toBe("none");
  });
});

describe("TkIcon（组合式，按需 SVG）", () => {
  it("注册图标：渲染 fontawesome 官方 SVG 内容（按需引入，非字体）", () => {
    const wrapper = mount(TkIcon, { props: { name: "heart" } });
    // 渲染的是内联 <svg>（来自 svgs/solid/heart.svg 原文件）
    expect(wrapper.find("svg").exists()).toBe(true);
    expect(wrapper.find("svg").attributes("viewBox")).toBe("0 0 512 512");
  });

  it("未注册图标：渲染空并告警", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const wrapper = mount(TkIcon, { props: { name: "no-such-icon" } });
    expect(wrapper.text()).toBe("");
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
