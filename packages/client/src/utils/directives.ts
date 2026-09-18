/**
 * 自定义指令（1.x 经 element-ui 引入的两个指令的 `tk-` 等价实现，§5.3/D-1）。
 *
 * - `v-loading`：Element UI `Loading` 指令的等价物——在宿主元素上叠加遮罩与旋转
 *   指示器，并保证宿主 `position: relative`（否则遮罩会溢出到祖先定位上下文）。
 * - `v-clickoutside`：Element UI `Clickoutside` 的等价物——用于表情面板「点击外部
 *   收起」。为避免多实例互相干扰，每个元素只在自身卸载时移除监听。
 *
 * 两者都**不引入任何第三方依赖**（element-ui 已移除），类名改为 `tk-` 前缀。
 */
import type { DirectiveBinding, ObjectDirective } from "vue";

/** 遮罩元素标记（避免重复插入；用属性而非 WeakMap，便于宿主被整块替换后自愈） */
const MASK_FLAG = "data-tk-loading";

/** v-clickoutside 监听器标记 */
const CLICKOUTSIDE_FLAG = "data-tk-clickoutside";

/**
 * 查找宿主**直接子节点**中的遮罩。
 *
 * 必须限定直接子节点：`.tk-admin` 里还嵌着同样使用 `v-loading` 的
 * `.tk-admin-comment` / `.tk-admin-config`，用后代查询会命中嵌套宿主的遮罩，
 * 结果是「删掉别人的、留下自己的」——遮罩再也去不掉（一直在转圈）。
 * @param el 宿主元素
 * @returns 遮罩元素（不存在时为 undefined）
 */
function findMask(el: HTMLElement): Element | null {
  for (const child of Array.from(el.children)) {
    if (child.hasAttribute(MASK_FLAG)) return child;
  }
  return null;
}

/**
 * 创建并插入加载遮罩。
 * @param el 宿主元素
 */
function insertMask(el: HTMLElement): void {
  if (findMask(el)) return;
  const mask = document.createElement("div");
  mask.setAttribute(MASK_FLAG, "1");
  mask.className = "tk-loading-mask";
  const spinner = document.createElement("div");
  spinner.className = "tk-loading-spinner";
  spinner.innerHTML =
    '<svg class="circular" viewBox="25 25 50 50">' +
    '<circle class="path" cx="50" cy="50" r="20" fill="none"></circle></svg>';
  mask.appendChild(spinner);
  el.appendChild(mask);
}

/**
 * 移除加载遮罩并复位宿主定位。
 * @param el 宿主元素
 */
function removeMask(el: HTMLElement): void {
  findMask(el)?.remove();
  el.classList.remove("tk-loading-parent--relative");
}

/**
 * `v-loading` 的挂载/更新处理。
 * @param el 宿主元素
 * @param binding 指令绑定（值为真时显示遮罩）
 */
function updateLoading(el: HTMLElement, binding: DirectiveBinding<boolean>): void {
  if (binding.value) {
    // 空串表示「未显式设置」（部分 DOM 实现返回空串而非 static），同样需要补 relative
    const position = getComputedStyle(el).position;
    if (!position || position === "static") el.classList.add("tk-loading-parent--relative");
    insertMask(el);
  } else {
    removeMask(el);
  }
}

/** `v-loading` 指令（遮罩 + 旋转指示器；宿主定位不足时自动补 relative） */
export const vLoading: ObjectDirective<HTMLElement, boolean> = {
  mounted: updateLoading,
  updated: updateLoading,
  unmounted: removeMask,
};

/**
 * `v-clickoutside` 的挂载处理：在 document 上注册捕获阶段点击监听。
 * @param el 宿主元素
 * @param binding 指令绑定（值为「点击外部」回调）
 */
function mountClickoutside(el: HTMLElement, binding: DirectiveBinding<() => void>): void {
  removeClickoutside(el);
  /**
   * 捕获阶段点击处理：目标不在宿主内则回调。
   * @param event 点击事件
   */
  const handler = (event: Event): void => {
    const target = event.target as Node | null;
    if (!target || el === target || el.contains(target)) return;
    binding.value?.();
  };
  (el as HTMLElement & { __tkClickoutside?: (event: Event) => void }).__tkClickoutside = handler;
  document.addEventListener("click", handler, true);
}

/**
 * `v-clickoutside` 的卸载处理：移除 document 监听。
 * @param el 宿主元素
 */
function removeClickoutside(el: HTMLElement): void {
  const host = el as HTMLElement & { __tkClickoutside?: (event: Event) => void };
  if (!host.__tkClickoutside) return;
  document.removeEventListener("click", host.__tkClickoutside, true);
  delete host.__tkClickoutside;
}

/** `v-clickoutside` 指令（点击元素外部时回调；值为回调函数） */
export const vClickoutside: ObjectDirective<HTMLElement, () => void> = {
  mounted: mountClickoutside,
  updated: mountClickoutside,
  unmounted: removeClickoutside,
};

/** 供测试与调试使用的标记名（避免魔法字符串散落） */
export const DIRECTIVE_MARKS = { MASK_FLAG, CLICKOUTSIDE_FLAG } as const;
