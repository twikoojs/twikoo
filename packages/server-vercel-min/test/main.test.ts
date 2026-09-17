/**
 * twikoo-vercel-min 测试（T24）：转发壳语义。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import vercelHandler from "../src/index";

describe("twikoo-vercel-min（T24）", () => {
  it("转发壳：default 导出即 twikoo-vercel 的 Serverless Function", () => {
    expect(typeof vercelHandler).toBe("function");
  });

  it("依赖：仅 twikoo-vercel（1.x 形态对齐）", () => {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    expect(Object.keys(pkg.dependencies)).toEqual(["twikoo-vercel"]);
  });
});
