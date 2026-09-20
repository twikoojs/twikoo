<!--
  TkPagination 分页控件（1.x TkPagination.vue 的 Vue3 组合式重写）。

  三段式布局：左「共 N 条 + 每页条数」／中页码／右「前往第 N 页」。
  页码生成规则与 1.x 一致（距当前页 <3 显示页码，<4 显示省略号，首页末页恒显示）。
-->
<template>
  <div class="tk-pagination">
    <div v-if="!!pageCount" class="tk-pagination-options">
      <div>
        <span>{{ t("PAGINATION_COUNT_PREFIX") }}</span>
        <span>{{ total }}</span>
        <span>{{ t("PAGINATION_COUNT_SUFFIX") }}</span>
      </div>
      <TkInput
        class="tk-pagination-size"
        type="number"
        :min="1"
        :max="100"
        :model-value="userPageSize ? userPageSize : pageSize"
        @input="handleInputPageSize"
        @change="onPageSizeChange"
      />
      <span>{{ t("PAGINATION_PAGESIZE") }}</span>
    </div>
    <div class="tk-pagination-pagers">
      <div
        v-for="pager in pagers"
        :key="pager.page"
        class="tk-pagination-pager"
        :class="{ __current: pager.page === currentPage }"
        @click="currentChange(pager.page)"
      >
        {{ pager.title }}
      </div>
    </div>
    <div v-if="!!pageCount" class="tk-pagination-options">
      <span>{{ t("PAGINATION_GOTO_PREFIX") }}</span>
      <TkInput
        class="tk-pagination-goto"
        type="number"
        :min="1"
        :max="pageCount"
        :model-value="userInput ? userInput : currentPage"
        @input="handleInput"
        @change="currentChange"
      />
      <span>{{ t("PAGINATION_GOTO_SUFFIX") }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import TkInput from "../components/TkInput.vue";
import { t } from "../utils";

/** 组件属性 */
const props = withDefaults(
  defineProps<{
    /** 每页条数 */
    pageSize?: number;
    /** 总条数 */
    total?: number;
  }>(),
  { pageSize: 10, total: 0 },
);

/** 组件事件 */
const emit = defineEmits<{
  (e: "current-change", page: number): void;
  (e: "page-size-change", pageSize: number): void;
}>();

/** 当前页 */
const currentPage = ref(1);
/** 用户手输的跳转页码（0 表示未输入） */
const userInput = ref(0);
/** 用户手输的每页条数（0 表示未输入） */
const userPageSize = ref(0);
/** 页码列表（含 `...` 占位项） */
const pagers = ref<Array<{ title: string; page: number }>>([]);

/** 总页数 */
const pageCount = computed(() => Math.ceil(props.total / props.pageSize));

/** 按 1.x 规则重新生成页码列表 */
function generatePager(): void {
  const list: Array<{ title: string; page: number }> = [];
  for (let page = 1; page <= pageCount.value; page++) {
    if (Math.abs(currentPage.value - page) < 3 || page === 1 || page === pageCount.value) {
      list.push({ title: `${page}`, page });
    } else if (Math.abs(currentPage.value - page) < 4) {
      list.push({ title: "...", page });
    }
  }
  pagers.value = list;
}

/**
 * 切换页码。
 * @param pageNum 目标页码（字符串或数字）
 */
function currentChange(pageNum: number | string): void {
  currentPage.value = parseInt(String(pageNum), 10) || 1;
  if (currentPage.value > pageCount.value) currentPage.value = pageCount.value;
  if (currentPage.value < 1) currentPage.value = 1;
  userInput.value = 0;
  emit("current-change", currentPage.value);
  generatePager();
}

/**
 * 每页条数变更。
 * @param size 新的每页条数
 */
function onPageSizeChange(size: number | string): void {
  userPageSize.value = 0;
  emit("page-size-change", parseInt(String(size), 10));
}

/**
 * 记录用户输入的跳转页码（不立即跳转，等 change）。
 * @param pageNum 输入值
 */
function handleInput(pageNum: number | string): void {
  userInput.value = parseInt(String(pageNum), 10);
}

/**
 * 记录用户输入的每页条数（不立即生效，等 change）。
 * @param size 输入值
 */
function handleInputPageSize(size: number | string): void {
  userPageSize.value = parseInt(String(size), 10);
}

/**
 * 总数变化后重算页码。
 */
function onTotalChange(): void {
  generatePager();
}

watch(() => props.total, onTotalChange, { immediate: true });
watch(() => props.pageSize, onTotalChange);
</script>

<style>
.twikoo .tk-pagination,
.twikoo .tk-pagination-pagers {
  display: flex;
}
.twikoo .tk-pagination {
  width: 100%;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
}
.twikoo .tk-pagination-options {
  display: flex;
  align-items: center;
}
.twikoo .tk-pagination-pager {
  width: 2em;
  height: 2em;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.twikoo .tk-pagination-pager.__current {
  background-color: #409eff;
  color: #ffffff;
  pointer-events: none;
}
.twikoo .tk-pagination-size,
.twikoo .tk-pagination-goto {
  width: 50px;
  margin: 0 0.5em;
}
.twikoo .tk-pagination .tk-input__inner {
  padding: 0;
  /* 1.x 分页输入框显式压到 28px（比普通输入框矮一档），2.0 需保留同一观感 */
  height: 28px;
  text-align: center;
}
</style>
