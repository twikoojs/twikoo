<!--
  TkAction 单条评论的操作栏（1.x TkAction.vue 的 Vue3 组合式重写）。

  四个动作：删除（仅本人）/ 点赞 / 点踩 / 回复。图标为「线性 + 实心」双份，
  由 CSS 按 hover / 激活态切换（1.x 同机制，`.tk-action-icon-solid` 默认隐藏）。
-->
<template>
  <div class="tk-action">
    <button v-if="showDelete" class="tk-action-link" @click="emit('delete')">
      <span class="tk-action-icon"><TkIcon name="trash-regular" /></span>
      <span class="tk-action-icon tk-action-icon-solid"><TkIcon name="trash" /></span>
      <span class="tk-action-count"></span>
    </button>
    <button class="tk-action-link" :class="{ 'tk-liked': liked }" @click="emit('like')">
      <span class="tk-action-icon"><TkIcon name="thumbs-up-regular" /></span>
      <span class="tk-action-icon tk-action-icon-solid"><TkIcon name="thumbs-up" /></span>
      <span class="tk-action-count">{{ likeCountStr }}</span>
    </button>
    <button
      v-if="showDislike"
      class="tk-action-link"
      :class="{ 'tk-disliked': disliked }"
      @click="emit('dislike')"
    >
      <span class="tk-action-icon"><TkIcon name="thumbs-down-regular" /></span>
      <span class="tk-action-icon tk-action-icon-solid"><TkIcon name="thumbs-down" /></span>
      <span class="tk-action-count">{{ dislikeCountStr }}</span>
    </button>
    <button class="tk-action-link" @click="emit('reply')">
      <span class="tk-action-icon"><TkIcon name="comment-regular" /></span>
      <span class="tk-action-icon tk-action-icon-solid"><TkIcon name="comment" /></span>
      <span class="tk-action-count">{{ repliesCountStr }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import TkIcon from "../components/TkIcon.vue";

/** 组件属性 */
const props = withDefaults(
  defineProps<{
    /** 当前访问者是否已点赞 */
    liked?: boolean;
    /** 当前访问者是否已点踩 */
    disliked?: boolean;
    /** 点赞数 */
    likeCount?: number;
    /** 点踩数 */
    dislikeCount?: number;
    /** 回复数 */
    repliesCount?: number;
    /** 是否显示点踩按钮（`SHOW_DISLIKE` 配置） */
    showDislike?: boolean;
    /** 是否显示删除按钮（仅评论作者） */
    showDelete?: boolean;
  }>(),
  {
    liked: false,
    disliked: false,
    likeCount: 0,
    dislikeCount: 0,
    repliesCount: 0,
    showDislike: true,
    showDelete: false,
  },
);

/** 组件事件（1.x `$emit` 同名保留） */
const emit = defineEmits<{
  (e: "like"): void;
  (e: "dislike"): void;
  (e: "reply"): void;
  (e: "delete"): void;
}>();

/** 计数文案（0 时不显示数字，1.x 行为） */
const likeCountStr = computed(() => (props.likeCount > 0 ? `${props.likeCount}` : ""));
/** 点踩计数文案 */
const dislikeCountStr = computed(() => (props.dislikeCount > 0 ? `${props.dislikeCount}` : ""));
/** 回复计数文案 */
const repliesCountStr = computed(() => (props.repliesCount > 0 ? `${props.repliesCount}` : ""));
</script>

<style>
.twikoo .tk-action {
  display: flex;
  align-items: center;
}
.twikoo .tk-action-link {
  appearance: none;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  margin: 0;
  margin-left: 0.5rem;
  color: #409eff;
  text-decoration: none;
  display: flex;
  align-items: center;
}
.twikoo .tk-action-link .tk-action-icon-solid {
  display: none;
}
.twikoo .tk-action-link.tk-liked .tk-action-icon,
.twikoo .tk-action-link:hover .tk-action-icon {
  display: none;
}
.twikoo .tk-action-link.tk-liked .tk-action-icon-solid,
.twikoo .tk-action-link:hover .tk-action-icon-solid {
  display: block;
}
.twikoo .tk-action-link.tk-disliked .tk-action-icon,
.twikoo .tk-action-link.tk-disliked:hover .tk-action-icon {
  display: none;
}
.twikoo .tk-action-link.tk-disliked .tk-action-icon-solid,
.twikoo .tk-action-link.tk-disliked:hover .tk-action-icon-solid {
  display: block;
}
.twikoo .tk-action-count {
  margin-left: 0.25rem;
  font-size: 0.75rem;
  height: 1.5rem;
  line-height: 1.5rem;
}
.twikoo .tk-action-icon {
  display: inline-block;
  height: 1em;
  width: 1em;
  line-height: 0;
  color: #409eff;
}
</style>
