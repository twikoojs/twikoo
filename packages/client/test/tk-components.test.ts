/**
 * tk-* 组件单测（T29 / §5.3.2 路线 B）。
 *
 * 覆盖 Acceptance：input 全 prop 组合 + focus() + textarea 字数统计；
 * button type×size×disabled×loading；loading 遮罩显隐；icon 类名透传；
 * mini 与 small 尺寸有可见差异（QA−：mini 不得映射为 small）。
 */
import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import TkButton from "../src/components/TkButton.vue";
import TkInput from "../src/components/TkInput.vue";
import TkLoading from "../src/components/TkLoading.vue";
import TkIcon from "../src/components/TkIcon.vue";

describe("TkButton（T29）", () => {
  it("type×size 类名组合", () => {
    const primary = mount(TkButton, { props: { type: "primary", size: "small" } });
    expect(primary.classes()).toContain("tk-button--primary");
    expect(primary.classes()).toContain("tk-button--small");
    const mini = mount(TkButton, { props: { size: "mini" } });
    expect(mini.classes()).toContain("tk-button--mini");
    // mini 与 small 有可见差异（类名不同，§5.3）
    expect(mini.classes()).not.toContain("tk-button--small");
  });

  it("disabled 与 loading 状态类 + 原生禁用", async () => {
    const wrapper = mount(TkButton, { props: { disabled: true, loading: true } });
    expect(wrapper.classes()).toContain("is-disabled");
    expect(wrapper.classes()).toContain("is-loading");
    expect(wrapper.attributes("disabled")).toBeDefined();
    // 禁用态点击不触发 click 事件
    await wrapper.trigger("click");
    expect(wrapper.emitted("click")).toBeUndefined();
  });

  it("click 事件转发", async () => {
    const wrapper = mount(TkButton);
    await wrapper.trigger("click");
    expect(wrapper.emitted("click")).toHaveLength(1);
  });
});

describe("TkInput（T29）", () => {
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

  it("focus() 方法聚焦原生输入框", () => {
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

describe("TkLoading（T29）", () => {
  it("visible 控制遮罩显隐（v-show）", () => {
    const shown = mount(TkLoading, { props: { visible: true } });
    // happy-dom 下 v-show=false 渲染 display:none
    const hidden = mount(TkLoading, { props: { visible: false } });
    const shownEl = shown.find(".tk-loading-mask").element as HTMLElement;
    const hiddenEl = hidden.find(".tk-loading-mask").element as HTMLElement;
    expect(hiddenEl.style.display).toBe("none");
    expect(shownEl.style.display).not.toBe("none");
  });
});

describe("TkIcon（T29）", () => {
  it("fontawesome 类名透传（禁自写 SVG：组件内无 <svg> 元素）", () => {
    const wrapper = mount(TkIcon, { props: { name: "fa-solid fa-paper-plane" } });
    expect(wrapper.classes()).toContain("tk-icon");
    expect(wrapper.find("svg").exists()).toBe(false);
    expect(wrapper.html()).toContain("fa-paper-plane");
  });
});
