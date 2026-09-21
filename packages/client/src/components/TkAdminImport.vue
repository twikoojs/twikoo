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
    <div class="tk-admin-import-label">{{ t("ADMIN_CONFIG_IMPORT_MODE") }}</div>
    <select v-model="importMode">
      <option value="overwrite">{{ t("ADMIN_CONFIG_IMPORT_MODE_OVERWRITE") }}</option>
      <option value="skip">{{ t("ADMIN_CONFIG_IMPORT_MODE_SKIP") }}</option>
    </select>
    <div class="tk-admin-import-actions">
      <TkButton size="small" :disabled="loading" @click="uploadFile">
        {{ t("ADMIN_IMPORT_COMMENT") }}
      </TkButton>
      <TkButton size="small" :disabled="loading" @click="importConfig">
        {{ t("ADMIN_CONFIG_IMPORT") }}
      </TkButton>
    </div>
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
import { EVENT_CONFIG_UPDATED, emit as busEmit } from "../utils/bus";

/** 导入进行中 */
const loading = ref(false);
/** 导入来源 */
const source = ref("");
/** 日志文本 */
const logText = ref("");
/** 配置导入方式（overwrite 覆盖已有配置项 / skip 跳过已存在的配置项） */
const importMode = ref<"overwrite" | "skip">("overwrite");
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

/**
 * 校验配置导入内容：必须是普通对象，且值只能是字符串/数字/布尔。
 *
 * 与服务端 `ConfigData` 一致——越界的值落库后会影响下游配置比较。
 * @param value 待校验值
 * @returns 是否符合配置形态
 */
function isPlainConfig(value: unknown): value is Record<string, string | number | boolean> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value).every(
    (item) => typeof item === "string" || typeof item === "number" || typeof item === "boolean",
  );
}

/**
 * 导入配置（复用 SET_CONFIG 的合并语义，不新增事件）。
 *
 * 覆盖 = 直接提交导入项（同键覆盖）；跳过 = 只提交当前配置里缺失的键。
 * 配置只可能来自 Twikoo 的导出文件，来源选错时提示并中止。
 */
async function importConfig(): Promise<void> {
  if (source.value !== "twikoo") {
    alert(t("ADMIN_CONFIG_IMPORT_SOURCE_ALERT"));
    return;
  }
  const file = inputFileRef.value?.files?.[0];
  if (!file) {
    log(t("ADMIN_IMPORT_FILE_REQUIRED"));
    return;
  }
  loading.value = true;
  try {
    const parsed: unknown = JSON.parse(await readAsText(file));
    if (!isPlainConfig(parsed)) {
      log(t("ADMIN_CONFIG_IMPORT_INVALID"));
      return;
    }
    // 导出文件不含 CREDENTIALS，手工构造的文件可能带上：摘掉以免覆盖本机凭证
    const imported = { ...parsed };
    delete imported.CREDENTIALS;
    let payload = imported;
    if (importMode.value === "skip") {
      const current = await readCurrentConfig();
      payload = Object.fromEntries(
        Object.entries(imported).filter(([key]) => current[key] === undefined),
      );
    }
    log(t("ADMIN_CONFIG_IMPORTING"));
    const res = await call(getAppState().tcb, "SET_CONFIG", { config: payload });
    const result = (res.result ?? res) as { code?: number; message?: unknown };
    if (result.code === 0) {
      busEmit(EVENT_CONFIG_UPDATED);
      log(t("ADMIN_CONFIG_IMPORTED"));
    } else {
      const detail = typeof result.message === "string" ? result.message : "";
      log(`${t("ADMIN_CONFIG_IMPORT_FAILED")}${detail}`);
    }
  } catch (e) {
    console.error(e);
    log(`${t("ADMIN_CONFIG_IMPORT_FAILED")}${(e as Error).message}`);
  }
  loading.value = false;
}

/**
 * 读取当前配置（跳过模式下用于判断哪些键已存在）。
 * @returns 当前配置（读取失败时返回空对象，等价于全部按「缺失」处理）
 */
async function readCurrentConfig(): Promise<Record<string, unknown>> {
  const res = await call(getAppState().tcb, "GET_CONFIG_FOR_ADMIN", {});
  const result = (res.result ?? res) as { config?: Record<string, unknown> };
  return result.config ?? {};
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
.twikoo .tk-admin-import-actions {
  display: flex;
  gap: 1em;
}
.twikoo .tk-admin-import-actions .tk-button {
  flex: 1;
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
