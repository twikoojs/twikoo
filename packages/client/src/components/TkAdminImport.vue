<!--
  TkAdminImport 数据导入页签（1.x TkAdminImport.vue 的 Vue3 组合式重写）。

  两条通路（1.x 行为）：
  - 云开发形态：先把文件传到云存储，再把 fileID 交给 `COMMENT_IMPORT_FOR_ADMIN`；
  - HTTP 形态（vercel / self-hosted）：浏览器读文本后直接随事件提交。
  导入过程逐行写入日志框（自动滚到底）。
-->
<template>
  <div class="tk-admin-import">
    <div class="tk-admin-warn tk-admin-import-warn">
      <p>{{ t("ADMIN_IMPORT_WARN") }}</p>
      <p>{{ warnText[source] }}</p>
    </div>
    <div class="tk-admin-import-label">{{ t("ADMIN_IMPORT_SELECT_SOURCE") }}</div>
    <select v-model="source">
      <option disabled value="">{{ t("ADMIN_IMPORT_SELECT") }}</option>
      <option value="valine">Valine (JSON)</option>
      <option value="disqus">Disqus (XML)</option>
      <option value="artalk">Artalk v1 (JSON)</option>
      <option value="artalk2">Artalk v2 (Artrans)</option>
      <option value="twikoo">Twikoo (JSON)</option>
    </select>
    <div class="tk-admin-import-label">{{ t("ADMIN_IMPORT_SELECT_FILE") }}</div>
    <input ref="inputFileRef" type="file" value="" />
    <TkButton size="small" :disabled="loading" @click="uploadFile">
      {{ t("ADMIN_IMPORT_START") }}
    </TkButton>
    <TkInput
      ref="logTextAreaRef"
      v-model="logText"
      type="textarea"
      :rows="10"
      readonly
      :placeholder="t('ADMIN_IMPORT_LOG')"
    />
  </div>
</template>

<script setup lang="ts">
import { nextTick, reactive, ref } from "vue";
import TkButton from "../components/TkButton.vue";
import TkInput from "../components/TkInput.vue";
import { call, readAsText, t } from "../utils";
import { getAppState } from "../utils/api";

/** 导入进行中 */
const loading = ref(false);
/** 导入来源 */
const source = ref("");
/** 日志文本 */
const logText = ref("");
/** 各来源的提示文案（1.x warnText 同表） */
const warnText = reactive<Record<string, string>>({
  valine: t("ADMIN_IMPORT_TIP_VALINE"),
  disqus: t("ADMIN_IMPORT_TIP_DISQUS"),
  artalk: t("ADMIN_IMPORT_TIP_ARTALK"),
  artalk2: "",
  twikoo: "",
});
/** 文件选择框引用 */
const inputFileRef = ref<HTMLInputElement>();
/** 日志输入框引用（滚动到底用） */
const logTextAreaRef = ref<{ inputEl?: HTMLInputElement | HTMLTextAreaElement }>();

/**
 * 追加一行日志并滚动到底（1.x log 对齐）。
 * @param message 日志内容
 */
function log(message: string): void {
  logText.value += `${new Date().toLocaleString()} ${message}\n`;
  void nextTick(() => {
    const el = logTextAreaRef.value?.inputEl;
    if (el) el.scrollTop = el.scrollHeight;
  });
}

/**
 * 开始导入（1.x uploadFile 对齐）。
 */
async function uploadFile(): Promise<void> {
  if (!source.value) {
    log(t("ADMIN_IMPORT_SOURCE_REQUIRED"));
    return;
  }
  const filePath = inputFileRef.value?.files?.[0];
  if (!filePath) {
    log(t("ADMIN_IMPORT_FILE_REQUIRED"));
    return;
  }
  log(t("ADMIN_IMPORT_START"));
  loading.value = true;
  try {
    const tcb = getAppState().tcb;
    if (tcb) {
      const app = tcb.app as unknown as {
        uploadFile(params: {
          cloudPath: string;
          filePath: File;
          onUploadProgress?: (evt: { loaded: number; total: number }) => void;
        }): Promise<{ fileID?: string }>;
      };
      const result = await app.uploadFile({
        cloudPath: `import/${Date.now()}`,
        filePath,
        /**
         * 上传进度回调：把百分比写入日志框。
         * @param progressEvent 上传进度事件
         */
        onUploadProgress: (progressEvent) => {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          log(`${t("ADMIN_IMPORT_UPLOADING")}${percent}%`);
        },
      });
      log(`${t("ADMIN_IMPORT_UPLOADED")}${result.fileID}`);
      await importFile(String(result.fileID));
    } else {
      await importFileToVercel(filePath);
    }
  } catch (e) {
    console.error(e);
    log((e as Error).message);
  }
  loading.value = false;
}

/**
 * 云开发通路：按 fileId 导入（1.x importFile 对齐）。
 * @param fileID 云存储文件 ID
 */
async function importFile(fileID: string): Promise<void> {
  log(`${t("ADMIN_IMPORT_IMPORTING")}${source.value}`);
  const res = await call(getAppState().tcb, "COMMENT_IMPORT_FOR_ADMIN", {
    fileId: fileID,
    source: source.value,
  });
  const result = (res.result ?? res) as { log?: string };
  logText.value += result.log ?? "";
  log(`${t("ADMIN_IMPORT_IMPORTED")}${source.value}`);
}

/**
 * HTTP 通路：读文本后随事件提交（1.x importFileToVercel 对齐）。
 * @param filePath 本地文件
 */
async function importFileToVercel(filePath: File): Promise<void> {
  log(`${t("ADMIN_IMPORT_IMPORTING")}${source.value}`);
  const res = await call(getAppState().tcb, "COMMENT_IMPORT_FOR_ADMIN", {
    file: await readAsText(filePath),
    source: source.value,
  });
  const result = (res.result ?? res) as { log?: string };
  logText.value += result.log ?? "";
  log(`${t("ADMIN_IMPORT_IMPORTED")}${source.value}`);
}
</script>

<style>
.twikoo .tk-admin-import {
  display: flex;
  flex-direction: column;
}
.twikoo .tk-admin-import-label {
  margin-top: 1em;
  font-size: 1.25rem;
  font-weight: bold;
}
.twikoo .tk-admin-import select,
.twikoo .tk-admin-import input,
.twikoo .tk-admin-import .tk-button,
.twikoo .tk-admin-import .tk-input {
  margin-top: 1em;
}
.twikoo .tk-admin-import select {
  height: 32px;
  padding: 0 0.5em;
  color: #ffffff;
  background-color: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(144, 147, 153, 0.31);
  border-radius: 4px;
}
.twikoo .tk-admin-import select option {
  color: initial;
}
</style>
