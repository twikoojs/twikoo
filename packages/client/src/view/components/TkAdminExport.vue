<!--
  TkAdminExport 数据导出页签（1.x TkAdminExport.vue 的 Vue3 组合式重写）。

  通过 `COMMENT_EXPORT_FOR_ADMIN` 取回 JSON 并在浏览器端另存为文件（不经过任何中转）。
-->
<template>
  <div class="tk-admin-export">
    <div class="tk-admin-warn tk-admin-import-warn">
      <p>{{ t("ADMIN_EXPORT_WARN") }}</p>
    </div>
    <TkButton size="small" :disabled="loading" @click="doExport('comment')">
      {{ t("ADMIN_EXPORT_COMMENT") }}
    </TkButton>
    <TkButton size="small" :disabled="loading" @click="doExport('counter')">
      {{ t("ADMIN_EXPORT_COUNTER") }}
    </TkButton>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import TkButton from "../../components/TkButton.vue";
import { call, t } from "../../utils";
import { getAppState } from "../../utils/api";

/** 导出进行中 */
const loading = ref(false);

/**
 * 导出指定集合（评论 / 访问量）。
 * @param collection 集合名
 */
async function doExport(collection: string): Promise<void> {
  loading.value = true;
  try {
    const res = await call(getAppState().tcb, "COMMENT_EXPORT_FOR_ADMIN", { collection });
    const result = (res.result ?? res) as { data?: unknown };
    if (result.data) downloadJson(`twikoo-${collection}.json`, result.data);
  } finally {
    loading.value = false;
  }
}

/**
 * 浏览器端另存 JSON（1.x downloadJson 对齐）。
 * @param fileName 文件名
 * @param json 数据
 */
function downloadJson(fileName: string, json: unknown): void {
  const jsonStr = json instanceof Object ? JSON.stringify(json, null, 2) : String(json);
  const blob = new Blob([jsonStr]);
  const saveLink = document.createElementNS("http://www.w3.org/1999/xhtml", "a");
  saveLink.href = URL.createObjectURL(blob);
  saveLink.download = fileName;
  saveLink.click();
}
</script>
