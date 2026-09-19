<!--
  TkError 错误卡片（普通访客内联错误卡片——图标 + 标题 + 一行说明 +
  可折叠详情；全部 tk- 类名；组合式 API）。
-->
<template>
  <div class="tk-error">
    <div class="tk-error__icon">
      <TkIcon name="circle-exclamation" />
    </div>
    <div class="tk-error__body">
      <div class="tk-error__title">{{ title }}</div>
      <div class="tk-error__message">{{ message }}</div>
      <button class="tk-error__toggle" type="button" @click="expanded = !expanded">
        {{ expanded ? "收起详情" : "展开详情" }}
      </button>
      <div v-show="expanded" class="tk-error__detail">
        <div v-if="httpStatus" class="tk-error__row">HTTP: {{ httpStatus }}</div>
        <div v-if="requestId" class="tk-error__row">Request ID: {{ requestId }}</div>
        <pre v-if="detail" class="tk-error__raw">{{ detail }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import TkIcon from "./TkIcon.vue";
import type { TwikooError } from "../utils/api";

const props = defineProps<{
  /** 统一错误对象（TwikooError） */
  error: TwikooError;
}>();

/** 详情展开态（缺省收起） */
const expanded = ref(false);

/** 标题（按 kind 映射，场景表）*/
const KIND_TITLES: Record<string, string> = {
  NETWORK: "无法连接到后端",
  CORS: "请求被跨域策略拦截",
  TIMEOUT: "请求超时",
  REJECTED: "请求过于频繁",
  NOT_FOUND: "接口地址不存在",
  CLIENT_ERROR: "请求失败",
  SERVER_ERROR: "后端异常",
  UNKNOWN: "出现未知错误",
};

/** 卡片标题 */
const title = computed(() => KIND_TITLES[props.error.kind] ?? "出现错误");

/** 一行说明（rawMessage 截断） */
const message = computed(() => {
  const raw = props.error.rawMessage || props.error.message;
  return raw.length > 120 ? `${raw.slice(0, 120)}...` : raw;
});

/** 详情（后端日志 / 原始响应片段） */
const detail = computed(() => props.error.logText || props.error.rawMessage || "");

/** HTTP 状态码 */
const httpStatus = computed(() => props.error.httpStatus);

/** 请求 ID */
const requestId = computed(() => props.error.requestId);
</script>

<style>
.twikoo .tk-error {
  display: flex;
  gap: 8px;
  padding: 12px;
  border: 1px solid #fbc4c4;
  background: #fef0f0;
  border-radius: 4px;
  color: #f56c6c;
}
.twikoo .tk-error__icon svg {
  width: 20px;
  height: 20px;
}
.twikoo .tk-error__title {
  font-weight: 600;
}
.twikoo .tk-error__toggle {
  border: none;
  background: none;
  color: #909399;
  cursor: pointer;
  font-size: 0.75rem;
  padding: 0;
  margin-top: 4px;
}
.twikoo .tk-error__detail {
  margin-top: 6px;
  font-size: 0.75rem;
  color: #909399;
  word-break: break-all;
}
.twikoo .tk-error__raw {
  white-space: pre-wrap;
  margin: 4px 0 0;
}
</style>
