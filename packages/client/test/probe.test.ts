import { describe, expect, it, vi } from "vitest";

describe("confirm 探针", () => {
  it("stubGlobal 后是否可调用", () => {
    console.log("typeof confirm:", typeof confirm);
    vi.stubGlobal("confirm", () => false);
    console.log("stub 后 typeof confirm:", typeof confirm, "globalThis.confirm:", typeof globalThis.confirm);
    console.log("调用结果:", confirm("x"));
    expect(typeof confirm).toBe("function");
    vi.unstubAllGlobals();
  });
});
