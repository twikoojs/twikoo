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
 *   4. 把最新正式版标记为仓库「最新版本」。
 *      这一步**不受**「有无差异」影响：两边 Release 都齐但标记缺失/错误时仍需纠正；
 *      仅在本轮没有任何跳过或失败时执行，避免数据不完整时把「最新」定格在旧版本。
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
 * 退出码：0 = 无差异且标记成功（或全部成功）；1 = 有失败（含 tag 未同步被跳过、
 *   以及「标记最新版本」失败 —— 后者必须让 CI 变红，否则标记没改成功却显示通过）。
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

/**
 * 网络抖动与限流的最多重试次数。
 *
 * 取 6 而非更小的值，是为了覆盖 AtomGit 间歇性 401：实测单次成功率约 25%，
 * 6 次全部失败的概率已很低；真正的令牌失效会稳定失败，不影响正确性。
 */
const MAX_ATTEMPTS = 6;

/** 分页抓取时每页条数（两边的上限都是 100） */
const PER_PAGE = 100;

/** 分页抓取的页数上限，防止异常响应导致死循环；达到上限仍未取完会直接报错 */
const MAX_PAGES = 20;

/** 命令行参数 */
const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");

/**
 * 解析并校验 `--limit` 参数。
 *
 * 刻意不把非法值当作「不限制」：`Number("abc")` 得到 NaN、负数也不满足 > 0，
 * 旧写法会让一次手误退化成「全量执行」，与调用者意图相反。
 * @returns 限制条数；未提供时为 0（表示不限制）
 */
function parseLimit() {
  const idx = argv.indexOf("--limit");
  if (idx < 0) return 0;
  const raw = argv[idx + 1];
  if (raw === undefined) throw new Error("--limit 缺少取值");
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`--limit 需为正整数，收到 "${raw}"`);
  }
  return n;
}

const LIMIT = parseLimit();

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
 * @param opts.treat404AsError 为 true 时 404 抛错而非返回 null。
 *   用于「目标必须存在」的调用（如标记最新版本），否则会把「没找到」误判为成功。
 * @returns 解析后的响应体；treat404AsError 为 false 时 404 返回 null
 */
async function requestJson(url, options = {}, label = "", { treat404AsError = false } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, options);
      const text = await res.text();

      // 404 默认用于探测「不存在」；需要严格存在性时由调用方要求抛错
      if (res.status === 404) {
        if (!treat404AsError) return null;
        const err = new Error(`HTTP 404 ${label} 目标不存在`);
        err.status = 404;
        err.body = text;
        throw err;
      }

      // 限流、服务端错误与间歇性 401 可重试。
      //
      // 401 也重试，是因为 AtomGit 的鉴权存在**间歇性误报**：实测同一个有效令牌
      // 对同一接口连续请求会随机返回 401（成功与失败交替出现）。真正的令牌失效
      // 会连续失败到耗尽重试次数，最终仍会正确报错。
      if (res.status === 401 || res.status === 429 || res.status >= 500) {
        lastError = new Error(`HTTP ${res.status} ${label} ${text.slice(0, 200)}`);
        lastError.status = res.status;
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
      // 其余 4xx 属于参数问题，重试无意义
      if (e.status && e.status >= 400 && e.status < 500 && e.status !== 401 && e.status !== 429) {
        throw e;
      }
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
 * @param requestOpts 传给 requestJson 的选项：{ label, treat404AsError }
 * @returns 解析后的响应体；404 时为 null（除非要求严格存在）
 */
function atomgit(token, path, options = {}, requestOpts = {}) {
  const { label = path, ...rest } = requestOpts;
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
    label,
    rest,
  );
}

/**
 * 通用分页抓取。
 *
 * 三个要点（都是为了避免「把不完整数据当成完整数据」）：
 * - 响应必须是数组，否则报错。把 404 的空响应当成空列表会让脚本误判
 *   「两边已一致」而静默跳过同步，比直接失败更糟；
 * - 不足一页即到末尾，正常结束；
 * - 取满 MAX_PAGES 仍有整页数据时报错，而不是静默返回部分结果。
 * @param buildUrl (page) => 完整 URL 或 API 路径
 * @param label 出错时用于定位的标签
 * @param fetchPage (url, label) => Promise<数组 | null>
 * @returns 全部条目
 */
async function fetchAllPages(buildUrl, label, fetchPage) {
  const all = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const chunk = await fetchPage(buildUrl(page), `${label} page ${page}`);
    if (!Array.isArray(chunk)) {
      throw new Error(`${label} 第 ${page} 页响应不是数组，疑似接口异常或仓库不可见`);
    }
    if (chunk.length === 0) return all;
    all.push(...chunk);
    if (chunk.length < PER_PAGE) return all;
  }
  throw new Error(
    `${label} 超过 ${MAX_PAGES} 页仍未取完（每页 ${PER_PAGE} 条），` +
      `已取到的 ${all.length} 条可能不完整，请提高 MAX_PAGES 后重试`,
  );
}

/**
 * 分页抓取 GitHub 全部非草稿 Release。
 * @param repo GitHub 仓库（owner/name）
 * @param token GitHub token（可空，空则匿名）
 * @returns Release 数组（GitHub 默认按 published_at 倒序）
 */
async function fetchGithubReleases(repo, token) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "twikoo-release-sync",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const all = await fetchAllPages(
    (page) => `${GITHUB_API}/repos/${repo}/releases?per_page=${PER_PAGE}&page=${page}`,
    "GitHub releases",
    (url, label) => requestJson(url, { headers }, label),
  );
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
  const list = await fetchAllPages(
    (page) => `/repos/${owner}/${repo}/releases?per_page=${PER_PAGE}&direction=desc&page=${page}`,
    "AtomGit releases",
    (path, label) => atomgit(token, path, {}, { label }),
  );
  const map = new Map();
  for (const r of list) map.set(r.tag_name, r);
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
  const list = await fetchAllPages(
    (page) => `/repos/${owner}/${repo}/tags?per_page=${PER_PAGE}&page=${page}`,
    "AtomGit tags",
    (path, label) => atomgit(token, path, {}, { label }),
  );
  return new Set(list.map((t) => t.name));
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
 * 把最新的正式版标记为 AtomGit「最新版本」。
 *
 * 该标记在 AtomGit 上**全局唯一**，设置一条会顶掉上一条，因此必须放在最后单独执行，
 * 且只在没有任何跳过/失败时执行 —— 数据不完整时把「最新」定格在旧版本上会产生误导。
 *
 * 三个防御点：
 * - 目标必须确实存在：PATCH 时启用 treat404AsError，否则 404 会被当成成功；
 * - 失败必须计入退出码，不能只打 warning；
 * - 用 404 当作错误后，重建一次列表确认目标存在，避免对未创建的 Release 发请求。
 * @param ctx 运行上下文
 * @param ctx.token AtomGit 令牌
 * @param ctx.owner/repo 仓库
 * @param ctx.ghAll GitHub 全部 Release
 * @param ctx.agTags AtomGit 现有 tag 集合
 * @returns { marked: boolean, error: Error | null }
 */
async function markLatest(ctx) {
  const { token, owner, repo, ghAll, agTags } = ctx;

  const newestStable = [...ghAll]
    .filter((r) => !r.prerelease)
    .sort((a, b) => new Date(b.published_at) - new Date(a.published_at))[0];

  if (!newestStable) return { marked: false, error: null };
  // 最新正式版的 tag 必须已在 AtomGit 上，否则无从标记
  if (!agTags.has(newestStable.tag_name)) return { marked: false, error: null };

  try {
    await atomgit(
      token,
      `/repos/${owner}/${repo}/releases/${encodeURIComponent(newestStable.tag_name)}`,
      { method: "PATCH", body: JSON.stringify(buildPayload(newestStable, "latest")) },
      { treat404AsError: true },
    );
    console.log(`LATEST 已将 ${newestStable.tag_name} 标记为最新版本`);
    return { marked: true, error: null };
  } catch (e) {
    return { marked: false, error: e };
  }
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
    console.log("✓ 两边 Release 已一致，无缺失项");
  } else {
    console.log(`发现 ${missing.length} 条差异：${missing.map((r) => r.tag_name).join(", ")}`);
  }

  if (!APPLY) {
    if (missing.length > 0) console.log("（DRY-RUN 不写入；加 --apply 实际执行）");
    return 0;
  }

  // 3. 预先取 AtomGit 现有 tag，用于判断 tag 是否已随镜像同步过来
  const agTags = await fetchAtomgitTags(token, owner, repo);

  const queue = LIMIT > 0 ? missing.slice(0, LIMIT) : missing;
  if (queue.length > 0) console.log(`本次处理 ${queue.length} 条`);

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
      const createdRelease = await atomgit(token, `/repos/${owner}/${repo}/releases`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!createdRelease || createdRelease.tag_name !== tag) {
        throw new Error(`响应异常：期望 tag ${tag}，实际 ${JSON.stringify(createdRelease?.tag_name)}`);
      }
      // 预发布标记曾被静默忽略过，必须回读确认
      if (createdRelease.prerelease !== Boolean(gh.prerelease)) {
        throw new Error(
          `预发布标记未生效：期望 ${Boolean(gh.prerelease)}，实际 ${JSON.stringify(createdRelease.prerelease)}`,
        );
      }

      created += 1;
      console.log(
        `OK   ${prefix} prerelease=${createdRelease.prerelease} bodyLen=${(createdRelease.body ?? "").length}`,
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

  // 4. 标记最新版本。
  //
  // 这一步刻意**不**被 missing.length === 0 挡住：两边 release 都齐但 latest 标记
  // 缺失或错误时（例如上次标记失败、或有人在网页上改过），仍然需要纠正。
  //
  // 仅在没有跳过/失败时执行：数据不完整时把「最新」定格在旧版本会产生误导。
  if (failed === 0 && skippedNoTag === 0) {
    const { marked, error } = await markLatest({ token, owner, repo, ghAll, agTags });
    if (error) {
      // 失败必须计入退出码，否则「标记没改成功」会以成功退出，误导调用方
      failed += 1;
      console.error(`FAIL 标记最新版本失败：${error.message}`);
    } else if (!marked) {
      console.log("（AtomGit 上暂无可标记的最新正式版，跳过）");
    }
  } else {
    console.log("跳过「标记最新版本」：本次存在跳过或失败项，留待补齐后再标记");
  }

  console.log(
    `完成：新建 ${created}，跳过（tag 未同步）${skippedNoTag}，失败 ${failed}，` +
      `未处理 ${Math.max(0, missing.length - queue.length)}`,
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
