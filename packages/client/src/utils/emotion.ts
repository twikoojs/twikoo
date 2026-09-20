/**
 * OwO 表情数据加载（1.x `utils/emotion.js` 语义对齐）。
 *
 * 职责：
 * - 从 `EMOTION_CDN`（英文逗号分隔，可多个）拉取 OwO 数据；
 * - 兼容「不规范」的 OwO 数据格式（缺 `text` 时取图片文件名，1.x 行为）；
 * - 产出两样东西：
 *   ① `OwoData`：交给表情选择面板（`lib/owo.ts`）渲染；
 *   ② `text → 图片地址` 映射：经 {@link setOwoImages} 注册给 marked 的 owo 扩展，
 *      使评论正文里的 `:xxx:` 渲染为 `<img class="tk-owo-emotion">`。
 *
 * 2.0 相对 1.x 的修正：请求失败时**结算为 `{}`**（1.x 在该分支既不 resolve 也不
 * reject，会让 `Promise.all` 永久挂起）。成功路径行为完全一致。
 */
import { logger } from "./logger";
import { setOwoImages } from "./marked";

/** OwO 单个表情项（图片或纯文字） */
export interface OwoItem {
  /** 表情名（`:` 包裹的名字；缺失时由图片文件名推导） */
  text?: string;
  /** 表情 HTML（`<img ...>`）或纯文本 */
  icon: string;
}

/** OwO 一个「包」（面板底部的一个分类页签） */
export interface OwoPackage {
  /** 面板样式类型（`image` / `emoji`），影响面板内边距 */
  type?: string;
  /** 该包内的表情列表 */
  container: OwoItem[];
}

/** OwO 全量数据（包名 → 包内容） */
export type OwoData = Record<string, OwoPackage>;

/** 供解析 `icon` HTML 取 `src` 的复用的 template 元素（避免每次创建） */
const template = document.createElement("template");

/**
 * 从表情 HTML 片段中取出图片地址。
 * @param html 表情的 icon HTML
 * @returns 图片地址；解析失败返回空串
 */
function getImgSrc(html: string): string {
  try {
    template.innerHTML = html;
    const first = template.content.childNodes[0] as HTMLImageElement | undefined;
    return first?.src ?? "";
  } catch (e) {
    logger.warn("OwO 表情解析失败", e);
    return "";
  }
}

/**
 * 取 URL 的文件名（去 query/hash）。
 * @param url 图片地址
 * @returns 文件名
 */
function getFilename(url: string): string {
  return url.split("#").shift()?.split("?")?.shift()?.split("/").pop() ?? "";
}

/**
 * 格式化不规范的 OwO 数据：为缺 `text` 的图片表情补上文件名作为表情名。
 * @param odata 原始 OwO 数据
 * @returns 补齐后的数据；结构异常时返回 undefined（1.x 行为）
 */
function formatOdata(odata: OwoData): OwoData | undefined {
  try {
    for (const item of Object.values(odata)) {
      if (item.type !== "image") continue;
      for (const image of item.container) {
        if (!image.text) image.text = getFilename(getImgSrc(image.icon));
      }
    }
    return odata;
  } catch (e) {
    logger.warn("OwO 数据格式异常", e);
    return undefined;
  }
}

/**
 * 拉取单个 OwO 数据源。
 * @param api 数据源地址
 * @returns OwO 数据（失败时为 `{}`，不抛错）
 */
function initOwoEmotion(api: string): Promise<OwoData> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.onreadystatechange = () => {
      if (xhr.readyState !== 4) return;
      if ((xhr.status >= 200 && xhr.status < 300) || xhr.status === 304) {
        try {
          resolve(formatOdata(JSON.parse(xhr.responseText) as OwoData) ?? {});
        } catch (e) {
          logger.warn("OwO 数据解析失败", e);
          resolve({});
        }
      } else {
        logger.warn(`OwO 数据请求失败：${xhr.status}`);
        resolve({});
      }
    };
    try {
      xhr.open("get", api, true);
      xhr.send(null);
    } catch (e) {
      logger.warn("OwO 数据请求异常", e);
      resolve({});
    }
  });
}

/**
 * 拉取并合并多个 OwO 数据源（`EMOTION_CDN` 以英文逗号分隔）。
 * @param apis 数据源地址串
 * @returns 合并后的 OwO 数据
 */
export async function initOwoEmotions(apis: string): Promise<OwoData> {
  const odata: OwoData = {};
  const odatas = await Promise.all(apis.split(",").map((api) => initOwoEmotion(api.trim())));
  Object.assign(odata, ...odatas);
  return odata;
}

/**
 * 从 OwO 数据构建 `表情名 → 图片地址` 映射，并注册给 marked 的 owo 扩展。
 *
 * 1.x 把映射塞进 `marked.setOptions({ odata })`；2.0 改为经 {@link setOwoImages}
 * 注入扩展闭包（表情映射不再污染 marked options）。
 * @param odata OwO 数据
 * @returns `表情名 → 图片地址` 映射
 */
export function initMarkedOwo(odata: OwoData): Record<string, string> {
  const imgs: Record<string, string> = {};
  for (const item of Object.values(odata ?? {})) {
    for (const img of item.container ?? []) {
      const imgSrc = getImgSrc(img.icon);
      if (imgSrc && img.text) imgs[img.text] = imgSrc;
    }
  }
  setOwoImages(imgs);
  return imgs;
}
