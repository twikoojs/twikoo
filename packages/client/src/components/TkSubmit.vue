<!--
  TkSubmit 评论提交组件（1.x TkSubmit.vue 的 Vue3 组合式重写核心形态）。
  字段：昵称/邮箱/网址（meta 输入）+ 评论内容 textarea + 预览/发送按钮；
  预览经 marked + sanitizeHtml；发送走 COMMENT_SUBMIT；错误内联 TkError 卡片。
-->
<template>
  <div class="tk-submit">
    <TkError v-if="error" :error="error" />
    <div class="tk-row tk-meta-input">
      <TkInput
        v-model="nick"
        class="tk-meta-input__item"
        placeholder="昵称（必填）"
        :maxlength="30"
      />
      <TkInput
        v-model="mail"
        class="tk-meta-input__item"
        placeholder="邮箱（必填）"
        :maxlength="50"
      />
      <TkInput v-model="link" class="tk-meta-input__item" placeholder="网址" :maxlength="100" />
    </div>
    <div class="tk-row">
      <TkInput
        v-model="comment"
        type="textarea"
        :rows="4"
        placeholder="说点什么吧，多试试 Markdown 语法～"
      />
    </div>
    <div class="tk-row tk-actions">
      <TkButton
        type="primary"
        :disabled="sendDisabled"
        :loading="sending"
        native-type="submit"
        @click="send"
      >
        发送
      </TkButton>
      <TkButton :disabled="sendDisabled" @click="togglePreview">
        {{ isPreviewing ? "编辑" : "预览" }}
      </TkButton>
    </div>
    <div v-if="isPreviewing" class="tk-preview-container">
      <!-- 预览内容经 sanitizeHtml 消毒 -->
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div v-html="previewHtml"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import TkButton from "../components/TkButton.vue";
import TkInput from "./TkInput.vue";
import TkError from "../components/TkError.vue";
import { call, TwikooError, getAppState } from "../utils/api";
import { parseMarkdown } from "../utils/marked";
import { sanitizeHtml } from "../utils/sanitize";
import { logger } from "../utils";

/** 表单字段 */
const nick = ref("");
const mail = ref("");
const link = ref("");
const comment = ref("");

/** 状态 */
const sending = ref(false);
const isPreviewing = ref(false);
const error = ref<TwikooError | undefined>(undefined);

/** 必填字段齐备才可发送 */
const sendDisabled = computed(() => !(comment.value && nick.value));

/** 预览 HTML（marked + sanitize） */
const previewHtml = ref("");

/** 视图刷新回调（发送成功后由父组件传入刷新评论列表） */
const props = defineProps<{
  /** 发送成功后刷新评论列表 */
  onSent?: () => void;
}>();

/**
 * 切换预览（marked 渲染 + 消毒）。
 */
function togglePreview(): void {
  isPreviewing.value = !isPreviewing.value;
  if (isPreviewing.value) {
    previewHtml.value = sanitizeHtml(parseMarkdown(comment.value));
  }
}

/**
 * 发送评论（COMMENT_SUBMIT；参数校验/限流/验证码/垃圾检测在服务端）。
 */
async function send(): Promise<void> {
  error.value = undefined;
  sending.value = true;
  try {
    const { tcb } = getAppState();
    await call(tcb, "COMMENT_SUBMIT", {
      nick: nick.value,
      mail: mail.value,
      link: link.value,
      comment: comment.value,
      href: window.location.href,
      ua: navigator.userAgent,
    });
    // 重置输入
    comment.value = "";
    isPreviewing.value = false;
    props.onSent?.();
  } catch (e) {
    if (e instanceof TwikooError) {
      error.value = e;
    } else {
      logger.error("评论发送失败", e);
      error.value = new TwikooError("UNKNOWN", "评论发送失败");
    }
  } finally {
    sending.value = false;
  }
}
</script>

<style>
.twikoo .tk-submit .tk-row {
  margin-bottom: 8px;
}
.twikoo .tk-meta-input {
  display: flex;
  gap: 8px;
}
.twikoo .tk-preview-container {
  padding: 10px;
  border: 1px dashed #dcdfe6;
  border-radius: 4px;
}
</style>
