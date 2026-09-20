<!--
  TkComments 评论区主体（1.x TkComments.vue 的 Vue3 组合式重写）。

  职责：拉取公开配置（`GET_CONFIG`）与评论列表（`COMMENT_GET`）、排序/搜索/刷新、
  流式「加载更多」（按最旧时间游标翻页，搜索态改为页码翻页）、回复框状态分发、
  管理入口齿轮、配置更新后保持状态的静默刷新。

  与 1.x 的等价性要点：
  - `requestVersion` 递增序号用于丢弃过期响应（1.x 同名机制）；
  - `configUpdated` 事件经 `utils/bus.ts` 广播（1.x 为 `app.$on('configUpdated')`）；
  - 公开配置同时写入共享 `serverConfig`（`TkComment` 判定 `IS_ADMIN`/`LIGHTBOX` 用）。
-->
<template>
  <div class="tk-comments">
    <TkSubmit :config="config" @load="initComments" @error="onError" />
    <div v-loading="loading" class="tk-comments-container">
      <div class="tk-comments-title">
        <span
          class="tk-comments-count"
          :class="{ __hidden: loading || (!comments.length && !searchKeyword) }"
        >
          <span v-if="searchKeyword">{{ t("COMMENTS_SEARCH_COUNT_PREFIX") }}</span>
          <span>{{ count }}</span>
          <span>{{ t("COMMENTS_COUNT_SUFFIX") }}</span>
        </span>
        <span class="tk-comments-actions">
          <span
            v-if="!loading && comments.length && config.SHOW_ORDER !== 'false'"
            class="tk-comments-sort"
          >
            <button
              class="tk-sort-item"
              type="button"
              :class="{ __active: currentSort === 'newest' }"
              @click="setSort('newest')"
            >
              {{ t("COMMENTS_SORT_NEWEST") }}
            </button>
            <button
              class="tk-sort-item"
              type="button"
              :class="{ __active: currentSort === 'oldest' }"
              @click="setSort('oldest')"
            >
              {{ t("COMMENTS_SORT_OLDEST") }}
            </button>
            <button
              class="tk-sort-item"
              type="button"
              :class="{ __active: currentSort === 'popular' }"
              @click="setSort('popular')"
            >
              {{ t("COMMENTS_SORT_POPULAR") }}
            </button>
          </span>
          <span
            v-if="!loading && !loadingMore"
            class="tk-icon __comments"
            :class="{ __active: showSearch }"
            @click="toggleSearch"
          >
            <TkIcon name="magnifying-glass" />
          </span>
          <span v-if="!loading && !loadingMore" class="tk-icon __comments" @click="refresh">
            <TkIcon name="sync" />
          </span>
          <span v-if="showAdminEntry" class="tk-icon __comments" @click="openAdmin">
            <TkIcon name="cog" />
          </span>
        </span>
      </div>
      <div v-show="showSearch" class="tk-comments-search">
        <TkInput
          ref="searchInputRef"
          v-model="searchInput"
          size="small"
          clearable
          :maxlength="100"
          :placeholder="t('COMMENTS_SEARCH_PLACEHOLDER')"
          @clear="clearSearch"
          @keyup.enter="search"
        />
        <TkButton size="small" type="primary" @click="search">
          {{ t("COMMENTS_SEARCH") }}
        </TkButton>
      </div>
      <!-- 评论区唯一错误卡片：列表/提交/回复失败共用，位于空态块上方 -->
      <TkError v-if="error" :error="error" />
      <div v-if="!comments.length && !loading && !error" class="tk-comments-no">
        <span v-if="searchKeyword">{{ t("COMMENTS_SEARCH_NO_RESULT") }}</span>
        <span v-if="!searchKeyword">{{ t("COMMENTS_NO_COMMENTS") }}</span>
      </div>
      <TkComment
        v-for="comment in comments"
        :key="comment.id"
        :comment="comment"
        :replying="replyId === comment.id"
        :config="config"
        @reply="onReply"
        @load="refreshPreservingState"
        @error="onError"
      />
      <div v-if="showExpand && !loading && !error" class="tk-expand-wrap">
        <div v-loading="loadingMore" class="tk-expand" @click="onExpand">
          {{ t("COMMENTS_EXPAND") }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import TkComment from "./TkComment.vue";
import TkSubmit from "./TkSubmit.vue";
import TkButton from "../components/TkButton.vue";
import TkInput from "../components/TkInput.vue";
import TkIcon from "../components/TkIcon.vue";
import TkError from "../components/TkError.vue";
import { call, getUrl, logger, t } from "../utils";
import { TwikooError, getAppState } from "../utils/api";
import { setServerConfig } from "../utils/state";
import { EVENT_CONFIG_UPDATED, off as busOff, on as busOn } from "../utils/bus";
import { vLoading } from "../utils/directives";
import type { CommentDto, ServerConfig } from "../types";

// props 仅在模板中使用（showAdminEntry），故不绑定局部变量
withDefaults(
  defineProps<{
    /** 是否显示管理入口齿轮（`HIDE_ADMIN_CRYPT` 命中时） */
    showAdminEntry?: boolean;
  }>(),
  { showAdminEntry: false },
);

/** 组件事件（1.x `$emit` 同名保留） */
const emit = defineEmits<{
  (e: "admin"): void;
  (e: "refreshed"): void;
}>();

/** 列表加载中 */
const loading = ref(true);
/** 「加载更多」进行中 */
const loadingMore = ref(false);
/**
 * 评论区**唯一**的错误（统一错误模型）。
 *
 * 三个来源共用这一个状态，后到的错误直接覆盖前者，整个评论区只渲染一张错误卡片：
 * 1. 本组件自身的列表 / 配置请求失败；
 * 2. 主提交框（`TkSubmit`）的提交失败；
 * 3. 任意层级回复框（嵌套 `TkComment` 内的 `TkSubmit`）的提交失败——逐层 `error` 事件冒泡至此。
 * 清除时机：列表重新加载成功（`initComments` / `refreshPreservingState` 入口置空）。
 */
const error = ref<TwikooError | null>(null);
/** 公开配置 */
const config = ref<ServerConfig>({});
/** 评论列表（主楼 + 归组回复） */
const comments = ref<CommentDto[]>([]);
/** 是否还有更多（`more` 标志） */
const showExpand = ref(true);
/** 评论总数 */
const count = ref(0);
/** 当前展开回复框的主楼 ID */
const replyId = ref("");
/** 已加载页数 */
const loadedPages = ref(1);
/** 当前排序 */
const currentSort = ref("newest");
/** 搜索输入框内容 */
const searchInput = ref("");
/** 已生效的搜索关键字 */
const searchKeyword = ref("");
/** 是否展开搜索行 */
const showSearch = ref(false);
/** 请求版本号（丢弃过期响应） */
const requestVersion = ref(0);
/** 搜索输入框引用 */
const searchInputRef = ref<{ focus(): void }>();

/** 拉取公开配置并写入共享 serverConfig（1.x initConfig 对齐；失败仅告警不阻断列表加载） */
async function initConfig(): Promise<void> {
  try {
    const res = await call(getAppState().tcb, "GET_CONFIG");
    const result = (res.result ?? res) as { config?: ServerConfig };
    if (result.config) {
      config.value = result.config;
      setServerConfig(result.config);
    }
  } catch (e) {
    logger.warn("加载公开配置失败", e);
  }
}

/** 首次加载评论（重置到第一页；1.x initComments 对齐） */
async function initComments(): Promise<void> {
  const version = ++requestVersion.value;
  loading.value = true;
  error.value = null;
  const url = getUrl(getAppState().options.path);
  const event: Record<string, unknown> = {
    url,
    sort: currentSort.value,
    keyword: searchKeyword.value,
  };
  if (searchKeyword.value) event.page = 1;
  await getComments(event);
  if (version === requestVersion.value) loading.value = false;
}

/** 重置列表与页数（1.x resetComments 对齐） */
function resetComments(): void {
  comments.value = [];
  loadedPages.value = 1;
}

/** 执行搜索（1.x search 对齐） */
function search(): void {
  const keyword = searchInput.value.trim();
  searchInput.value = keyword;
  if (searchKeyword.value === keyword) return;
  searchKeyword.value = keyword;
  resetComments();
  void initComments();
}

/** 清空搜索（1.x clearSearch 对齐） */
function clearSearch(): void {
  if (!searchKeyword.value) return;
  searchKeyword.value = "";
  resetComments();
  void initComments();
}

/** 展开/收起搜索行（1.x toggleSearch 对齐） */
function toggleSearch(): void {
  showSearch.value = !showSearch.value;
  if (showSearch.value) {
    setTimeout(() => searchInputRef.value?.focus(), 0);
  } else {
    searchInput.value = "";
    clearSearch();
  }
}

/** 刷新列表（1.x refresh 对齐） */
function refresh(): void {
  resetComments();
  void initComments();
}

/** 刷新但保持已加载页数与排序/搜索状态（1.x refreshPreservingState 对齐） */
async function refreshPreservingState(): Promise<void> {
  const version = ++requestVersion.value;
  loading.value = true;
  error.value = null;
  try {
    const url = getUrl(getAppState().options.path);
    const pages = loadedPages.value;
    const event: Record<string, unknown> = {
      url,
      sort: currentSort.value,
      keyword: searchKeyword.value,
    };
    if (searchKeyword.value) event.page = 1;
    if (!(await getComments(event))) return;
    for (let page = 2; page <= pages; page++) {
      if (!(await loadNextPage(url, page))) break;
    }
  } finally {
    if (version === requestVersion.value) loading.value = false;
  }
  if (version === requestVersion.value) emit("refreshed");
}

/**
 * 切换排序（1.x setSort 对齐）。
 * @param sort 目标排序
 */
function setSort(sort: string): void {
  if (currentSort.value === sort) return;
  currentSort.value = sort;
  resetComments();
  void initComments();
}

/** 加载更多（1.x onExpand 对齐） */
async function onExpand(): Promise<void> {
  if (loadingMore.value) return;
  loadingMore.value = true;
  loadedPages.value++;
  try {
    const url = getUrl(getAppState().options.path);
    await loadNextPage(url, loadedPages.value);
  } finally {
    loadingMore.value = false;
  }
}

/**
 * 取当前列表中最旧的评论时间（翻页游标；跳过置顶项）。
 * @returns 最旧时间戳；无可参考项时返回 undefined
 */
function getOldestCreated(): number | undefined {
  let min = Infinity;
  for (const item of comments.value) {
    if (!item.top && (item.created ?? Infinity) < min) min = item.created ?? Infinity;
  }
  return min === Infinity ? undefined : min;
}

/**
 * 加载下一页（搜索态按页码，普通态按最旧时间游标；1.x loadNextPage 对齐）。
 * @param url 目标页面路径
 * @param page 页码
 * @returns 是否加载成功
 */
async function loadNextPage(url: string, page = loadedPages.value): Promise<boolean> {
  if (searchKeyword.value) {
    return getComments({ url, page, sort: currentSort.value, keyword: searchKeyword.value });
  }
  const before = getOldestCreated();
  if (before === undefined) return false;
  return getComments({ url, before, sort: currentSort.value, keyword: searchKeyword.value });
}

/** 列表渲染完成后回调使用方钩子（1.x onCommentLoaded 对齐） */
function onCommentLoaded(): void {
  const hook = getAppState().options.onCommentLoaded;
  if (typeof hook === "function") hook();
}

/**
 * 拉取评论并合并到列表（1.x getComments 对齐）。
 * @param event 请求参数（url/sort/keyword/before/page）
 * @returns 是否成功
 */
async function getComments(event: Record<string, unknown>): Promise<boolean> {
  const version = requestVersion.value;
  try {
    const res = await call(getAppState().tcb, "COMMENT_GET", event);
    if (version !== requestVersion.value) return false;
    const result = (res.result ?? res) as {
      message?: string;
      data?: CommentDto[];
      more?: boolean;
      count?: number;
    };
    if (result?.message) {
      error.value = new TwikooError("CLIENT_ERROR", result.message, {
        rawMessage: result.message,
      });
      return false;
    }
    if (result?.data) {
      comments.value =
        event.before || (typeof event.page === "number" && event.page > 1)
          ? comments.value.concat(result.data)
          : result.data;
      showExpand.value = result.more === true;
      count.value = result.count ?? comments.value.length;
      setTimeout(onCommentLoaded, 0);
      return true;
    }
  } catch (e) {
    // api 层抛出的已是分类好的 TwikooError（NETWORK / CORS / TIMEOUT / …），保留其 kind
    if (version === requestVersion.value) {
      error.value =
        e instanceof TwikooError
          ? e
          : new TwikooError("UNKNOWN", (e as Error).message, {
              rawMessage: (e as Error).message,
            });
    }
  }
  return false;
}

/**
 * 接收子组件（主提交框 / 任意层级回复框）上报的提交错误。
 *
 * 只接收「新错误」——子组件成功时置空不发，错误卡片的清除统一由列表重新加载成功负责，
 * 避免「一次成功的提交把列表请求的错误顺手清掉」。
 * @param err 子组件上报的错误
 */
function onError(err: TwikooError): void {
  error.value = err;
}

/**
 * 展开/切换某条主楼的回复框（1.x onReply 对齐）。
 * @param id 主楼评论 ID（空串表示取消）
 */
function onReply(id: string): void {
  replyId.value = id;
}

/** 打开管理面板（1.x openAdmin 对齐） */
function openAdmin(): void {
  emit("admin");
}

/** 配置更新后重新拉取公开配置（总线事件处理器必须是同步签名，故包一层） */
function onConfigUpdated(): void {
  void initConfig();
}

/** 配置更新后保持状态刷新评论列表 */
function onConfigRefresh(): void {
  void refreshPreservingState();
}

onMounted(() => {
  void initConfig();
  void initComments();
  // 保存配置后同步刷新配置和评论可见性（1.x app.$on('configUpdated') 等价物）
  busOn(EVENT_CONFIG_UPDATED, onConfigUpdated);
  busOn(EVENT_CONFIG_UPDATED, onConfigRefresh);
});

onUnmounted(() => {
  busOff(EVENT_CONFIG_UPDATED, onConfigUpdated);
  busOff(EVENT_CONFIG_UPDATED, onConfigRefresh);
});
</script>

<style>
.twikoo .tk-comments-search {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}
.twikoo .tk-comments-search .tk-input {
  flex: 1;
}
@media (max-width: 480px) {
  .twikoo .tk-comments-search {
    flex-wrap: wrap;
  }
  .twikoo .tk-comments-search .tk-input {
    flex-basis: 100%;
  }
}
.twikoo .tk-comments-title {
  font-size: 1.25rem;
  font-weight: bold;
  line-height: 1;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}
.twikoo .tk-comments-count.__hidden {
  visibility: hidden;
}
.twikoo .tk-comments-count {
  flex-shrink: 0;
  white-space: nowrap;
}
.twikoo .tk-comments-actions {
  display: flex;
  align-items: center;
  gap: 0.5em;
  white-space: nowrap;
}
.twikoo .tk-comments-container {
  min-height: 10rem;
  display: flex;
  flex-direction: column;
}
.twikoo .tk-comments-no {
  flex: 1;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
}
.twikoo .tk-comments-sort {
  display: flex;
  align-items: center;
  gap: 0.75em;
  margin-right: 0.5em;
  line-height: 1;
}
.twikoo .tk-sort-item {
  display: inline-flex;
  align-items: center;
  font-size: 0.75rem;
  line-height: 1;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  color: rgba(64, 158, 255, 0.6);
}
.twikoo .tk-sort-item.__active {
  color: #409eff;
}
.twikoo .tk-sort-item:focus {
  outline: none;
  color: #409eff;
}
.twikoo .tk-icon.__comments {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  vertical-align: middle;
  height: 0.75rem;
  width: 0.75rem;
  line-height: 0;
  flex-shrink: 0;
  cursor: pointer;
  color: #409eff;
}
.twikoo .tk-icon.__comments.__active {
  color: #ffffff;
  background: #409eff;
  border-radius: 0.125rem;
  box-shadow: 0 0 0 0.2rem #409eff;
}
.twikoo .tk-icon.__comments svg {
  display: block;
  width: 100%;
  height: 100%;
}
.twikoo div.code-toolbar {
  position: relative;
  border-radius: 0.3em;
}
.twikoo .tk-content pre,
.twikoo .tk-preview-container pre {
  overflow-x: auto;
  max-width: 100%;
}
.twikoo .tk-content pre code,
.twikoo .tk-preview-container pre code {
  white-space: pre;
  word-break: normal;
}
.twikoo div.code-toolbar > .toolbar {
  position: absolute;
  right: 4px;
  top: 4px;
  font-size: 0.8125rem;
  font-weight: 500;
  display: flex;
}
.twikoo div.code-toolbar > .toolbar > .toolbar-item {
  margin-left: 0.3em;
}
.twikoo div.code-toolbar > .toolbar > .toolbar-item > a,
.twikoo div.code-toolbar > .toolbar > .toolbar-item > button,
.twikoo div.code-toolbar > .toolbar > .toolbar-item > span {
  padding: 2px 4px;
  border-radius: 0.3em;
}
.twikoo div.code-toolbar > .toolbar > .toolbar-item > button {
  border: 1px solid rgba(128, 128, 128, 0.31);
}
.twikoo div.code-toolbar > .toolbar > .toolbar-item > button:hover {
  cursor: pointer;
}
</style>
