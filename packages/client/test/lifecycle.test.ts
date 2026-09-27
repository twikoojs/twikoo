/** 初始化与销毁竞态回归测试。 */
import { afterEach, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import * as client from "../src/main";
import { getApp } from "../src/render";
import * as utils from "../src/utils";

vi.mock("../src/App.vue", () => ({
  default: { template: '<div class="mounted-client">评论</div>' },
}));

afterEach(() => {
  client.destroy?.();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

/** 可控异步边界，用于重现加载过程中的路由销毁。 */
function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

/** 装配真实挂载点，替换网络访问计数。 */
function setup(): void {
  document.body.innerHTML = '<div id="twikoo"></div>';
  vi.spyOn(utils, "updateVisitorsCount").mockResolvedValue(undefined);
}

it("destroy 同步卸载，重复调用安全，init 返回值仍为 undefined", async () => {
  setup();
  await expect(client.init({ envId: "https://backend.test", lang: "en" })).resolves.toBeUndefined();
  expect(document.querySelector(".mounted-client")).not.toBeNull();
  expect(client.destroy()).toBeUndefined();
  expect(document.querySelector(".mounted-client")).toBeNull();
  expect(getApp()).toBeNull();
  client.destroy();
});

it("语言加载期间销毁后，旧初始化不会重新挂载或计数", async () => {
  setup();
  const language = deferred();
  vi.spyOn(utils, "loadLanguage").mockReturnValueOnce(language.promise);
  const pending = client.init({ envId: "https://backend.test" });
  await flushPromises();
  client.destroy();
  language.resolve();
  await pending;
  expect(getApp()).toBeNull();
  expect(document.querySelector(".mounted-client")).toBeNull();
  expect(utils.updateVisitorsCount).not.toHaveBeenCalled();
});

it("后启动的初始化不被旧异步初始化覆盖", async () => {
  setup();
  const language = deferred();
  vi.spyOn(utils, "loadLanguage")
    .mockReturnValueOnce(language.promise)
    .mockResolvedValue(undefined);
  const old = client.init({ envId: "https://backend.test", path: "/old" });
  await flushPromises();
  await client.init({ envId: "https://backend.test", path: "/new" });
  const current = getApp();
  language.resolve();
  await old;
  expect(getApp()).toBe(current);
  expect(getApp()?.config.globalProperties.$twikoo.path).toBe("/new");
});

it("立即销毁会阻止初始化进入语言加载与渲染", async () => {
  setup();
  const language = vi.spyOn(utils, "loadLanguage");
  const pending = client.init({ envId: "https://backend.test" });
  client.destroy();
  await pending;
  expect(language).not.toHaveBeenCalled();
  expect(getApp()).toBeNull();
});
