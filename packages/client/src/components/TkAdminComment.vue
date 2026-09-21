<!--
  TkAdminComment 评论管理页签（1.x TkAdminComment.vue 的 Vue3 组合式重写）。

  关键词/可见性筛选 + 分页（每页 5 条）+ 逐条 查看/隐藏/显示/置顶/取消置顶/删除。
  「查看」会做域名安全校验：跨域链接不直接打开，改为提示用户手动复制（1.x 行为）。
-->
<template>
  <div v-loading="loading" class="tk-admin-comment">
    <div v-if="clientVersion !== serverVersion" class="tk-admin-warn">
      <span>{{ t("ADMIN_CLIENT_VERSION") }}{{ clientVersion }}，</span>
      <span>{{ t("ADMIN_SERVER_VERSION") }}{{ serverVersion }}，</span>
      <!--
        用 prettier-ignore 保持单行：这一段的换行/缩进空白会被 Vue 3 的 condense 折叠成
        一个空格（Vue 2 保留、HTML 同样折叠），与两侧的 &nbsp; 叠加后会让「版本更新」
        链接左右各宽约一个空格，而 1.x 只有 &nbsp;。所以必须让 &nbsp; 与 <a> 紧贴。
      -->
      <!-- prettier-ignore -->
      <span>请参考&nbsp;<a href="https://twikoo.js.org/update.html" target="_blank" rel="noopener noreferrer">版本更新</a>&nbsp;进行升级</span>
    </div>
    <div class="tk-admin-comment-filter">
      <TkInput
        v-model="filter.keyword"
        class="tk-admin-comment-filter-keyword"
        size="small"
        :placeholder="t('ADMIN_COMMENT_SEARCH_PLACEHOLDER')"
        @keyup.enter="getComments"
      />
      <select v-model="filter.type" class="tk-admin-comment-filter-type">
        <option value="">{{ t("ADMIN_COMMENT_FILTER_ALL") }}</option>
        <option value="VISIBLE">{{ t("ADMIN_COMMENT_FILTER_VISIBLE") }}</option>
        <option value="HIDDEN">{{ t("ADMIN_COMMENT_FILTER_HIDDEN") }}</option>
      </select>
      <TkButton size="small" type="primary" @click="getComments">
        {{ t("ADMIN_COMMENT_SEARCH") }}
      </TkButton>
    </div>
    <div ref="commentListRef" class="tk-admin-comment-list">
      <div v-for="comment in comments" :key="comment._id" class="tk-admin-comment-item">
        <div class="tk-admin-comment-meta">
          <TkAvatar
            :config="serverConfig"
            :avatar="comment.avatar"
            :nick="comment.nick"
            :mail="comment.mail"
            :link="comment.link"
          />
          <span v-if="!comment.link">{{ comment.nick }}&nbsp;</span>
          <a
            v-if="comment.link"
            :href="convertLink(comment.link)"
            target="_blank"
            rel="noopener noreferrer"
          >
            {{ comment.nick }}&nbsp;
          </a>
          <span v-if="comment.mail">
            (<a :href="`mailto:${comment.mail}`">{{ comment.mail }}</a
            >)&nbsp;
          </span>
          <span v-if="comment.isSpam">{{ t("ADMIN_COMMENT_IS_SPAM_SUFFIX") }}&nbsp;</span>
          <span class="tk-time">{{ displayCreated(comment) }}&nbsp;</span>
          <span :title="comment.ua">{{ comment.ipRegion }}</span>
        </div>
        <!-- 管理端正文：服务端已消毒，客户端再走一次 sanitizeHtml 双保险 -->
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div class="tk-content" v-html="comment.comment"></div>
        <div
          v-if="securityAlert && securityAlert.commentId === comment._id"
          class="tk-admin-warn tk-admin-security-alert"
        >
          <a class="tk-admin-close" href="#" @click.prevent="securityAlert = null">
            <TkIcon name="times" />
          </a>
          <div class="tk-admin-security-alert-message">{{ securityAlert.message }}</div>
          <div v-if="securityAlert.url" class="tk-admin-security-alert-url">
            <code>{{ securityAlert.url }}</code>
          </div>
        </div>
        <div class="tk-admin-actions">
          <TkButton size="mini" type="text" @click="handleView(comment)">
            {{ t("ADMIN_COMMENT_VIEW") }}
          </TkButton>
          <TkButton
            v-if="comment.isSpam"
            size="mini"
            type="text"
            @click="handleSpam(comment, false)"
          >
            {{ t("ADMIN_COMMENT_SHOW") }}
          </TkButton>
          <TkButton
            v-if="!comment.isSpam"
            size="mini"
            type="text"
            @click="handleSpam(comment, true)"
          >
            {{ t("ADMIN_COMMENT_HIDE") }}
          </TkButton>
          <TkButton
            v-if="!comment.rid && comment.top"
            size="mini"
            type="text"
            @click="handleTop(comment, false)"
          >
            {{ t("ADMIN_COMMENT_UNTOP") }}
          </TkButton>
          <TkButton
            v-if="!comment.rid && !comment.top"
            size="mini"
            type="text"
            @click="handleTop(comment, true)"
          >
            {{ t("ADMIN_COMMENT_TOP") }}
          </TkButton>
          <TkButton size="mini" type="text" @click="handleDelete(comment)">
            {{ t("ADMIN_COMMENT_DELETE") }}
          </TkButton>
        </div>
      </div>
    </div>
    <TkPagination
      :page-size="pageSize"
      :total="count"
      @page-size-change="onPageSizeChange"
      @current-change="switchPage"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { VERSION } from "@twikoojs/shared";
import TkAvatar from "./TkAvatar.vue";
import TkPagination from "./TkPagination.vue";
import TkButton from "../components/TkButton.vue";
import TkInput from "../components/TkInput.vue";
import TkIcon from "../components/TkIcon.vue";
import {
  call,
  convertLink,
  renderCode,
  renderLinks,
  renderMath,
  sanitizeHtml,
  t,
  timeago,
} from "../utils";
import { getAppState } from "../utils/api";
import { getServerConfig } from "../utils/state";
import { vLoading } from "../utils/directives";
import type { CommentDto, ServerConfig } from "../types";

/**
 * 管理端评论记录。
 *
 * **主键是 `_id` 而不是 `id`**：`COMMENT_GET_FOR_ADMIN` 下发的是**原始评论文档**
 * （见服务端 `parseCommentForAdmin`），只做 IP 属地补充，不做 `toCommentDto` 的
 * 字段重映射——因此它带的是库里的 `_id`，且没有 `replies`（管理列表是平铺的）。
 *
 * 1.x 的管理面板也是用 `comment._id`；2.0 重构时误写成 `comment.id`，
 * 导致所有管理操作都上送 `id: undefined`，被服务端 `validate(event, ["id"])`
 * 拦下后**静默失败**（客户端不检查返回码）——即 #1140。
 */
interface AdminCommentDto extends Omit<CommentDto, "id" | "replies"> {
  /** 评论文档 ID（原始文档主键） */
  _id: string;
}

/** 管理列表默认每页条数（1.x defaultPageSize） */
const defaultPageSize = 5;

/** 初始服务端版本（公开配置里可能已带 VERSION；非字符串一律视为空） */
const initialServerVersion = getServerConfig().VERSION;

/** 加载中 */
const loading = ref(true);
/** 评论列表（当前页） */
const comments = ref<AdminCommentDto[]>([]);
/** 管理端配置（`GET_CONFIG_FOR_ADMIN` 下发） */
const serverConfig = reactive<ServerConfig>({});
/** 服务端版本 */
const serverVersion = ref(typeof initialServerVersion === "string" ? initialServerVersion : "");
/** 客户端版本（构建期注入） */
const clientVersion = VERSION;
/** 总条数 */
const count = ref(0);
/** 每页条数 */
const pageSize = ref(defaultPageSize);
/** 当前页 */
const currentPage = ref(1);
/** 筛选条件 */
const filter = reactive({ keyword: "", type: "" });
/** 域名安全提示 */
const securityAlert = ref<{ commentId: string; message: string; url?: string } | null>(null);
/** 评论列表容器引用（渲染后处理目标） */
const commentListRef = ref<HTMLElement>();

/**
 * 相对时间文案（管理列表用）。
 * @param comment 评论
 * @returns 相对时间
 */
function displayCreated(comment: AdminCommentDto): string {
  return timeago(comment.created);
}

/** 拉取当前页评论（1.x getComments 对齐） */
async function getComments(): Promise<void> {
  loading.value = true;
  const res = await call(getAppState().tcb, "COMMENT_GET_FOR_ADMIN", {
    per: pageSize.value,
    page: currentPage.value,
    keyword: filter.keyword,
    type: filter.type,
  });
  const result = (res.result ?? res) as { code?: number; count?: number; data?: AdminCommentDto[] };
  if (result && !result.code) {
    count.value = result.count ?? 0;
    comments.value = (result.data ?? []).map((comment) => ({
      ...comment,
      comment: sanitizeHtml(comment.comment),
    }));
  }
  setTimeout(() => {
    applyRendering(commentListRef.value);
  }, 0);
  loading.value = false;
}

/** 拉取管理端配置（1.x getConfig 对齐） */
async function getConfig(): Promise<void> {
  const res = await call(getAppState().tcb, "GET_CONFIG_FOR_ADMIN");
  const result = (res.result ?? res) as { code?: number; config?: ServerConfig };
  if (result && !result.code && result.config) {
    Object.assign(serverConfig, result.config);
    serverVersion.value = typeof result.config.VERSION === "string" ? result.config.VERSION : "";
    checkConfig();
  }
}

/** 配置兜底与 meta 回填（1.x checkConfig 对齐） */
function checkConfig(): void {
  if (!serverConfig.HIGHLIGHT) serverConfig.HIGHLIGHT = "true";
  // 已登录状态下用本地 meta 回填，减少重复输入
  let metaData: Record<string, string> = {};
  const raw = localStorage.getItem("twikoo");
  if (raw) {
    try {
      metaData = JSON.parse(raw) as Record<string, string>;
    } catch {
      metaData = {};
    }
  }
  for (const key of ["nick", "mail", "avatar"]) {
    serverConfig[key] = metaData[key] ?? "";
  }
  if (!metaData.nick && serverConfig.BLOGGER_NICK)
    metaData.nick = String(serverConfig.BLOGGER_NICK);
  if (!metaData.mail && serverConfig.BLOGGER_EMAIL)
    metaData.mail = String(serverConfig.BLOGGER_EMAIL);
  if (!metaData.link && serverConfig.SITE_URL) metaData.link = String(serverConfig.SITE_URL);
  localStorage.setItem("twikoo", JSON.stringify(metaData));
}

/**
 * 每页条数变更（1.x onPageSizeChange 对齐）。
 * @param newPageSize 新的每页条数
 */
function onPageSizeChange(newPageSize: number): void {
  pageSize.value = newPageSize;
  void getComments();
}

/**
 * 切换页码（1.x switchPage 对齐）。
 * @param page 目标页码
 */
function switchPage(page: number): void {
  currentPage.value = page;
  void getComments();
}

/**
 * 查看评论所在页面（1.x handleView 对齐：跨域域名只提示不打开）。
 * @param comment 评论
 */
function handleView(comment: AdminCommentDto): void {
  const targetUrl = `${comment.url ?? ""}#${comment._id}`;
  try {
    const url = new URL(targetUrl);
    if (url.hostname !== window.location.hostname) {
      securityAlert.value = {
        commentId: comment._id,
        message: t("ADMIN_COMMENT_SECURITY_ALERT"),
        url: targetUrl,
      };
      return;
    }
    window.open(targetUrl);
  } catch {
    try {
      // 相对路径可解析时允许打开
      void new URL(targetUrl, window.location.origin);
      window.open(targetUrl);
    } catch {
      securityAlert.value = {
        commentId: comment._id,
        message: t("ADMIN_COMMENT_PARSE_ERROR"),
        url: comment.url,
      };
    }
  }
}

/**
 * 删除评论（1.x handleDelete 对齐：二次确认后重载当前页）。
 * @param comment 评论
 */
async function handleDelete(comment: AdminCommentDto): Promise<void> {
  if (!confirm(t("ADMIN_COMMENT_DELETE_CONFIRM"))) return;
  loading.value = true;
  await call(getAppState().tcb, "COMMENT_DELETE_FOR_ADMIN", { id: comment._id });
  await getComments();
  loading.value = false;
}

/**
 * 设置垃圾标记（1.x handleSpam 对齐）。
 * @param comment 评论
 * @param isSpam 目标状态
 */
function handleSpam(comment: AdminCommentDto, isSpam: boolean): void {
  void setComment(comment, { isSpam });
}

/**
 * 设置置顶（1.x handleTop 对齐）。
 * @param comment 评论
 * @param top 目标状态
 */
function handleTop(comment: AdminCommentDto, top: boolean): void {
  void setComment(comment, { top });
}

/**
 * 调用 COMMENT_SET_FOR_ADMIN 并重载列表（1.x setComment 对齐）。
 * @param comment 评论
 * @param set 要设置的字段
 */
async function setComment(comment: AdminCommentDto, set: Record<string, unknown>): Promise<void> {
  loading.value = true;
  await call(getAppState().tcb, "COMMENT_SET_FOR_ADMIN", { id: comment._id, set });
  await getComments();
  loading.value = false;
}

/**
 * 列表渲染后处理：外链安全化 + 公式 + 代码高亮（1.x highlightCode 合并入口）。
 * @param el 列表容器
 */
function applyRendering(el: HTMLElement | null): void {
  if (!el) return;
  renderLinks(el);
  renderMath(el, getAppState().options.katex);
  if (serverConfig.HIGHLIGHT === "true") {
    renderCode(el, serverConfig.HIGHLIGHT_THEME as string, serverConfig.HIGHLIGHT_PLUGIN as string);
  }
}

onMounted(async () => {
  await Promise.all([getConfig(), getComments()]);
  applyRendering(commentListRef.value);
});
</script>

<style>
.twikoo .tk-admin-comment {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.twikoo .tk-admin-comment a {
  color: currentColor;
  text-decoration: underline;
}
.twikoo .tk-admin-warn {
  margin-bottom: 1em;
}
.twikoo .tk-admin-security-alert {
  position: relative;
  padding-right: 2.5rem;
  margin-bottom: 0;
}
.twikoo .tk-admin-security-alert .tk-admin-close {
  position: absolute;
  top: 0;
  right: 0;
  float: none;
  width: 1rem;
  height: 1rem;
  padding: 0.5rem;
  margin: 0;
  line-height: 0;
}
.twikoo .tk-admin-security-alert-message {
  margin-bottom: 0.5em;
}
.twikoo .tk-admin-security-alert-url {
  word-break: break-all;
  background: rgba(0, 0, 0, 0.2);
  padding: 0.5em;
  border-radius: 4px;
  margin-bottom: 0.5em;
}
.twikoo .tk-admin-comment-filter {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.twikoo .tk-admin-comment-filter-keyword {
  flex: 1;
}
.twikoo .tk-admin-comment-filter-type {
  height: 32px;
  margin: 0 0.5em;
  padding: 0 0.5em;
  color: #ffffff;
  background-color: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(144, 147, 153, 0.31);
  border-radius: 4px;
  position: relative;
  -moz-appearance: none;
  -webkit-appearance: none;
}
.twikoo .tk-admin-comment-filter-type:focus {
  border-color: #409eff;
}
.twikoo .tk-admin-comment-filter-type option {
  color: initial;
}
.twikoo .tk-admin-comment-list {
  margin-top: 1em;
}
.twikoo .tk-admin-comment-list,
.twikoo .tk-admin-comment-item {
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: stretch;
}
.twikoo .tk-admin-comment-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 0.5em;
}
.twikoo .tk-admin-comment .tk-avatar {
  margin-right: 0.5em;
}
.twikoo .tk-admin-comment .tk-content {
  max-height: none;
}
.twikoo .tk-admin-actions {
  display: flex;
  margin-bottom: 1em;
  border-bottom: 1px solid rgba(255, 255, 255, 0.5);
}
</style>
