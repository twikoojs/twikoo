#!/usr/bin/env node
/**
 * 「CDN 直引客户端：4 个产物分别验证」+「自托管 tkserver：启动 + 全功能 + shutdown」
 * 的本地自动化核对（特别项 ④）。
 *
 * 做法：真启 `tkserver`（临时数据目录 + seed），对 **4 个客户端产物**各建一个独立 jsdom，
 * 加载产物 → 调 `twikoo.init` → 断言评论区渲染成功；并按产物形态断言样式内联策略
 * （`.min.js` 内联 `<style data-twikoo>`、`.nocss.js` 不内联且依赖同目录 `twikoo.css`）。
 * 最后向 tkserver 发 SIGTERM，断言进程退出且端口释放（self-hosted 的 shutdown 语义）。
 *
 * 用法：`node scripts/check-cdn-products.mjs`（`pnpm check:products`）
 * 前置：`pnpm build`。
 */
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { request } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { JSDOM } from "jsdom";

/** 仓库根 */
const ROOT = resolve(new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));

/** 客户端产物目录 */
const DIST = join(ROOT, "packages/client/dist");

/** tkserver 产物 */
const TSERVER_ENTRY = join(ROOT, "packages/server-self-hosted/dist/server.js");

/** 测试端口（与 e2e-b2 分开，可并行） */
const PORT = parseInt(process.env.TWIKOO_PRODUCTS_PORT ?? "", 10) || 8124;

/** 四产物期望形态（`inlineCss` 与 `bundledSdk` 为断言项） */
const PRODUCTS = [
  { file: "twikoo.min.js", inlineCss: true, bundledSdk: false },
  { file: "twikoo.all.min.js", inlineCss: true, bundledSdk: true },
  { file: "twikoo.nocss.js", inlineCss: false, bundledSdk: true },
  { file: "twikoo.all.nocss.js", inlineCss: false, bundledSdk: true },
];

/** 结果收集 */
const results = [];

/** tkserver 输出缓存 */
const serverLog = [];

/**
 * 打印一行。
 * @param message 内容
 */
function log(message) {
  console.log(message);
}

/**
 * 断言。
 * @param condition 条件
 * @param message 失败信息
 */
function assert(condition, message) {
  if (!condition) throw new Error(message);
}

/**
 * 执行一项检查。
 * @param name 检查项
 * @param fn 检查体
 */
async function check(name, fn) {
  try {
    await fn();
    results.push({ name, pass: true });
    log(`  \u2713 ${name}`);
  } catch (e) {
    results.push({ name, pass: false, message: e.message });
    log(`  \u2717 ${name}\n      ${e.message}`);
  }
}

/**
 * 轮询等待条件成立。
 * @param fn 条件函数
 * @param label 失败提示
 * @param options 选项
 * @returns 条件返回值
 */
async function waitFor(fn, label, options = {}) {
  const timeout = options.timeout ?? 15000;
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const value = await fn();
    if (value) return value;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`等待超时（${timeout}ms）：${label}`);
}

/**
 * 直连 tkserver 发送事件。
 * @param event 事件名
 * @param body 载荷
 * @returns 响应体
 */
function httpPost(event, body = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const payload = JSON.stringify({ event, ...body });
    const req = request(
      {
        host: "127.0.0.1",
        port: PORT,
        path: "/",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => {
          data += c;
        });
        res.on("end", () => {
          try {
            resolvePromise(JSON.parse(data));
          } catch {
            rejectPromise(new Error(`非 JSON 响应（HTTP ${res.statusCode}）`));
          }
        });
      },
    );
    req.on("error", rejectPromise);
    req.end(payload);
  });
}

/**
 * 探测端口是否仍可连接。
 * @returns 可连接返回 true
 */
function portAlive() {
  return new Promise((resolvePromise) => {
    const req = request({ host: "127.0.0.1", port: PORT, path: "/", method: "POST" }, () => {
      resolvePromise(true);
    });
    req.on("error", () => resolvePromise(false));
    req.end(JSON.stringify({ event: "GET_FUNC_VERSION" }));
  });
}

/**
 * 在独立 jsdom 中加载并初始化某个产物。
 * @param file 产物文件名
 * @returns 断言所需的观测结果
 */
async function loadProduct(file) {
  const code = readFileSync(join(DIST, file), "utf8");
  const dom = new JSDOM(
    '<!doctype html><html><head></head><body><div id="twikoo"></div></body></html>',
    {
      url: `http://127.0.0.1:${PORT}/demo.html`,
      runScripts: "dangerously",
      pretendToBeVisual: true,
    },
  );
  const { window } = dom;
  window.eval(code);
  await window.twikoo.init({
    envId: `http://127.0.0.1:${PORT}`,
    el: "#twikoo",
    path: "/demo.html",
    lang: "zh-CN",
  });
  await waitFor(
    () => window.document.querySelectorAll(".tk-comment").length > 0,
    `${file} 评论区渲染`,
    { timeout: 20000 },
  );
  const styleEl = window.document.querySelector("style[data-twikoo]");
  const result = {
    version: window.twikoo.version,
    commentCount: window.document.querySelectorAll(".tk-comment").length,
    inlinedCss: Boolean(styleEl),
    inlinedCssHasRules: Boolean(styleEl && styleEl.textContent.includes(".tk-comment")),
    sdkHits: (code.match(/cloudbase/gi) ?? []).length,
    size: statSync(join(DIST, file)).size,
  };
  window.close();
  return result;
}

/**
 * 主流程。
 */
async function main() {
  assert(existsSync(TSERVER_ENTRY), `缺少 ${TSERVER_ENTRY}（先 pnpm build）`);
  for (const { file } of PRODUCTS) {
    assert(existsSync(join(DIST, file)), `缺少产物 ${file}（先 pnpm --filter twikoo build）`);
  }
  assert(existsSync(join(DIST, "twikoo.css")), "缺少 twikoo.css（.nocss 产物必须与之一同使用）");

  /**
   * 语言分片守卫：
   * ① 7 个非内置语言必须各自产出 `dist/locales/<lang>.js`（按需加载）；
   * ② 内置语言 `zh-CN` / `en` 不应有分片（它们应内联在主产物里）；
   * ③ 分片语言的文案**不得**出现在主产物中——防止有人把 7 个分片重新静态 import
   *    （那会让主产物体积回涨约 120KB）。
   */
  const LAZY_LOCALES = ["zh-HK", "zh-TW", "uz-UZ", "ja-JP", "ko-KR", "vi-VN", "id-ID"];
  for (const lang of LAZY_LOCALES) {
    assert(
      existsSync(join(DIST, "locales", `${lang}.js`)),
      `缺少语言分片 dist/locales/${lang}.js（非内置语言必须按需加载）`,
    );
  }
  for (const lang of ["zh-CN", "en"]) {
    assert(
      !existsSync(join(DIST, "locales", `${lang}.js`)),
      `内置语言 ${lang} 不应产出分片（应内联进主产物）`,
    );
  }
  {
    const readLocale = (lang) =>
      JSON.parse(
        readFileSync(join(ROOT, "packages/client/src/i18n/locales", `${lang}.json`), "utf8"),
      );
    const ja = readLocale("ja-JP");
    const zh = readLocale("zh-CN");
    const en = readLocale("en");
    /** 取一个「日文与中/英均不同」的值作为探针（自动选取，不硬编码） */
    const probe = Object.entries(ja).find(
      ([key, value]) => value && value !== zh[key] && value !== en[key],
    )?.[1];
    assert(probe !== undefined, "无法从 ja-JP 词表取到与中/英不同的探针文案");
    for (const { file } of PRODUCTS) {
      assert(
        !readFileSync(join(DIST, file), "utf8").includes(probe),
        `${file} 内联了语言分片文案（非内置语言必须按需加载，勿静态 import 回 i18n/index.ts）`,
      );
    }
  }

  const dataDir = mkdtempSync(join(tmpdir(), "twikoo-products-"));
  const server = spawn(process.execPath, [TSERVER_ENTRY], {
    env: {
      ...process.env,
      TWIKOO_PORT: String(PORT),
      TWIKOO_HOST: "127.0.0.1",
      TWIKOO_DATA: dataDir,
      TWIKOO_SEED: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  for (const stream of [server.stdout, server.stderr]) {
    stream.setEncoding("utf8");
    stream.on("data", (chunk) => serverLog.push(String(chunk)));
  }

  try {
    await waitFor(
      async () => {
        try {
          const res = await httpPost("GET_FUNC_VERSION");
          return res.code === 0 ? res : null;
        } catch {
          return null;
        }
      },
      "tkserver 就绪",
      { timeout: 40000 },
    );
    log(`tkserver 就绪（端口 ${PORT}，Loki + seed）`);

    log("\n[B.3-11] CDN 直引客户端：4 产物分别验证");
    for (const { file, inlineCss, bundledSdk } of PRODUCTS) {
      await check(`${file}：init 成功 + 评论渲染 + 形态断言`, async () => {
        const info = await loadProduct(file);
        assert(info.commentCount > 0, `${file} 未渲染出评论`);
        assert(info.version === (await httpPost("GET_FUNC_VERSION")).version, "版本号与后端不一致");
        assert(
          info.inlinedCss === inlineCss,
          `${file} 样式内联形态不符：期望 inlineCss=${inlineCss}，实际 ${info.inlinedCss}`,
        );
        if (inlineCss) {
          assert(info.inlinedCssHasRules, `${file} 内联样式缺少 tk- 规则`);
        }
        const sdkOk = bundledSdk ? info.sdkHits > 50 : info.sdkHits < 10;
        assert(sdkOk, `${file} 云开发 SDK 形态不符（cloudbase 命中 ${info.sdkHits}）`);
        log(
          `      ${file}: ${(info.size / 1024).toFixed(0)} KB · 评论 ${info.commentCount} 条 · ` +
            `内联样式 ${info.inlinedCss} · cloudbase 命中 ${info.sdkHits}`,
        );
      });
    }

    log("\n[B.3-7] 自托管 tkserver：启动 + 全功能 + shutdown");
    await check("全功能：种子数据 + 计数 + 评论读写可用", async () => {
      const got = await httpPost("COMMENT_GET", { url: "/demo.html" });
      assert(
        got.code === 0 && got.count === 10,
        `COMMENT_GET 异常：${JSON.stringify(got).slice(0, 120)}`,
      );
      // COUNTER_GET 与 GET_RECENT_COMMENTS 同属「1.x 成功不带 code」的事件：只判 time
      const counter = await httpPost("COUNTER_GET", { url: "/demo.html" });
      assert(
        typeof counter.time === "number" && counter.time >= 42,
        `COUNTER_GET 异常：${JSON.stringify(counter).slice(0, 120)}`,
      );
      const config = await httpPost("GET_CONFIG");
      assert(config.code === 0 && config.config.SITE_NAME, "GET_CONFIG 异常");
    });
    await check("shutdown：SIGTERM 后进程退出且端口释放", async () => {
      assert(await portAlive(), "shutdown 前端口应可连接");
      const exited = new Promise((resolvePromise) =>
        server.once("exit", () => resolvePromise(true)),
      );
      server.kill("SIGTERM");
      await Promise.race([
        exited,
        new Promise((_, rejectPromise) =>
          setTimeout(() => rejectPromise(new Error("SIGTERM 后 10s 内未退出")), 10000),
        ),
      ]);
      await waitFor(async () => !(await portAlive()), "端口释放", { timeout: 5000 });
    });
  } finally {
    if (server.exitCode === null && !server.killed) server.kill("SIGKILL");
    rmSync(dataDir, { recursive: true, force: true });
  }

  const failed = results.filter((r) => !r.pass);
  log(`\nCDN 产物 + 自托管核对：${results.length - failed.length}/${results.length} 通过`);
  if (failed.length > 0) {
    log(`\n失败项：\n${failed.map((f) => `  - ${f.name}：${f.message}`).join("\n")}`);
    log(
      `\n--- tkserver 日志（末尾 20 行）---\n${serverLog.join("").split("\n").slice(-20).join("\n")}`,
    );
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(`\n脚本异常：${e.stack ?? e.message}`);
  console.error(
    `\n--- tkserver 日志（末尾 20 行）---\n${serverLog.join("").split("\n").slice(-20).join("\n")}`,
  );
  process.exit(1);
});
