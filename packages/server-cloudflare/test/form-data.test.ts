/**
 * 原生 FormData 垫片测试。
 *
 * 关键断言是「Buffer 被转成 Blob 且保住了文件名/类型」与「`http.ts` 对原生 FormData
 * 直通」——`@twikoojs/common` 的图片上传与验证码链路全靠这两点才能发出 multipart 请求。
 */
import { describe, expect, it } from "vitest";
import { httpPost } from "@twikoojs/common";
import { createNativeFormData } from "../src/form-data";
import { fetchCalls, useFakeFetch } from "./utils/fake-fetch";

/** 用垫片建一个 FormData 实例（对外形态按 `form-data` 包的调用面走） */
function makeForm(): FormData {
  const FormDataClass = createNativeFormData();
  return new FormDataClass() as unknown as FormData;
}

describe("原生 FormData 垫片", () => {
  it("字符串字段直接附加", () => {
    const form = makeForm();
    form.append("token", "abc");
    expect(form.get("token")).toBe("abc");
  });

  it("Buffer 字段转 Blob 并保留文件名与 MIME（上传链路传的是图片字节）", () => {
    const form = makeForm();
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0x00]);
    (
      form as unknown as { append(name: string, value: unknown, options?: unknown): void }
    ).append("file", bytes, { filename: "a.jpg", contentType: "image/jpeg" });
    const file = form.get("file") as File;
    expect(file).toBeInstanceOf(Blob);
    expect(file.name).toBe("a.jpg");
    expect(file.type).toBe("image/jpeg");
    expect(file.size).toBe(4);
  });

  it("getHeaders() 返回空对象（multipart 边界交给 fetch 生成）", () => {
    const FormDataClass = createNativeFormData();
    const form = new FormDataClass() as unknown as { getHeaders(): Record<string, string> };
    expect(form.getHeaders()).toEqual({});
  });

  it("经 common 的 httpPost 发出时保持原生 FormData 形态（未被 JSON 序列化）", async () => {
    useFakeFetch(() => ({ status: 200, json: { ok: true } }));
    const FormDataClass = createNativeFormData();
    const form = new FormDataClass() as unknown as {
      append(name: string, value: unknown, options?: unknown): void;
      getHeaders(): Record<string, string>;
    };
    form.append("smfile", new Uint8Array([1, 2, 3]), {
      filename: "a.png",
      contentType: "image/png",
    });
    await httpPost("https://example.com/upload", form, { headers: form.getHeaders() });
    const call = fetchCalls()[0];
    expect(call.url).toBe("https://example.com/upload");
    // 空 body 记录 = 载荷不是 JSON 字符串（原生 FormData 由 fetch 自行编码）
    expect(call.body).toEqual({});
  });
});
