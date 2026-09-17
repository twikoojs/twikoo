<!--
  评论列表组件（1.x TkComments.vue 的 Vue3 骨架重写）。
  数据流：COMMENT_GET → parseComment DTO → 渲染主楼与回复；
  加载更多（more 标志）与分页随 T30 补全交互细节。
-->
<template>
  <div class="tk-comments-container">
    <div class="tk-comments-title">评论</div>
    <div v-if="loading" class="tk-comments-loading">加载中...</div>
    <div v-else-if="comments.length === 0" class="tk-comments-empty">还没有评论</div>
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
      <button class="tk-button" type="button" @click="loadMore">查看更多</button>
    </div>
  </div>
</template>

<script lang="ts">
import { call } from "../../utils/api";
import { timeago } from "../../utils";

/** 评论 DTO（服务端 parseComment 产出） */
interface CommentDto {
  id: string;
  nick?: string;
  comment?: string;
  created?: number;
  replies: Array<{ id: string; nick?: string; comment?: string; created?: number }>;
}

export default {
  name: "TkComments",
  /** 组件状态（评论列表 / 分页 / 加载标志） */
  data() {
    return {
      comments: [] as Array<CommentDto & { createdDisplay: string }>,
      more: false,
      count: 0,
      loading: true,
      page: 1,
    };
  },
  /** 挂载即拉取评论 */
  mounted() {
    void this.load();
  },
  methods: {
    /** 拉取评论列表（1.x commentGet 语义：主楼+回复归组） */
    async load() {
      this.loading = this.comments.length === 0;
      try {
        const result = await call(this.$tcb, "COMMENT_GET", {
          url: this.$twikoo?.path ?? window.location.pathname,
          page: this.page,
        });
        const payload = result as {
          data: CommentDto[];
          more: boolean;
          count: number;
        };
        this.comments = payload.data.map((c) => ({
          ...c,
          createdDisplay: timeago(c.created ?? 0),
        }));
        this.more = payload.more;
        this.count = payload.count;
      } catch (e) {
        console.error("[twikoo] COMMENT_GET 失败", e);
      } finally {
        this.loading = false;
      }
    },
    /** 查看更多（翻页重新拉取，1.x 流式分页语义） */
    /** 查看更多（翻页重新拉取，1.x 流式分页语义） */
    loadMore() {
      this.page += 1;
      void this.load();
    },
  },
};
</script>
