<!--
  TkMetaInput 昵称/邮箱/网址输入组（1.x TkMetaInput.vue 的 Vue3 组合式重写）。

  行为保持：`DISPLAYED_FIELDS` 控制显隐、`REQUIRED_FIELDS` 控制必填、localStorage `twikoo`
  持久化、昵称填 QQ 号时自动补全邮箱并拉取 QQ 昵称（Valine 同款交互）、
  `HIDE_ADMIN_CRYPT` 暗号命中时通知父级显示管理入口。
-->
<template>
  <div class="tk-meta-input">
    <TkInput
      v-for="metaInput in displayedInputs"
      :key="metaInput.key"
      class="tk-meta-input__item"
      :name="metaInput.name"
      :type="metaInput.type"
      :model-value="metaData[metaInput.key]"
      :placeholder="
        requiredFields[metaInput.key] ? t('META_INPUT_REQUIRED') : t('META_INPUT_NOT_REQUIRED')
      "
      size="small"
      @input="onMetaInput"
      @change="onMetaChange"
    >
      <template #prepend>{{ metaInput.locale }}</template>
    </TkInput>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, watch } from "vue";
import TkInput from "../components/TkInput.vue";
import { call, isQQ, t } from "../utils";
import {
  EVENT_INIT_META,
  EVENT_SHOW_ADMIN_ENTRY,
  emit as busEmit,
  off as busOff,
  on as busOn,
} from "../utils/bus";
import { EMPTY_CONFIG } from "./defaults";
import type { ServerConfig } from "../types";

/** 邮箱正则（来源：MDN input[type=email] 校验规则，1.x 同源） */
const mailRegExp =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

/** 组件属性（1.x props：父级传入当前值 + 配置） */
const props = withDefaults(
  defineProps<{
    /** 初始昵称 */
    nick?: string;
    /** 初始邮箱 */
    mail?: string;
    /** 初始网址 */
    link?: string;
    /** 服务端配置 */
    config?: ServerConfig;
  }>(),
  { nick: "", mail: "", link: "", config: EMPTY_CONFIG },
);

/** 组件事件（1.x `$emit('update', { meta, valid })` 同名保留） */
const emit = defineEmits<{
  (e: "update", payload: { meta: MetaData; valid: boolean }): void;
}>();

/** 三个 meta 字段的键 */
type MetaKey = "nick" | "mail" | "link";

/** meta 数据（昵称/邮箱/网址） */
interface MetaData {
  nick: string;
  mail: string;
  link: string;
}

/** 输入项定义（含 i18n 标签） */
const metaInputs: Array<{ key: MetaKey; locale: string; name: string; type: string }> = [
  { key: "nick", locale: t("META_INPUT_NICK"), name: "nick", type: "text" },
  { key: "mail", locale: t("META_INPUT_MAIL"), name: "mail", type: "email" },
  { key: "link", locale: t("META_INPUT_LINK"), name: "link", type: "text" },
];

/** 表单数据（本地持有；不直接改 props，1.x 的等价行为） */
const metaData = reactive<MetaData>({ nick: "", mail: "", link: "" });

/** 配置引用（统一入口，避免模板里写 props.config） */
const config = computed<ServerConfig>(() => props.config ?? {});

/** 需要显示的字段（`DISPLAYED_FIELDS` 未配置时全显示） */
const displayedFields = computed(() => {
  const setting = config.value.DISPLAYED_FIELDS;
  const list = typeof setting === "string" ? setting : undefined;
  return {
    nick: list ? list.indexOf("nick") !== -1 : true,
    mail: list ? list.indexOf("mail") !== -1 : true,
    link: list ? list.indexOf("link") !== -1 : true,
  };
});

/** 实际渲染的输入项 */
const displayedInputs = computed(() => metaInputs.filter((i) => !!displayedFields.value[i.key]));

/** 必填字段（`REQUIRED_FIELDS` 未配置时 nick/mail 必填、link 选填） */
const requiredFields = computed(() => {
  const setting = config.value.REQUIRED_FIELDS;
  const list = typeof setting === "string" ? setting : undefined;
  return {
    nick: list ? list.indexOf("nick") !== -1 : true,
    mail: list ? list.indexOf("mail") !== -1 : true,
    link: list ? list.indexOf("link") !== -1 : false,
  };
});

/**
 * 校验表单是否有效（1.x checkValid 对齐）。
 * @returns 是否可提交
 */
function checkValid(): boolean {
  const isValidMail = mailRegExp.test(metaData.mail);
  return (
    (!!metaData.nick || !requiredFields.value.nick) &&
    (isValidMail || !requiredFields.value.mail) &&
    (!!metaData.link || !requiredFields.value.link)
  );
}

/** 持久化并通知父级更新（1.x updateMeta 对齐） */
function updateMeta(): void {
  localStorage.setItem("twikoo", JSON.stringify(metaData));
  emit("update", { meta: { ...metaData }, valid: checkValid() });
}

/**
 * 输入时同步本地表单并静默持久化（不触发 QQ 补全，等 change）。
 *
 * 通过原生 `name` 反查字段名（而非模板内联箭头），避免模板表达式参与 TS 规则检查。
 * @param value 输入值
 * @param evt 原生输入事件
 */
function onMetaInput(value: string, evt: Event): void {
  const key = (evt.target as HTMLInputElement).name as MetaKey;
  if (!key) return;
  metaData[key] = value;
  localStorage.setItem("twikoo", JSON.stringify(metaData));
}

/** 从 localStorage 读取草稿（1.x initMeta 对齐） */
function initMeta(): void {
  const raw = localStorage.getItem("twikoo");
  let saved: Partial<MetaData> = {};
  if (raw) {
    try {
      saved = JSON.parse(raw) as Partial<MetaData>;
    } catch {
      saved = {};
    }
  }
  metaData.nick = saved.nick ?? props.nick ?? "";
  metaData.mail = saved.mail ?? props.mail ?? "";
  metaData.link = saved.link ?? props.link ?? "";
  updateMeta();
}

/** 昵称填 QQ 号时：自动补邮箱并拉取 QQ 昵称（1.x checkQQ 对齐） */
function checkQQ(): void {
  if (!isQQ(metaData.nick)) return;
  const qqNum = metaData.nick.replace(/@qq\.com/gi, "");
  metaData.mail = `${qqNum}@qq.com`;
  void getQQNick(qqNum);
}

/** 昵称未被 QQ API 覆盖时清空，提示用户重新填写（1.x clearNickIfFromQQInput 对齐） */
function clearNickIfFromQQInput(): void {
  if (isQQ(metaData.nick)) {
    metaData.nick = "";
    updateMeta();
  }
}

/**
 * 拉取 QQ 昵称（失败/无结果时清空昵称）。
 * @param qqNum QQ 号
 */
async function getQQNick(qqNum: string): Promise<void> {
  try {
    const res = await call(null, "GET_QQ_NICK", { qq: qqNum });
    const payload = (res.result ?? res) as { nick?: string };
    if (payload.nick) {
      metaData.nick = payload.nick;
      updateMeta();
    } else {
      clearNickIfFromQQInput();
    }
  } catch (e) {
    console.warn("获取 QQ 昵称失败：", e);
    clearNickIfFromQQInput();
  }
}

/** 按 `HIDE_ADMIN_CRYPT` 判定是否显示管理入口（1.x checkAdminCrypt 等价物，走事件总线） */
function checkAdminCrypt(): void {
  const crypt = config.value.HIDE_ADMIN_CRYPT;
  busEmit(EVENT_SHOW_ADMIN_ENTRY, crypt ? crypt === metaData.nick : true);
}

/** meta 变更后的统一处理（1.x onMetaChange 对齐） */
function onMetaChange(): void {
  checkQQ();
  updateMeta();
  checkAdminCrypt();
}

/** 父级回填 meta（管理面板写入 localStorage 后经 props 同步） */
function syncFromProps(): void {
  if (props.nick !== undefined && metaData.nick !== props.nick) metaData.nick = props.nick;
  if (props.mail !== undefined && metaData.mail !== props.mail) metaData.mail = props.mail;
  if (props.link !== undefined && metaData.link !== props.link) metaData.link = props.link;
}

watch(() => [props.nick, props.mail, props.link], syncFromProps);

watch(requiredFields, () => {
  emit("update", { meta: { ...metaData }, valid: checkValid() });
});

watch(
  () => config.value.VERSION,
  () => {
    checkAdminCrypt();
  },
);

onMounted(() => {
  busOn(EVENT_INIT_META, initMeta);
  initMeta();
});

onUnmounted(() => {
  busOff(EVENT_INIT_META, initMeta);
});
</script>

<style>
.twikoo .tk-meta-input {
  display: flex;
}
.twikoo .tk-meta-input .tk-input {
  width: auto;
  width: calc((100% - 1rem) / 3); /* Fix Safari */
  flex: 1;
}
.twikoo .tk-meta-input .tk-input + .tk-input {
  margin-left: 0.5rem;
}
.twikoo .tk-meta-input .tk-input-group__prepend {
  padding: 0 1rem;
}
@media screen and (max-width: 767px) {
  .twikoo .tk-meta-input {
    flex-direction: column;
  }
  .twikoo .tk-meta-input .tk-input {
    width: auto;
  }
  .twikoo .tk-meta-input .tk-input + .tk-input {
    margin-left: 0;
    margin-top: 0.5rem;
  }
}
</style>
