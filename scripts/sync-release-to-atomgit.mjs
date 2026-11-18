#!/usr/bin/env node
/**
 * 把 GitHub Release 同步到 AtomGit（只同步标题与描述，不同步附件）。
 *
 * 用法：
 *   node scripts/sync-release-to-atomgit.mjs              # 只报告差异，不写入
 *   node scripts/sync-release-to-atomgit.mjs --apply      # 实际补建缺失的 Release
 *   node scripts/sync-release-to-atomgit.mjs --apply --limit 5   # 最多补 5 条
 *
 * 工作方式（可重复调用，幂等）：
 *   1. 拉取 GitHub 全部非草稿 Release 与 AtomGit 全部 Release；
 *   2. 求出「GitHub 有、AtomGit 没有」的差异集，按发布时间**升序**逐条创建
 *      （AtomGit 页面按创建时间倒序展示，由旧到新创建可让新版落在第一页最前）；
 *   3. 若某 tag 尚未随镜像同步到 AtomGit，打 warn 并跳过，不中断整体流程；
 *   4. 全部补齐后，把最新正式版标记为仓库「最新版本」。
 *
 * 环境变量：
 *   ATOMGIT_TOKEN     必填，AtomGit 个人访问令牌（创建 Release 不允许匿名访问）
 *   GITHUB_TOKEN      可选，读 GitHub API 用；不设则走匿名（60 次/小时，易限流）
 *   ATOMGIT_OWNER     可选，默认 twikoojs-org
 *   ATOMGIT_REPO      可选，默认 twikoo
 *   GITHUB_REPO       可选，默认 twikoojs/twikoo
 *
 * 前置条件：发行前需先在 AtomGit 网页点一次「同步镜像」，让 tag 先过去。
 *   本脚本不会主动触发镜像同步 —— AtomGit 未开放该 API（详见 AGENTS.md）。
 *
 * 退出码：0 = 无差异或全部成功；1 = 有失败（含 tag 未同步被跳过）。
 *
 * 设计要点（均为 AtomGit 接口实测/文档确认的行为，与 GitHub 不同，勿顺手「优化」）：
 * - 创建接口**不允许匿名访问**，必须带 AtomGit 用户访问令牌；
 * - `name` 与 `body` **都不可为空**，否则返回 400 PARAMETER_ERROR；
 * - 预发布**只能**用 `release_status: "pre"` 表达；请求体里的 `prerelease: true`
 *   会被静默忽略（落库为 false），因此必须显式设置并回读校验；
 * - `release_status: "latest"` 是**全局唯一**标记，设置一条会顶掉上一条，
 *   因此只在最后对最新的那条正式版设置一次；
 * - PATCH 不支持部分更新，`name` / `body` 必须一并传入，否则同样 PARAMETER_ERROR；
 * - AtomGit 没有 `GET /tags/{tag}` 单查询接口（该路径返回 405），
 *   只能翻页遍历 `GET /tags` 列表按 name 匹配；
 * - Release 依附于 Tag，且镜像仓**禁止通过 API 建 tag**
 *   （`POST /tags` 返回 "repository is an image repository"），
 *   所以 tag 没同步过来就只能跳过。
 */

/** AtomGit API 基础地址（/api/v5 为 Release 分组前缀） */
const ATOMGIT_API = "https://api.atomgit.com/api/v5";

/** GitHub API 基础地址 */
const GITHUB_API = "https://api.github.com";

/** GitHub 上无发布说明时写入的占位文案（AtomGit 要求 body 非空） */
const EMPTY_BODY_PLACEHOLDER = "（GitHub 上此版本无发布说明）";

/** 网络抖动与限流的最多重试次数 */
const MAX_ATTEMPTS = 4;

/** 分页抓取时每页条数（两边的上限都是 100） */
const PER_PAGE = 100;

/** 分页抓取的页数上限，防止异常响应导致死循环 */
const MAX_PAGES = 20;

/** 命令行参数 */
const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const limitIdx = argv.indexOf("--limit");
const LIMIT = limitIdx >= 0 ? Number(argv[limitIdx + 1]) : 0;

/**
 * 读取环境变量，按需回退默认值。
 * @param name 变量名
 * @param fallback 缺省值（不传表示必填）
 * @returns 去除首尾空白后的值
 */
function readEnv(name, fallback) {
  const raw = process.env[name];
  const value = raw === undefined ? undefined : raw.trim();
  if (value) return value;
  if (fallback !== undefined) return fallback;
  throw new Error(`缺少必需的环境变量 ${name}`);
}

/**
 * 休眠指定毫秒，用于重试退避。
 * @param ms 毫秒数
 * @returns 等待完成的 Promise
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 发起一次 JSON 请求，带限流与 5xx 的指数退避重试。
 * @param url 完整 URL
 * @param options fetch 选项（headers / method / body）
 * @param label 出错时用于定位的标签
 * @returns 解析后的响应体；HTTP 404 时返回 null
 */
async function requestJson(url, options = {}, label = "") {
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, options);
      const text = await res.text();

      // 404 用于探测「不存在」，不是错误
      if (res.status === 404) return null;

      // 限流与服务端错误可重试
      if (res.status === 429 || res.status >= 500) {
        lastError = new Error(`HTTP ${res.status} ${label} ${text.slice(0, 200)}`);
        await sleep(1000 * attempt * 2);
        continue;
      }

      if (!res.ok) {
        const err = new Error(`HTTP ${res.status} ${label} ${text.slice(0, 500)}`);
        err.status = res.status;
        err.body = text;
        throw err;
      }

      return text ? JSON.parse(text) : null;
    } catch (e) {
      // 4xx（除限流）属于参数/权限问题，重试无意义
      if (e.status && e.status >= 400 && e.status < 500 && e.status !== 429) throw e;
      lastError = e;
      await sleep(1000 * attempt * 2);
    }
  }
  throw lastError;
}

/**
 * 带鉴权地调用 AtomGit API。
 * @param token AtomGit 访问令牌
 * @param path 以 / 开头的 API 路径
 * @param options fetch 选项
 * @returns 解析后的响应体；404 时为 null
 */
function atomgit(token, path, options = {}) {
  return requestJson(
    `${ATOMGIT_API}${path}`,
    {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    },
    path,
  );
}

/**
 * 分页抓取 GitHub 全部非草稿 Release。
 * @param repo GitHub 仓库（owner/name）
 * @param token GitHub token（可空，空则匿名）
 * @returns Release 数组（GitHub 默认按 published_at 倒序）
 */
async function fetchGithubReleases(repo, token) {
  const all = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const chunk = await requestJson(
      `${GITHUB_API}/repos/${repo}/releases?per_page=${PER_PAGE}&page=${page}`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "twikoo-release-sync",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
      `github releases page ${page}`,
    );
    if (!Array.isArray(chunk) || chunk.length === 0) break;
    all.push(...chunk);
    if (chunk.length < PER_PAGE) break;
  }
  return all.filter((r) => !r.draft);
}

/**
 * 分页抓取 AtomGit 全部 Release，建立 tag → Release 的映射。
 * @param token AtomGit 访问令牌
 * @param owner 仓库所属空间
 * @param repo 仓库路径
 * @returns Map<tag, Release>
 */
async function fetchAtomgitReleases(token, owner, repo) {
  const map = new Map();
  for (let page = 1; page <= MAX_PAGES; page++) {
    const chunk = await atomgit(
      token,
      `/repos/${owner}/${repo}/releases?per_page=${PER_PAGE}&direction=desc&page=${page}`,
    );
    if (!Array.isArray(chunk) || chunk.length === 0) break;
    for (const r of chunk) map.set(r.tag_name, r);
    if (chunk.length < PER_PAGE) break;
  }
  return map;
}

/**
 * 翻页抓取 AtomGit 全部 tag 名，建立集合。
 *
 * 注意：AtomGit 没有 `GET /tags/{tag}` 单查询接口（该路径返回 405），
 * 只能遍历列表按 name 匹配。
 * @param token AtomGit 访问令牌
 * @param owner 仓库所属空间
 * @param repo 仓库路径
 * @returns Set<tag 名>
 */
async function fetchAtomgitTags(token, owner, repo) {
  const names = new Set();
  for (let page = 1; page <= MAX_PAGES; page++) {
    const chunk = await atomgit(
      token,
      `/repos/${owner}/${repo}/tags?per_page=${PER_PAGE}&page=${page}`,
    );
    if (!Array.isArray(chunk) || chunk.length === 0) break;
    for (const t of chunk) names.add(t.name);
    if (chunk.length < PER_PAGE) break;
  }
  return names;
}

/**
 * 组装 AtomGit Release 请求体。
 *
 * 说明：`tag_name` 只在创建时传入（创建接口必填）；标记 latest 走 PATCH 时
 * tag 已在 URL 路径里，body 里不需要也不应重复携带 tag_name。
 * @param gh GitHub Release
 * @param releaseStatus 要设置的 release_status（"pre" / "latest" / undefined）
 * @param includeTag 是否在 body 中携带 tag_name（仅创建时为 true）
 * @returns 可直接用于 POST / PATCH 的请求体
 */
function buildPayload(gh, releaseStatus, includeTag = false) {
  const name = (gh.name ?? "").trim() || gh.tag_name;
  const body = (gh.body ?? "").trim() || EMPTY_BODY_PLACEHOLDER;
  const payload = includeTag ? { tag_name: gh.tag_name, name, body } : { name, body };
  if (releaseStatus) payload.release_status = releaseStatus;
  return payload;
}

/**
 * 主流程：比对差异 → 按发布时间升序逐条补齐 → 标记最新版本。
 * @returns 退出码（0 全部成功，1 有失败）
 */
async function main() {
  const token = readEnv("ATOMGIT_TOKEN");
  const githubToken = readEnv("GITHUB_TOKEN", "");
  const owner = readEnv("ATOMGIT_OWNER", "twikoojs-org");
  const repo = readEnv("ATOMGIT_REPO", "twikoo");
  const githubRepo = readEnv("GITHUB_REPO", "twikoojs/twikoo");

  console.log(`模式：${APPLY ? "APPLY（写入）" : "DRY-RUN（只报告）"}`);

  // 1. 两边全量拉取
  const ghAll = await fetchGithubReleases(githubRepo, githubToken);
  const agReleases = await fetchAtomgitReleases(token, owner, repo);
  console.log(`GitHub 非草稿 Release：${ghAll.length}；AtomGit 已有 Release：${agReleases.size}`);

  // 2. 求差异：GitHub 有、AtomGit 没有的
  const missing = ghAll
    .filter((r) => !agReleases.has(r.tag_name))
    // 按发布时间升序：由旧到新创建，AtomGit 页面上新版才会落在最前
    .sort((a, b) => new Date(a.published_at) - new Date(b.published_at));

  if (missing.length === 0) {
    console.log("✓ 两边已一致，无需同步");
    return 0;
  }
  console.log(`发现 ${missing.length} 条差异：${missing.map((r) => r.tag_name).join(", ")}`);

  if (!APPLY) {
    console.log("（DRY-RUN 不写入；加 --apply 实际执行）");
    return 0;
  }

  // 3. 预先取 AtomGit 现有 tag，用于判断 tag 是否已随镜像同步过来
  const agTags = await fetchAtomgitTags(token, owner, repo);

  const queue = LIMIT > 0 ? missing.slice(0, LIMIT) : missing;
  console.log(`本次处理 ${queue.length} 条`);

  let created = 0;
  let skippedNoTag = 0;
  let failed = 0;

  for (const [i, gh] of queue.entries()) {
    const tag = gh.tag_name;
    const prefix = `[${i + 1}/${queue.length}] ${tag}`;

    // tag 未同步到 AtomGit 时无法建 Release（镜像仓禁止 API 建 tag），跳过而非失败中断
    if (!agTags.has(tag)) {
      console.warn(`WARN ${prefix} tag 尚未同步到 AtomGit，跳过（请先在 AtomGit 网页点「同步镜像」）`);
      skippedNoTag += 1;
      continue;
    }

    // 预发布用 "pre"；正式版暂不设 latest，等全部建完再统一标记最新
    const payload = buildPayload(gh, gh.prerelease ? "pre" : undefined, true);
    try {
      const created_ = await atomgit(token, `/repos/${owner}/${repo}/releases`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!created_ || created_.tag_name !== tag) {
        throw new Error(`响应异常：期望 tag ${tag}，实际 ${JSON.stringify(created_?.tag_name)}`);
      }
      // 预发布标记曾被静默忽略过，必须回读确认
      if (created_.prerelease !== Boolean(gh.prerelease)) {
        throw new Error(
          `预发布标记未生效：期望 ${Boolean(gh.prerelease)}，实际 ${JSON.stringify(created_.prerelease)}`,
        );
      }

      created += 1;
      console.log(
        `OK   ${prefix} prerelease=${created_.prerelease} bodyLen=${(created_.body ?? "").length}`,
      );
    } catch (e) {
      failed += 1;
      console.error(`FAIL ${prefix} :: ${e.message}`);
      // 鉴权问题后续必然全失败，直接中止
      if (e.status === 401 || e.status === 403) {
        console.error("中止：鉴权失败，请检查 ATOMGIT_TOKEN 是否有效、是否具备仓库写权限");
        break;
      }
    }

    // 温和限速，避免触发服务端频控
    await sleep(600);
  }

  // 4. 全部补齐后，把最新正式版标记为「最新版本」（该标记全局唯一，必须最后设置）
  if (failed === 0 && skippedNoTag === 0) {
    const newestStable = [...ghAll]
      .filter((r) => !r.prerelease)
      .sort((a, b) => new Date(b.published_at) - new Date(a.published_at))[0];
    if (newestStable && agTags.has(newestStable.tag_name)) {
      try {
        await atomgit(token, `/repos/${owner}/${repo}/releases/${encodeURIComponent(newestStable.tag_name)}`, {
          method: "PATCH",
          body: JSON.stringify(buildPayload(newestStable, "latest")),
        });
        console.log(`LATEST 已将 ${newestStable.tag_name} 标记为最新版本`);
      } catch (e) {
        console.error(`WARN 标记最新版本失败（${newestStable.tag_name}）：${e.message}`);
      }
    }
  } else {
    console.log("跳过「标记最新版本」：本次存在跳过或失败项，留待补齐后再标记");
  }

  console.log(
    `完成：新建 ${created}，跳过（tag 未同步）${skippedNoTag}，失败 ${failed}，` +
      `未处理 ${missing.length - queue.length}`,
  );

  return failed > 0 || skippedNoTag > 0 ? 1 : 0;
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    console.error(`✗ 同步到 AtomGit 失败：${e.message}`);
    if (e.status === 401 || e.status === 403) {
      console.error("  请检查 ATOMGIT_TOKEN 是否有效、是否具备仓库写权限");
    }
    process.exit(1);
  });
