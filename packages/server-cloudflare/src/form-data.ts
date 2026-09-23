/**
 * 原生 FormData 垫片（经 `setCustomLibs` 注入，替代 `form-data` 包）。
 *
 * **为什么必须垫**：`@twikoojs/common` 的图片上传、NSFW 检测、Turnstile 验证码三条
 * 链路都经 `getFormData(caps)` 取 FormData。默认实现加载 `form-data` 包，它把载荷编成
 * **Node 可读流**（`getBuffer()`），而 Workers 的 `fetch` body 只接受原生
 * `FormData` / `Blob` / 字符串 —— 声明该依赖也发不出 multipart 请求（1.x
 * twikoo-cloudflare 因此自己写了一份 R2 上传，绕开了公共上传链路）。
 *
 * **垫片的形状**：继承原生 `FormData`，只做两件事——
 * 1. `append` 把 `Buffer`/`Uint8Array`（`services/upload.ts` 传入的图片字节）转成
 *    `Blob`，并把 `{ filename, contentType }` 映射到原生 `append(name, blob, filename)`；
 * 2. `getHeaders()` 返回空对象：multipart 边界由 fetch 自己生成，
 *    `@twikoojs/common` 的 `http.ts` 会对原生 FormData 直通（不序列化、不补头）。
 */
import type { FormDataLike } from "@twikoojs/common";

/** append 的第三参形态（`form-data` 包形态：文件名 + 内容类型 + 长度） */
interface AppendOptions {
  /** 文件名 */
  filename?: string;
  /** 内容类型（决定 Blob 的 MIME） */
  contentType?: string;
}

/**
 * 判断是否为二进制载荷（Buffer 是 Uint8Array 的子类，故用 ArrayBuffer.isView 统一识别）。
 * @param value 待判断值
 * @returns 是否二进制
 */
function isBinary(value: unknown): value is ArrayBufferView | ArrayBuffer {
  return ArrayBuffer.isView(value) || value instanceof ArrayBuffer;
}

/**
 * 构造可注入 `setCustomLibs` 的 FormData 构造器（每次调用返回新的类，避免用例间串味）。
 * @returns FormData 构造器
 */
export function createNativeFormData(): FormDataLike {
  /**
   * 原生 FormData 的薄包装：补齐 `form-data` 包的调用面（Buffer 增补 + getHeaders）。
   */
  class CloudflareFormData extends FormData {
    /**
     * 附加字段（Buffer 转 Blob，原生 FormData 只接受 Blob / 字符串）
     * @param name 字段名
     * @param value 字段值
     * @param options 附加选项（filename / contentType）
     */
    override append(name: string, value: unknown, options?: unknown): void {
      const { filename, contentType } = (options ?? {}) as AppendOptions;
      if (isBinary(value)) {
        // `isBinary` 已把值收窄为 ArrayBufferView | ArrayBuffer（运行时判据），
        // 而 lib 类型把 ArrayBufferView 的参数限死在 ArrayBuffer 上（SharedArrayBuffer 排除在外）
        const part = value as BlobPart;
        const blob = new Blob([part], contentType ? { type: contentType } : {});
        super.append(name, blob, filename ?? "blob");
        return;
      }
      super.append(name, typeof value === "string" ? value : String(value));
    }

    /**
     * multipart 请求头（空对象：边界与 Content-Type 交给 fetch 生成）
     * @returns 空请求头
     */
    getHeaders(): Record<string, string> {
      return {};
    }
  }
  return CloudflareFormData;
}
