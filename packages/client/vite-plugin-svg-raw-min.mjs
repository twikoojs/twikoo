/**
 * twikoo SVG `?raw` 内联最小化插件（build.mjs 与 vite.config.ts 共用）。
 *
 * 背景：`src/components/icons.ts` 按需 `?raw` 引入 FontAwesome SVG（41 枚），每枚
 * 都内嵌约 300 字节的 `<!--! Font Awesome Free ... -->` license 注释与缩进空白，
 * 全部随产物发给访客。本插件在构建期用 svgo 压缩：
 * - `preset-default`：合并文本节点、压缩 path 数据与空白（无损、保留 viewBox 与 xmlns）；
 * - 自定义 `strip-license-comments`：删除所有 comment 节点（svgo v4 的内置
 *   `removeComments` 实测不删 `<!--!` 重要注释，故自写）。图标版权信息以集中声明
 *   形式保留在 `icons.ts` 头注释（CC BY 4.0 要求署名，不要求保留在每枚文件内）。
 *
 * 实现说明：rolldown-vite（Vite 8）里 core 的 `?raw` load 钩子先于用户插件的 load
 * 执行，transform 阶段拿到的已是 `export default "<svg…>"` 的 JS 模块，故这里在
 * transform 里解析该字符串字面量 → svgo 压缩 → 重新导出。dev 与四产物构建行为一致。
 */
import { optimize } from "svgo";

/** 删除 SVG 里所有 comment 节点（license 注释随 icons.ts 头注释集中保留） */
const stripLicenseComments = {
  name: "strip-license-comments",
  fn: () => ({
    comment: {
      /**
       * 摘除当前 comment 节点。
       * @param node comment 节点
       * @param parentNode 父节点（root 层不处理）
       */
      enter: (node, parentNode) => {
        if (parentNode.type === "root") return;
        parentNode.children.splice(parentNode.children.indexOf(node), 1);
      },
    },
  }),
};

/** svgo 压缩选项（41 枚图标共用；固定配置便于全仓复现产物） */
const SVGO_OPTIONS = {
  js2svg: { indent: 0, pretty: false },
  plugins: ["preset-default", stripLicenseComments],
};

/** raw 模块的形态：`export default "<svg…>";`（core 用 JSON.stringify 生成，可 JSON.parse） */
const RAW_MODULE_RE = /^export default ("(?:[^"\\]|\\.)*");?\s*$/;

/** twikoo SVG `?raw` 最小化插件 */
export default function twikooSvgRawMin() {
  return {
    name: "twikoo-svg-raw-min",
    /**
     * 压缩 raw SVG 模块。
     * @param code 模块代码（`export default "<svg…>"`）
     * @param id 模块标识（仅处理 `.svg?raw`）
     * @returns 压缩后的 raw 模块代码；非目标模块或形态不符时返回 null 交回管线
     */
    transform(code, id) {
      if (!id.endsWith(".svg?raw")) return null;
      const matched = code.match(RAW_MODULE_RE);
      if (!matched) {
        this.warn(`unexpected raw module shape for ${id}, skip svg minify`);
        return null;
      }
      const minified = optimize(JSON.parse(matched[1]), SVGO_OPTIONS).data;
      return `export default ${JSON.stringify(minified)}`;
    },
  };
}
