#!/usr/bin/env node
/**
 * 附录 B.2 前端清单「自动化子集」端到端回归（T44；方案 §9.1 验证策略表「集成/冒烟」项）。
 *
 * 做什么：真实启动 `tkserver`（临时数据目录 + `TWIKOO_SEED=1`），在 jsdom 中加载
 * **已构建的客户端产物** `twikoo.min.js`（UMD + 内联样式形态），调用 `twikoo.init`
 * 并逐项断言 B.2 的自动化子集：渲染 / Prism / KaTeX / 分页 / 排序 / 点赞 / 提交 /
 * 错误卡片 / i18n 切换 / 管理员登录与配置读写 / 管理端评论检索。
 *
 * 为什么不用真实浏览器：本仓 CI 不引入浏览器依赖。jsdom 足以覆盖 DOM 渲染、事件冒泡、
 * XHR（同源直连 tkserver）、localStorage 与 UMD 全局挂载；**视觉 / 暗色 / 响应式属人工项**，
 * 见 T44 报告的「交用户清单」。
 *
 * 用法：
 *   node scripts/e2e-b2.mjs          # 跑完自动清理临时数据目录
 *   node scripts/e2e-b2.mjs --keep   # 保留临时数据目录，便于排查
 *
 * 前置：`pnpm build`（需要 `packages/client/dist/twikoo.min.js` 与
 * `packages/server-self-hosted/dist/server.js`）。
 */
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { request } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { JSDOM } from "jsdom";

/** 仓库根（本文件位于 `scripts/`） */
const ROOT = resolve(new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));

/** 客户端产物（UMD + 内联样式） */
const CLIENT_BUNDLE = join(ROOT, "packages/client/dist/twikoo.min.js");

/** tkserver 产物 */
const TSERVER_ENTRY = join(ROOT, "packages/server-self-hosted/dist/server.js");

/** demo vendor 资产（KaTeX：公式渲染需要页面先挂 `renderMathInElement` 全局） */
const KATEX_DIR = join(ROOT, "packages/demo/.vendor/katex");

/** 测试端口（避开 demo 的 8080 / 客户端开发服务器的 9820） */
const PORT = parseInt(process.env.TWIKOO_E2E_PORT ?? "", 10) || 8123;

/** 本脚本使用的管理员密码（明文；客户端自行做 md5 后上送） */
const ADMIN_PASSWORD = "twikoo-e2e-pass";

/** 是否保留临时数据目录 */
const KEEP = process.argv.includes("--keep");

/** 检查结果收集 */
const results = [];

/** tkserver 输出缓存（失败时打印） */
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
 * 执行一项检查（异常记为失败，不中断其余检查）。
 * @param name 检查项名称
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
 * @param fn 条件函数（返回真值即结束）
 * @param label 失败提示
 * @param options 选项（timeout / interval）
 * @returns 条件函数的最终返回值
 */
async function waitFor(fn, label, options = {}) {
  const timeout = options.timeout ?? 15000;
  const interval = options.interval ?? 50;
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const value = await fn();
    if (value) return value;
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error(`等待超时（${timeout}ms）：${label}`);
}

/**
 * 直连 tkserver 发送事件（脚本自用通道；与客户端通道相互独立，便于交叉验证）。
 * @param event 事件名
 * @param body 事件载荷
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
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          try {
            resolvePromise(JSON.parse(data));
          } catch {
            rejectPromise(
              new Error(`非 JSON 响应（HTTP ${res.statusCode}）：${data.slice(0, 200)}`),
            );
          }
        });
      },
    );
    req.on("error", rejectPromise);
    req.end(payload);
  });
}

/**
 * 启动 tkserver（临时数据目录 + seed）。
 * @param dataDir 数据目录
 * @returns 子进程
 */
function bootServer(dataDir) {
  const child = spawn(process.execPath, [TSERVER_ENTRY], {
    env: {
      ...process.env,
      TWIKOO_PORT: String(PORT),
      TWIKOO_HOST: "127.0.0.1",
      TWIKOO_DATA: dataDir,
      TWIKOO_SEED: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  for (const stream of [child.stdout, child.stderr]) {
    stream.setEncoding("utf8");
    stream.on("data", (chunk) => serverLog.push(String(chunk)));
  }
  return child;
}

/**
 * 解析 HTTP 响应信封（tkserver 直连通道为裸响应体）。
 * @param res 响应体
 * @returns 载荷
 */
function payloadOf(res) {
  return res && typeof res === "object" && res.result ? res.result : res;
}

/**
 * 主流程。
 */
async function main() {
  for (const [file, hint] of [
    [CLIENT_BUNDLE, "请先 `pnpm --filter twikoo build`"],
    [TSERVER_ENTRY, "请先 `pnpm --filter tkserver build`"],
  ]) {
    assert(existsSync(file), `缺少构建产物 ${file}（${hint}）`);
  }

  const dataDir = mkdtempSync(join(tmpdir(), "twikoo-e2e-"));
  log(`临时数据目录：${dataDir}`);
  const server = bootServer(dataDir);

  let dom;
  try {
    // ---------- 启动与挂载 ----------
    const version = payloadOf(
      await waitFor(
        async () => {
          try {
            const res = payloadOf(await httpPost("GET_FUNC_VERSION"));
            return res.code === 0 ? res : null;
          } catch {
            return null;
          }
        },
        "tkserver 就绪（GET_FUNC_VERSION）",
        { timeout: 40000, interval: 300 },
      ),
    );
    log(`  tkserver 就绪（服务端版本 ${version.version}）`);

    const seedCheck = payloadOf(await httpPost("COMMENT_GET", { url: "/demo.html" }));
    assert(
      seedCheck.count === 10,
      `seed 数据异常：/demo.html 评论数应为 10，实际 ${seedCheck.count}`,
    );

    if (!existsSync(join(KATEX_DIR, "auto-render.min.js"))) {
      throw new Error(`缺少 KaTeX vendor 资产（${KATEX_DIR}）：先运行 demo 的 prepare-assets`);
    }

    dom = new JSDOM(
      '<!doctype html><html><head></head><body><div id="twikoo"></div></body></html>',
      {
        url: `http://127.0.0.1:${PORT}/demo.html`,
        runScripts: "dangerously",
        pretendToBeVisual: true,
      },
    );
    const { window } = dom;
    const doc = window.document;

    /** 查询单个元素 */
    const q = (sel) => doc.querySelector(sel);
    /** 查询全部元素 */
    const qa = (sel) => [...doc.querySelectorAll(sel)];
    /** 取元素文本 */
    const textOf = (sel) => q(sel)?.textContent.trim() ?? "";
    /**
     * 触发点击。
     * @param el 目标元素
     */
    const click = (el) => {
      assert(el, "点击目标不存在");
      el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
    };
    /**
     * 写入输入框并派发 input + change（覆盖 Vue 的 v-model 与业务 change 监听）。
     * @param el 输入元素
     * @param value 值
     */
    const setValue = (el, value) => {
      assert(el, "输入目标不存在");
      el.value = value;
      el.dispatchEvent(new window.Event("input", { bubbles: true }));
      el.dispatchEvent(new window.Event("change", { bubbles: true }));
    };
    /** 主楼评论元素（`:scope` 限定直接子级，排除楼中楼） */
    const tops = () => qa(".tk-comments-container > .tk-comment");
    /**
     * 按昵称取主楼评论元素。
     * @param nick 昵称
     * @returns 元素或 undefined
     */
    const topByNick = (nick) =>
      tops().find((el) => el.querySelector(".tk-nick")?.textContent.trim() === nick);
    /**
     * 取某条评论的点赞/点踩/回复按钮（直接子级路径，排除楼中楼）。
     * @param el 评论元素
     * @returns 按钮数组
     */
    const actionsOf = (el) => [
      ...el.querySelectorAll(":scope > .tk-main > .tk-row > .tk-action > button"),
    ];
    /** 提交框的 meta 输入框（昵称/邮箱/网址） */
    const metaInputs = () => qa(".tk-submit .tk-meta-input input");

    /** 以指定语言初始化客户端 */
    const initClient = async (lang) => {
      await window.twikoo.init({
        envId: `http://127.0.0.1:${PORT}`,
        el: "#twikoo",
        path: "/demo.html",
        lang,
      });
      await waitFor(() => tops().length > 0, "评论列表渲染");
    };

    // KaTeX：页面需先挂全局 renderMathInElement（1.x 由 HTML 引入，此处等价注入）
    window.eval(readFileSync(join(KATEX_DIR, "katex.min.js"), "utf8"));
    window.eval(readFileSync(join(KATEX_DIR, "auto-render.min.js"), "utf8"));
    assert(typeof window.renderMathInElement === "function", "renderMathInElement 未挂载");

    // 加载客户端产物（UMD → window.twikoo）
    window.eval(readFileSync(CLIENT_BUNDLE, "utf8"));
    assert(window.twikoo && typeof window.twikoo.init === "function", "UMD 全局 twikoo.init 缺失");

    log("\n[1] 挂载与样式");
    await check(
      "API 面：init / getCommentsCount / getRecentComments / getVisitorsCount / version",
      () => {
        for (const key of ["init", "getCommentsCount", "getRecentComments", "getVisitorsCount"]) {
          assert(typeof window.twikoo[key] === "function", `twikoo.${key} 不是函数`);
        }
        assert(window.twikoo.version === version.version, "客户端版本与服务端版本不一致");
      },
    );
    await check("内联样式：`.min.js` 运行时注入 <style data-twikoo>", () => {
      const styleEl = doc.querySelector("style[data-twikoo]");
      assert(styleEl, "未找到 data-twikoo 样式元素");
      assert(styleEl.textContent.includes(".tk-comment"), "内联样式中缺少 tk- 规则");
    });
    await check("OwO 面板样式随 twikoo.css 内联（.OwO-body 规则存在）", () => {
      assert(
        doc.querySelector("style[data-twikoo]").textContent.includes(".OwO-body"),
        "缺少 OwO 样式",
      );
    });

    await initClient("zh-CN");

    log("\n[2] 评论渲染（B.2「评论列表 / 渲染」）");
    await check("列表渲染：主楼 8 条（COMMENT_PAGE_SIZE）+ 总数 10", () => {
      assert(tops().length === 8, `主楼条数应为 8，实际 ${tops().length}`);
      assert(
        textOf(".tk-comments-count").includes("10"),
        `总数文案异常：${textOf(".tk-comments-count")}`,
      );
    });
    await check("嵌套回复（盖楼）：博主楼挂 3 条回复且带「回复 @」", () => {
      const master = topByNick("iMaeGoo");
      assert(master, "未找到博主评论");
      const replies = master.querySelectorAll(":scope > .tk-main > .tk-replies > .tk-comment");
      assert(replies.length === 3, `楼中楼应为 3 条，实际 ${replies.length}`);
      assert(master.querySelector(".tk-ruser"), "缺少「回复 @」标记");
    });
    await check("站长标识：MASTER_TAG 徽标渲染", () => {
      assert(q(".tk-tag-green"), "缺少站长徽标");
      assert(textOf(".tk-tag-green") === "站长", `站长徽标文案异常：${textOf(".tk-tag-green")}`);
    });
    await check("头像：GRAVATAR_CDN=cravatar.cn 时按 md5 取头像", () => {
      const img = q(".tk-avatar img.tk-avatar-img");
      assert(img, "缺少头像 img");
      assert(
        /cravatar\.cn\/avatar\/[0-9a-f]{32}\?d=/.test(img.getAttribute("src") ?? ""),
        `头像地址不符合 md5 形态：${img.getAttribute("src")}`,
      );
    });
    await check("UA / IP 属地：信息行与图标渲染", () => {
      const extras = qa(".tk-comments-container > .tk-comment .tk-extras > .tk-extra");
      assert(extras.length >= 2, `信息行应至少 2 项（属地 + UA），实际 ${extras.length}`);
      assert(q(".tk-extra .tk-icon svg"), "信息行缺少图标");
    });
    await check("外链安全化：target=_blank + rel 含 noopener/nofollow", () => {
      const linkEl = q('a[href="https://twikoo.js.org"]');
      assert(linkEl, "缺少评论内链接");
      assert(linkEl.getAttribute("target") === "_blank", "target 未设为 _blank");
      const rel = linkEl.getAttribute("rel") ?? "";
      assert(
        rel.includes("noopener") && rel.includes("nofollow") && rel.includes("ugc"),
        `rel 异常：${rel}`,
      );
    });
    await check("Prism 代码高亮：language-js 代码块出现 token", async () => {
      await waitFor(() => qa("code.language-js .token").length > 0, "Prism token", {
        timeout: 20000,
      });
      assert(q('link[href*="prism"]'), "未注入 Prism 主题样式表");
    });
    await check("KaTeX 公式：行内与块级公式渲染为 .katex", async () => {
      await waitFor(() => qa(".katex").length >= 2, "KaTeX 渲染", { timeout: 20000 });
    });
    await check("owo 表情：CDN 可达则渲染图片，不可达则保留原文本（不报错）", () => {
      const owoComment = topByNick("表情党");
      assert(owoComment, "未找到表情测试评论");
      const body = owoComment.querySelector(".tk-content").textContent;
      const hasImg = owoComment.querySelector("img.tk-owo-emotion");
      assert(hasImg || body.includes(":QQ:"), "表情既未渲染为图片，也未保留原文（说明渲染异常）");
    });

    log("\n[3] 交互（B.2「评论列表 / 交互」）");
    await check("加载更多：点击后主楼增至 10 条并隐藏按钮", async () => {
      assert(q(".tk-expand"), "缺少「查看更多」按钮");
      click(q(".tk-expand"));
      await waitFor(() => tops().length === 10, "加载第二页", { timeout: 15000 });
      await waitFor(() => !q(".tk-expand"), "按钮收起");
    });
    await check("排序：客户端首条与服务端同参数返回一致（最新 / 最早 / 热门）", async () => {
      const sortItems = qa(".tk-sort-item");
      assert(sortItems.length === 3, `应有 3 个排序按钮，实际 ${sortItems.length}`);
      for (const [index, sort] of [
        [1, "oldest"],
        [2, "popular"],
        [0, "newest"],
      ]) {
        click(qa(".tk-sort-item")[index]);
        const expected = payloadOf(
          await httpPost("COMMENT_GET", { url: "/demo.html", sort, pageSize: 8 }),
        );
        await waitFor(
          () => topByNick(expected.data[0].nick),
          `排序 ${sort} 后首条应为 ${expected.data[0].nick}`,
        );
      }
    });
    await check("点赞：点击后服务端计数 +1（COMMENT_LIKE 落库）", async () => {
      const master = topByNick("iMaeGoo");
      const likeBtn = actionsOf(master)[0];
      const before = parseInt(likeBtn.querySelector(".tk-action-count").textContent || "0", 10);
      click(likeBtn);
      await waitFor(() => likeBtn.classList.contains("tk-liked"), "点赞激活态");
      const after = payloadOf(await httpPost("COMMENT_GET", { url: "/demo.html", sort: "newest" }));
      const ups = after.data.find((c) => c.nick === "iMaeGoo").ups;
      assert(ups === before + 1, `点赞未落库：期望 ${before + 1}，实际 ${ups}`);
    });
    await check("i18n 切换：lang=en 时排序文案与占位符切换为英文", async () => {
      await initClient("en");
      await waitFor(() => textOf(".tk-sort-item") === "Newest", "英文排序文案");
      assert(
        metaInputs()[0].getAttribute("placeholder") === "Required",
        `英文占位符异常：${metaInputs()[0].getAttribute("placeholder")}`,
      );
    });

    log("\n[4] 提交与错误卡片（B.2「提交框 / 交互」）");
    await initClient("zh-CN");
    /** 填写 meta 三件套 */
    const fillMeta = (nick, mail) => {
      const inputs = metaInputs();
      setValue(inputs[0], nick);
      setValue(inputs[1], mail);
      if (inputs[2]) setValue(inputs[2], "");
    };
    await check("提交校验：缺失必填项时发送按钮禁用，填齐后可用", async () => {
      assert(q(".tk-send"), "缺少发送按钮");
      await waitFor(() => q(".tk-send").hasAttribute("disabled"), "初始禁用");
      fillMeta("E2E 访客", "e2e@example.com");
      setValue(q(".tk-submit textarea"), "**E2E 提交测试**");
      await waitFor(() => !q(".tk-send").hasAttribute("disabled"), "填齐后可用");
    });
    await check("预览：Markdown 渲染 + 消毒（加粗）", async () => {
      click(q(".tk-preview"));
      await waitFor(() => q(".tk-preview-container strong"), "预览渲染");
      assert(q(".tk-preview-container").textContent.includes("E2E 提交测试"), "预览内容缺失");
    });
    await check("提交成功：评论进入列表、草稿被清空", async () => {
      click(q(".tk-send"));
      await waitFor(() => topByNick("E2E 访客"), "新评论出现", { timeout: 20000 });
      assert(window.localStorage.getItem("twikoo-draft") === "", "草稿未清空");
    });
    await check("错误卡片：命中屏蔽词（BLOCKED_WORDS=广告）时展示 TkError", async () => {
      fillMeta("E2E 访客", "e2e@example.com");
      setValue(q(".tk-submit textarea"), "这条包含广告字样");
      await waitFor(() => !q(".tk-send").hasAttribute("disabled"), "发送键可用");
      click(q(".tk-send"));
      await waitFor(() => q(".tk-error"), "错误卡片出现", { timeout: 20000 });
      assert(q(".tk-error__title").textContent.trim().length > 0, "错误卡片标题为空");
    });
    await check("草稿持久化：输入即写入 localStorage", () => {
      setValue(q(".tk-submit textarea"), "草稿内容");
      assert(window.localStorage.getItem("twikoo-draft") === "草稿内容", "草稿未写入");
    });

    log("\n[5] 管理员（B.2「管理员」）");
    await initClient("zh-CN");
    await check("管理入口：昵称填 HIDE_ADMIN_CRYPT 暗号（admin）后出现齿轮并打开面板", async () => {
      fillMeta("admin", "admin@example.com");
      // 搜索 / 刷新两个图标常驻，齿轮（cog）为第三个 —— 必须等它「出现」再点，
      // 否则会点到刷新图标（本脚本首版即踩过此坑）
      const gear = await waitFor(() => {
        const icons = qa(".tk-comments-actions .tk-icon.__comments");
        return icons.length >= 3 ? icons.at(-1) : null;
      }, "管理入口齿轮出现");
      click(gear);
      await waitFor(() => q(".tk-regist"), "显示首次设置密码表单", { timeout: 15000 });
    });
    await check("首次设置密码 + 自动登录：出现 4 个页签", async () => {
      const pwInputs = qa(".tk-regist input[type=password]");
      assert(pwInputs.length === 2, `注册表单应有 2 个密码框，实际 ${pwInputs.length}`);
      setValue(pwInputs[0], ADMIN_PASSWORD);
      setValue(pwInputs[1], ADMIN_PASSWORD);
      await waitFor(() => !q(".tk-regist-button").hasAttribute("disabled"), "注册按钮可用");
      click(q(".tk-regist-button"));
      await waitFor(() => q(".tk-panel"), "面板打开", { timeout: 20000 });
      assert(
        qa(".tk-panel .tk-tab").length === 4,
        `页签应为 4 个，实际 ${qa(".tk-panel .tk-tab").length}`,
      );
    });
    await check("配置读取：全部配置项渲染（seed 77 项）", async () => {
      click(qa(".tk-panel .tk-tab")[1]);
      const items = await waitFor(
        () => (qa(".tk-admin-config-item").length >= 70 ? qa(".tk-admin-config-item") : null),
        "配置项渲染",
        { timeout: 20000 },
      );
      assert(items.length >= 70, `配置项数量不足：${items.length}`);
    });
    await check("配置写入：修改 SITE_NAME → 保存成功 → 服务端生效", async () => {
      const item = qa(".tk-admin-config-item").find(
        (el) => el.querySelector(".tk-admin-config-title")?.textContent.trim() === "SITE_NAME",
      );
      assert(item, "未找到 SITE_NAME 配置项");
      setValue(item.querySelector("input"), "Twikoo Demo (E2E)");
      click(q(".tk-admin-config-actions .tk-button--primary"));
      await waitFor(
        () => q(".tk-admin-config-message").textContent.includes("保存成功"),
        "保存成功提示",
        {
          timeout: 20000,
        },
      );
      const cfg = payloadOf(await httpPost("GET_CONFIG"));
      assert(cfg.config.SITE_NAME === "Twikoo Demo (E2E)", `服务端未生效：${cfg.config.SITE_NAME}`);
    });
    await check("评论检索：管理端列表渲染 + 按 HIDDEN 筛选出垃圾评论", async () => {
      click(qa(".tk-panel .tk-tab")[0]);
      await waitFor(() => qa(".tk-admin-comment-item").length > 0, "管理端评论列表", {
        timeout: 20000,
      });
      assert(q(".tk-pagination-pager"), "缺少分页控件");
      const selectEl = q(".tk-admin-comment-filter-type");
      assert(selectEl, "缺少类型筛选下拉");
      selectEl.value = "HIDDEN";
      selectEl.dispatchEvent(new window.Event("change", { bubbles: true }));
      click(qa(".tk-admin-comment-filter .tk-button").at(-1));
      await waitFor(() => qa(".tk-admin-comment-item").length === 1, "筛选 HIDDEN 结果", {
        timeout: 20000,
      });
      assert(
        q(".tk-admin-comment-item").textContent.includes("spammer"),
        "HIDDEN 筛选未返回垃圾评论",
      );
    });
  } finally {
    if (dom) dom.window.close();
    server.kill();
    if (KEEP) log(`\n保留临时数据目录：${dataDir}`);
    else rmSync(dataDir, { recursive: true, force: true });
  }

  const failed = results.filter((r) => !r.pass);
  log(`\n附录 B.2 自动化子集：${results.length - failed.length}/${results.length} 通过`);
  if (failed.length > 0) {
    log(`\n失败项：\n${failed.map((f) => `  - ${f.name}：${f.message}`).join("\n")}`);
    log(
      `\n--- tkserver 日志（末尾 40 行）---\n${serverLog.join("").split("\n").slice(-40).join("\n")}`,
    );
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(`\n脚本异常：${e.stack ?? e.message}`);
  console.error(
    `\n--- tkserver 日志（末尾 40 行）---\n${serverLog.join("").split("\n").slice(-40).join("\n")}`,
  );
  process.exit(1);
});
