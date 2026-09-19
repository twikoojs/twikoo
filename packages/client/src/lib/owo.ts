/*!
 * OwO v1.0.2
 * Source: https://github.com/DIYgod/OwO/blob/master/src/OwO.js
 * Author: DIYgod
 * Modified by: iMaeGoo（1.x 内联于 src/client/lib/owo.js，2.0 原样迁入并补类型）
 * Released under the MIT License.
 *
 * 2.0 变更：仅补 TypeScript 类型与 JSDoc，行为与 1.x 完全一致（表情面板 DOM 结构
 * 与 owo.css 的选择器严格对应，不可改动类名）。
 */
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

    let html = `<div class="OwO-logo">${option.logo ?? ""}</div><div class="OwO-body">`;
    for (const packageName of this.packages) {
      const maxHeight = parseInt(option.maxHeight ?? "250", 10) - 53;
      html += `<ul class="OwO-items OwO-items-${this.odata[packageName]?.type ?? ""}" style="max-height: ${maxHeight}px;">`;
      for (const item of this.odata[packageName]?.container ?? []) {
        html += `<li class="OwO-item" title="${item.text ?? ""}">${item.icon.replace("<img", '<img loading="lazy"')}</li>`;
      }
      html += "</ul>";
    }
    html +=
      '<div class="OwO-bar"><ul class="OwO-packages">' +
      this.packages.map((name) => `<li><span>${name}</span></li>`).join("") +
      "</ul></div></div>";
    this.container.innerHTML = html;

    this.logo = this.container.getElementsByClassName("OwO-logo")[0] as HTMLElement;
    this.logo.addEventListener("click", () => {
      this.toggle();
    });

    this.container
      .getElementsByClassName("OwO-body")[0]
      ?.addEventListener("click", (event) => this.onItemClick(event));

    this.packagesEle = this.container.getElementsByClassName("OwO-packages")[0] as HTMLElement;
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
    let innerHTML = item.innerHTML;
    if (innerHTML.indexOf("<img") !== -1) {
      if (item.title) {
        // 有 text 的图片表情按 OwO 语法插入
        innerHTML = `:${item.title}: `;
      } else {
        // 无 text 时退化为 Markdown 图片
        const start = innerHTML.indexOf('src="') + 'src="'.length;
        const end = innerHTML.indexOf('"', start);
        if (start !== -1 && end !== -1) {
          innerHTML = `![${item.title || ""}](${innerHTML.substring(start, end)})`;
        }
      }
    }
    this.area.value = areaValue.slice(0, cursorPos) + innerHTML + areaValue.slice(cursorPos);
    // 手动触发 input 事件，让 v-model 同步到组件状态
    this.area.dispatchEvent(new Event("input", { bubbles: true }));
    this.area.focus();
    this.toggle();
  }

  /** 展开/收起面板 */
  toggle(): void {
    this.container.classList.toggle("OwO-open");
  }

  /**
   * 切换分类页签。
   * @param index 分类下标
   */
  tab(index: number): void {
    const itemsShow = this.container.getElementsByClassName("OwO-items-show")[0];
    if (itemsShow) itemsShow.classList.remove("OwO-items-show");
    this.container.getElementsByClassName("OwO-items")[index]?.classList.add("OwO-items-show");

    const packageActive = this.container.getElementsByClassName("OwO-package-active")[0];
    if (packageActive) packageActive.classList.remove("OwO-package-active");
    this.packagesEle.getElementsByTagName("li")[index]?.classList.add("OwO-package-active");
  }
}
