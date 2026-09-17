<!--
  评论列表组件（1.x TkComments.vue 的 Vue3 组合式 API 重写）。
  数据流：COMMENT_GET → parseComment DTO → 渲染主楼与回复；more 标志驱动加载更多。
-->
<template>
  <div class="tk-comments-container">
    <TkLoading :visible="loading" />
    <div v-if="!loading && comments.length === 0" class="tk-comments-empty">
      {{ t("还没有评论") }}
    </div>
    <div v-else class="tk-comments-list">
      <div v-for="comment in comments" :key="comment.id" class="tk-comment">
        <div class="tk-comment-meta">
          <span class="tk-nick">{{ comment.nick }}</span>
          <span class="tk-time">{{ comment.createdDisplay }}</span>
        </div>
        <!-- 内容经服务端 DOMPurify 消毒 -->
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div class="tk-comment-content" v-html="comment.comment"></div>
        <div v-if="comment.replies.length" class="tk-replies">
          <div v-for="reply in comment.replies" :key="reply.id" class="tk-reply">
            <span class="tk-nick">{{ reply.nick }}</span>
            <!-- 内容经服务端 DOMPurify 消毒 -->
            <!-- eslint-disable-next-line vue/no-v-html -->
            <div class="tk-comment-content" v-html="reply.comment"></div>
          </div>
        </div>
      </div>
    </div>
    <div v-if="more" class="tk-more">
      <TkButton size="small" @click="loadMore">查看更多</TkButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { call, getAppState } from "../../utils/api";
import { timeago } from "../../utils";
import TkButton from "../../components/TkButton.vue";
import TkLoading from "../../components/TkLoading.vue";

/** 评论 DTO（服务端 parseComment 产出） */
interface CommentDto {
  id: string;
  nick?: string;
  comment?: string;
  created?: number;
  replies: Array<{ id: string; nick?: string; comment?: string; created?: number }>;
}

/** 组件状态 */
const comments = ref<Array<CommentDto & { createdDisplay: string }>>([]);
const more = ref(false);
const loading = ref(true);
const page = ref(1);

/** 云开发实例与前端选项（App 渲染时经 setAppState 注入） */
const { tcb, options } = getAppState();

/** 拉取评论列表（1.x commentGet 语义：主楼+回复归组） */
async function load(): Promise<void> {
  loading.value = comments.value.length === 0;
  try {
    const payload = (await call(tcb, "COMMENT_GET", {
      url: options.path ?? window.location.pathname,
      page: page.value,
    })) as unknown as {
      data: Array<CommentDto & { createdDisplay: string }>;
      more: boolean;
      count: number;
    };
    comments.value = payload.data.map((c) => ({
      ...c,
      createdDisplay: timeago(c.created ?? 0),
    }));
    more.value = payload.more;
  } catch (e) {
    console.error("[twikoo] COMMENT_GET 失败", e);
  } finally {
    loading.value = false;
  }
}

/** 查看更多（翻页重新拉取，1.x 流式分页语义） */
function loadMore(): void {
  page.value += 1;
  void load();
}

void load();
</script>
