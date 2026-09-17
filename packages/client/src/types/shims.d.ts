/** Vue SFC 与非 TS 资源的类型垫片 */
declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<object, object, unknown>;
  export default component;
}

/** process.env（浏览器端构建期注入；@types/node 不入浏览器类型面） */
declare const process: {
  env: Record<string, string | undefined>;
};

/** Vite ?raw 导入（SVG 按需内联） */
declare module "*.svg?raw" {
  const content: string;
  export default content;
}

/**
 * prismjs core 的最小类型垫片。
 *
 * 选型记录（T29 客户端补齐）：不引入 `@types/prismjs`——本项目只用
 * `plugins`（插件注册表，autoloader 的 `languages_path` 挂在上面）与
 * `highlightAllUnder` 两个成员；同时 prismjs 插件是**副作用模块**（自挂全局
 * Prism），官方 @types 也不覆盖子路径。自建垫片可让类型与用法严格对齐、
 * 并免掉一个 devDependency。
 */
declare module "prismjs" {
  const Prism: {
    /** 插件注册表（autoloader / toolbar 等把自身挂在这里） */
    plugins: Record<string, Record<string, unknown>>;
    /**
     * 高亮容器内的全部代码块。
     * @param element 容器元素
     */
    highlightAllUnder: (element: Element) => void;
  };
  export default Prism;
}

/** prismjs 子路径插件：副作用模块（挂到全局 Prism），无导出 */
declare module "prismjs/plugins/*";

/**
 * blueimp-md5（无官方类型包；本项目仅使用 `md5(string) → hex` 一种用法）。
 * 为什么需要 md5：`GRAVATAR_CDN === 'cravatar.cn'` 时必须用 md5，其余 CDN 用
 * sha256——这是 1.x 的既有行为（BC 保持），不可统一。
 */
declare module "blueimp-md5" {
  const md5: (value: string) => string;
  export default md5;
}
