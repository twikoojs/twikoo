/*!
 * OwO v1.0.2
 * Source: https://github.com/DIYgod/OwO/blob/master/src/OwO.js
 * Author: DIYgod
 * Modified by: iMaeGoo（1.x 内联于 src/client/lib/owo.js，2.0 迁入并补类型）
 * Released under the MIT License.
 *
 * 通过安全 DOM 构造保留图片类名，并为带 tk-owo-preview 的表情提供悬停预览。
 * 既有 OwO-* 类名与 owo.css 严格对应，新增预览容器使用 tk- 前缀。
 */
import DOMPurify from "dompurify";
import type { OwoData } from "../utils/emotion";

/** OwO 组件构造选项（1.x 选项面） */
export interface OwoOptions {
  /** 触发按钮内容（HTML，通常是图标 SVG） */
  logo?: string;
  /** 面板挂载容器 */
  container: HTMLElement;
  /** 表情插入目标输入框 */
  target: HTMLTextAreaElement | HTMLInputElement;
  /** 面板展开方向（`up` / `down`） */
  position?: string;
  /** 面板最大高度（如 `250px`） */
  maxHeight?: string;
  /** OwO 数据 */
  odata: OwoData;
}

/** OwO 默认选项（1.x 同值） */
const DEFAULT_OPTION = {
  logo: "OwO表情",
  position: "down",
  maxHeight: "250px",
  odata: {} as OwoData,
};

/** 表情选择面板（1.x `lib/owo.js` 的 TypeScript 等价物） */
export default class OwO {
  /** 面板容器 */
  container: HTMLElement;
  /** 表情插入目标 */
  target: HTMLTextAreaElement | HTMLInputElement;
  /** OwO 数据 */
  odata: OwoData;
  /** 分类页签元素 */
  packagesEle!: HTMLElement;
  /** 触发按钮元素 */
  logo!: HTMLElement;
  /** 表情插入目标（初始化后与 target 同值；1.x 同位命名） */
  area!: HTMLTextAreaElement | HTMLInputElement;
  /** 分类名列表 */
  packages!: string[];
  /** 悬停图片预览容器 */
  preview!: HTMLDivElement;

  /**
   * 构造表情面板（DOM 构建延后一个宏任务，等待容器完成渲染）。
   * @param option 构造选项
   */
  constructor(option: OwoOptions) {
    for (const [key, value] of Object.entries(DEFAULT_OPTION)) {
      if (value && !(option as unknown as Record<string, unknown>)[key]) {
        (option as unknown as Record<string, unknown>)[key] = value;
      }
    }
    this.container = option.container;
    this.target = option.target;
    if (option.position === "up") this.container.classList.add("OwO-up");
    this.odata = option.odata;
    setTimeout(() => {
      this.init(option);
    });
  }

  /**
   * 渲染面板 DOM 并绑定交互。
   * @param option 构造选项（含 logo 与 maxHeight）
   */
  init(option: OwoOptions): void {
    this.area = option.target;
    this.packages = Object.keys(this.odata);

    this.logo = document.createElement("div");
    this.logo.className = "OwO-logo";
    this.logo.appendChild(DOMPurify.sanitize(option.logo ?? "", { RETURN_DOM_FRAGMENT: true }));
    const body = document.createElement("div");
    body.className = "OwO-body";
    const bar = document.createElement("div");
    bar.className = "OwO-bar";
    this.packagesEle = document.createElement("ul");
    this.packagesEle.className = "OwO-packages";
    bar.appendChild(this.packagesEle);
    body.appendChild(bar);
    this.container.replaceChildren(this.logo, body);
    const template = document.createElement("template");
    for (const name of this.packages) {
      const opackage = this.odata[name];
      const items = document.createElement("ul");
      items.className = `OwO-items OwO-items-${opackage?.type ?? ""}`;
      items.style.maxHeight = `${parseInt(option.maxHeight ?? "250", 10) - 53}px`;
      for (const emotion of opackage?.container ?? []) {
        const item = document.createElement("li");
        item.className = "OwO-item";
        item.title = emotion.text ?? "";
        template.innerHTML = DOMPurify.sanitize(emotion.icon);
        const sourceImage = template.content.querySelector("img");
        if (sourceImage) {
          const image = document.createElement("img");
          if (sourceImage.src && DOMPurify.isValidAttribute("img", "src", sourceImage.src)) {
            image.src = sourceImage.src;
          }
          image.className = sourceImage.className;
          image.classList.add("tk-owo-emotion");
          image.alt = emotion.text ? `:${emotion.text}:` : "";
          image.loading = "lazy";
          item.appendChild(image);
        } else {
          item.textContent = emotion.icon;
        }
        items.appendChild(item);
      }
      body.insertBefore(items, bar);
      const tab = document.createElement("li");
      const label = document.createElement("span");
      label.textContent = name;
      tab.appendChild(label);
      this.packagesEle.appendChild(tab);
    }

    this.preview = document.createElement("div");
    this.preview.className = "tk-owo-preview-panel";
    this.preview.hidden = true;
    this.preview.setAttribute("aria-hidden", "true");
    const previewImage = document.createElement("img");
    previewImage.alt = "";
    this.preview.appendChild(previewImage);
    body.appendChild(this.preview);
    body.addEventListener("pointerover", (event) => {
      if (event.pointerType === "touch" || !(event.target instanceof Element)) return;
      const image = event.target
        .closest(".OwO-item")
        ?.querySelector<HTMLImageElement>("img.tk-owo-preview");
      if (image?.getAttribute("src")) {
        previewImage.src = image.src;
        previewImage.className = image.className;
        previewImage.classList.add("tk-owo-emotion");
        this.preview.hidden = false;
      } else {
        this.preview.hidden = true;
      }
    });
    body.addEventListener("pointerout", (event) => {
      const item = event.target instanceof Element ? event.target.closest(".OwO-item") : null;
      if (!item || !(event.relatedTarget instanceof Node) || !item.contains(event.relatedTarget)) {
        this.preview.hidden = true;
      }
    });
    body.addEventListener(
      "scroll",
      () => {
        this.preview.hidden = true;
      },
      true,
    );

    this.logo.addEventListener("click", () => {
      this.toggle();
    });
    body.addEventListener("click", (event) => this.onItemClick(event));

    for (let i = 0; i < this.packagesEle.children.length; i++) {
      this.packagesEle.children[i].addEventListener("click", () => {
        this.tab(i);
      });
    }

    this.tab(0);
  }

  /**
   * 点击表情项：把表情文本/Markdown 插入目标输入框并派发 input 事件。
   * @param event 面板内的点击事件
   */
  onItemClick(event: Event): void {
    const eventTarget = event.target as HTMLElement | null;
    if (!eventTarget) return;
    let item: HTMLElement | null = null;
    if (eventTarget.classList.contains("OwO-item")) {
      item = eventTarget;
    } else if (
      eventTarget.parentNode instanceof HTMLElement &&
      eventTarget.parentNode.classList.contains("OwO-item")
    ) {
      item = eventTarget.parentNode;
    }
    if (!item) return;

    const cursorPos = this.area.selectionEnd ?? this.area.value.length;
    const areaValue = this.area.value;
    let text = item.textContent ?? "";
    const image = item.querySelector("img");
    if (image) {
      if (item.title) {
        text = `:${item.title}: `;
      } else {
        const src = image.getAttribute("src");
        text = src ? `![](<${src.replace(/</g, "%3C").replace(/>/g, "%3E")}>)` : "";
      }
    }
    this.area.value = areaValue.slice(0, cursorPos) + text + areaValue.slice(cursorPos);
    // 手动触发 input 事件，让 v-model 同步到组件状态
    this.area.dispatchEvent(new Event("input", { bubbles: true }));
    this.area.focus();
    this.toggle();
  }

  /** 展开/收起面板 */
  toggle(): void {
    this.preview.hidden = true;
    this.container.classList.toggle("OwO-open");
  }

  /**
   * 切换分类页签。
   * @param index 分类下标
   */
  tab(index: number): void {
    this.preview.hidden = true;
    const itemsShow = this.container.getElementsByClassName("OwO-items-show")[0];
    if (itemsShow) itemsShow.classList.remove("OwO-items-show");
    this.container.getElementsByClassName("OwO-items")[index]?.classList.add("OwO-items-show");

    const packageActive = this.container.getElementsByClassName("OwO-package-active")[0];
    if (packageActive) packageActive.classList.remove("OwO-package-active");
    this.packagesEle.getElementsByTagName("li")[index]?.classList.add("OwO-package-active");
  }
}
