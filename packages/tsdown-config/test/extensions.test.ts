import { describe, expect, it } from "vitest";
import { outExtensions } from "../src/index";

/** 构造 outExtensions 上下文（options 仅类型层必需，运行时不使用） */
const ctx = (format: "es" | "cjs", pkgType?: "module" | "commonjs") =>
  ({ format, pkgType }) as Parameters<ReturnType<typeof outExtensions>>[0];

/** 产物扩展名契约：以迁移前 tsup 时代的实际产物命名为基线固化。 */
describe("outExtensions", () => {
  it("module 包 + esm/cjs 双格式：esm 侧 .mjs/.d.ts，cjs 侧 .cjs/.d.cts", () => {
    const ext = outExtensions(["esm", "cjs"]);
    expect(ext(ctx("es", "module"))).toEqual({ js: ".mjs", dts: ".d.ts" });
    expect(ext(ctx("cjs", "module"))).toEqual({ js: ".cjs", dts: ".d.cts" });
  });

  it("commonjs（无 type）包 + 双格式：esm 侧 .mjs/.d.mts，cjs 侧 .js/.d.ts", () => {
    const ext = outExtensions(["esm", "cjs"]);
    expect(ext(ctx("es", "commonjs"))).toEqual({ js: ".mjs", dts: ".d.mts" });
    expect(ext(ctx("es"))).toEqual({ js: ".mjs", dts: ".d.mts" });
    expect(ext(ctx("cjs"))).toEqual({ js: ".js", dts: ".d.ts" });
  });

  it("module 包 + 仅 esm（edgeone-makers 形态）：.js/.d.ts", () => {
    const ext = outExtensions(["esm"]);
    expect(ext(ctx("es", "module"))).toEqual({ js: ".js", dts: ".d.ts" });
  });

  it("commonjs 包 + 仅 cjs（tkserver bin 形态）：.js/.d.ts", () => {
    const ext = outExtensions(["cjs"]);
    expect(ext(ctx("cjs", "commonjs"))).toEqual({ js: ".js", dts: ".d.ts" });
  });
});
