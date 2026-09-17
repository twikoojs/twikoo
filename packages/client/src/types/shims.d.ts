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
