/** OwO 面板的数据安全、插入文本与悬停预览回归。 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OwO from "../src/lib/owo";
import { initMarkedOwo, type OwoData } from "../src/utils/emotion";
import { parseMarkdown } from "../src/utils/marked";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

/** 挂载表情面板并完成延迟初始化。 */
function mountOwo(odata: OwoData) {
  const container = document.createElement("div");
  const target = document.createElement("textarea");
  container.className = "OwO";
  document.body.append(container, target);
  const owo = new OwO({ container, target, odata });
  vi.runAllTimers();
  return { container, target, owo };
}

describe("OwO 面板回归", () => {
  it("分类名、表情名和 HTML 不能注入活动属性或额外节点", () => {
    const name = '<img src=x onerror="bad()">';
    const title = 'face" onclick="bad()';
    const odata = {
      [name]: {
        type: 'image" onclick="bad()',
        container: [
          {
            text: title,
            icon: ' <span><img src="https://owo.test/face.png" class="custom tk-owo-preview" onerror="bad()" style="color:red"></span><script>bad()</script>',
          },
          { icon: '<img src="javascript:bad()" onerror="bad()">' },
          { icon: '<svg onload="bad()"></svg>' },
        ],
      },
    };
    const { container } = mountOwo(odata);
    expect(container.querySelector(".OwO-packages span")?.textContent).toBe(name);
    const items = container.querySelectorAll<HTMLLIElement>(".OwO-item");
    expect(items[0].title).toBe(title);
    const image = items[0].querySelector("img")!;
    expect(image.className).toBe("custom tk-owo-preview tk-owo-emotion");
    expect(image.alt).toBe(`:${title}:`);
    expect(image.loading).toBe("lazy");
    expect(items[1].querySelector("img")?.hasAttribute("src")).toBe(false);
    expect(items[2].textContent).toBe('<svg onload="bad()"></svg>');
    expect(container.querySelector("[onerror], [onclick], [onload], script, svg")).toBeNull();
    expect(image.hasAttribute("style")).toBe(false);
  });

  it("包裹元素中的图片类名会传递到 Markdown 表情", () => {
    const imgs = initMarkedOwo({
      image: {
        type: "image",
        container: [
          {
            text: "__proto__",
            icon: ' <span><img src="https://owo.test/face.png" class="custom tk-owo-preview"></span>',
          },
        ],
      },
    });
    expect(Object.hasOwn(imgs, "__proto__")).toBe(true);
    const template = document.createElement("template");
    template.innerHTML = parseMarkdown(":__proto__:");
    const image = template.content.querySelector("img")!;
    expect(image.classList.contains("custom")).toBe(true);
    expect(image.classList.contains("tk-owo-emotion")).toBe(true);
    expect(image.alt).toBe(":__proto__:");
  });

  it("按原文插入文字表情，匿名图片地址包含括号也能正确解析", () => {
    const { container, target } = mountOwo({
      emoji: {
        container: [{ icon: "<3 & >_<" }, { icon: '<img src="https://owo.test/a(b).png">' }],
      },
    });
    const input = vi.fn();
    target.addEventListener("input", input);
    const items = container.querySelectorAll(".OwO-item");
    items[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(target.value).toBe("<3 & >_<");
    target.value = "";
    items[1].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const template = document.createElement("template");
    template.innerHTML = parseMarkdown(target.value);
    expect(template.content.querySelector("img")?.src).toBe("https://owo.test/a(b).png");
    expect(input).toHaveBeenCalledTimes(2);
  });

  it("仅预览带标记的图片，离开、滚动、切换分类和关闭面板都会隐藏", () => {
    const { container, owo } = mountOwo({
      image: {
        container: [
          {
            text: "preview",
            icon: '<img src="https://owo.test/face.png" class="tk-owo-preview custom">',
          },
          { text: "normal", icon: '<img src="https://owo.test/normal.png">' },
        ],
      },
      emoji: { container: [{ icon: "😄" }] },
    });
    const items = container.querySelectorAll(".OwO-item");
    const image = items[0].querySelector("img")!;
    const preview = container.querySelector<HTMLDivElement>(".tk-owo-preview-panel")!;
    const over = new PointerEvent("pointerover", { bubbles: true, pointerType: "mouse" });
    owo.toggle();
    image.dispatchEvent(new PointerEvent("pointerover", { bubbles: true, pointerType: "touch" }));
    expect(preview.hidden).toBe(true);
    image.dispatchEvent(over);
    expect(preview.hidden).toBe(false);
    expect(preview.querySelector("img")?.src).toBe(image.src);
    expect(preview.querySelector("img")?.classList.contains("custom")).toBe(true);
    image.dispatchEvent(new PointerEvent("pointerout", { bubbles: true, relatedTarget: items[0] }));
    expect(preview.hidden).toBe(false);
    image.dispatchEvent(new PointerEvent("pointerout", { bubbles: true }));
    expect(preview.hidden).toBe(true);
    image.dispatchEvent(over);
    items[1].dispatchEvent(over);
    expect(preview.hidden).toBe(true);
    image.dispatchEvent(over);
    container.querySelector(".OwO-items")!.dispatchEvent(new Event("scroll"));
    expect(preview.hidden).toBe(true);
    image.dispatchEvent(over);
    owo.tab(1);
    expect(preview.hidden).toBe(true);
    owo.tab(0);
    image.dispatchEvent(over);
    owo.toggle();
    expect(preview.hidden).toBe(true);
  });

  it("空表情包仍可展开与关闭", () => {
    const { owo, container } = mountOwo({});
    expect(() => owo.toggle()).not.toThrow();
    expect(container.classList.contains("OwO-open")).toBe(true);
    expect(container.querySelectorAll(".OwO-item")).toHaveLength(0);
  });
});
