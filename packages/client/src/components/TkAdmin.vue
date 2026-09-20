<!--
  TkAdmin 管理面板容器（1.x TkAdmin.vue 的 Vue3 组合式重写）。

  职责：登录/首次设置密码、登录态检查、四个页签（评论/配置/导入/导出）分发。
  HTTP 形态（无 tcb）用 `twikoo-access-token` 承载登录态；云开发形态用自定义登录票据。
-->
<template>
  <div class="tk-admin-container">
    <div v-loading="loading" class="tk-admin" :class="{ __show: show }">
      <button class="tk-admin-close" @click="onClose">
        <TkIcon name="times" />
      </button>
      <div v-if="needUpdate" class="tk-login-title">
        <div>{{ t("ADMIN_NEED_UPDATE") }}</div>
        <a href="https://twikoo.js.org/update.html" target="_blank" rel="noopener noreferrer">
          https://twikoo.js.org/update.html
        </a>
      </div>
      <div v-else>
        <div v-if="!isLogin && isSetPassword" class="tk-login">
          <div class="tk-login-title">{{ t("ADMIN_LOGIN_TITLE") }}</div>
          <form>
            <input type="hidden" />
            <TkInput
              ref="focusmeRef"
              v-model="password"
              class="tk-password"
              type="password"
              show-password
              :placeholder="t('ADMIN_PASSWORD_PLACEHOLDER')"
              @keyup.enter="onLogin"
            >
              <template #prepend>{{ t("ADMIN_PASSWORD") }}</template>
              <template #append>
                <TkButton @click="onLogin">{{ t("ADMIN_LOGIN") }}</TkButton>
              </template>
            </TkInput>
          </form>
          <div v-if="loginErrorMessage" class="tk-login-msg">
            {{ loginErrorMessage }}
            <a href="https://twikoo.js.org/faq.html" rel="noopener noreferrer" target="_blank">
              {{ t("ADMIN_FORGOT") }}
            </a>
          </div>
        </div>
        <div v-if="!isLogin && !isSetPassword" class="tk-regist">
          <div class="tk-login-title">{{ t("ADMIN_LOGIN_TITLE") }}</div>
          <form>
            <TkInput
              v-if="!isSetCredentials"
              ref="focusmeRef"
              v-model="credentials"
              class="tk-password"
              :placeholder="t('ADMIN_CREDENTIALS_PLACEHOLDER')"
            >
              <template #prepend>{{ t("ADMIN_CREDENTIALS") }}</template>
            </TkInput>
            <TkInput
              v-model="password"
              class="tk-password"
              type="password"
              show-password
              :placeholder="t('ADMIN_SET_PASSWORD_PLACEHOLDER')"
            >
              <template #prepend>{{ t("ADMIN_SET_PASSWORD") }}</template>
            </TkInput>
            <TkInput
              v-model="passwordConfirm"
              class="tk-password"
              type="password"
              show-password
              :placeholder="t('ADMIN_SET_PASSWORD_CONFIRM_PLACEHOLDER')"
            >
              <template #prepend>{{ t("ADMIN_SET_PASSWORD_CONFIRM") }}</template>
            </TkInput>
          </form>
          <TkButton class="tk-regist-button" :disabled="!canRegist" @click="onRegist">
            {{ t("ADMIN_REGIST") }}
          </TkButton>
          <div v-if="loginErrorMessage" class="tk-login-msg">{{ loginErrorMessage }}</div>
          <div v-if="!isSetCredentials" class="tk-login-msg">
            <a href="https://twikoo.js.org/faq.html" rel="noopener noreferrer" target="_blank">
              {{ t("ADMIN_CREDENTIALS_FAQ") }}
            </a>
          </div>
        </div>
        <div v-if="isLogin" class="tk-panel">
          <div class="tk-panel-title">
            <div>{{ t("ADMIN_TITLE") }}</div>
            <a class="tk-panel-logout" href="#" @click.prevent="onLogout">{{
              t("ADMIN_LOGOUT")
            }}</a>
          </div>
          <div class="tk-tabs">
            <div
              class="tk-tab"
              :class="{ __active: activeTabName === 'comment' }"
              @click="activeTabName = 'comment'"
            >
              {{ t("ADMIN_COMMENT") }}
            </div>
            <div
              class="tk-tab"
              :class="{ __active: activeTabName === 'config' }"
              @click="activeTabName = 'config'"
            >
              {{ t("ADMIN_CONFIG") }}
            </div>
            <div
              class="tk-tab"
              :class="{ __active: activeTabName === 'import' }"
              @click="activeTabName = 'import'"
            >
              {{ t("ADMIN_IMPORT") }}
            </div>
            <div
              class="tk-tab"
              :class="{ __active: activeTabName === 'export' }"
              @click="activeTabName = 'export'"
            >
              {{ t("ADMIN_EXPORT") }}
            </div>
          </div>
          <TkAdminComment v-show="activeTabName === 'comment'" />
          <TkAdminConfig v-show="activeTabName === 'config'" />
          <TkAdminImport v-show="activeTabName === 'import'" />
          <TkAdminExport v-show="activeTabName === 'export'" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import md5 from "blueimp-md5";
import TkAdminComment from "./TkAdminComment.vue";
import TkAdminConfig from "./TkAdminConfig.vue";
import TkAdminImport from "./TkAdminImport.vue";
import TkAdminExport from "./TkAdminExport.vue";
import TkButton from "../components/TkButton.vue";
import TkInput from "../components/TkInput.vue";
import TkIcon from "../components/TkIcon.vue";
import { logger, t } from "../utils";
import { call, getAppState } from "../utils/api";
import { vLoading } from "../utils/directives";

/** 组件属性 */
const props = withDefaults(
  defineProps<{
    /** 是否显示面板 */
    show?: boolean;
  }>(),
  { show: false },
);

/** 组件事件（1.x `$emit('close')`） */
const emit = defineEmits<{ (e: "close"): void }>();

/** 请求进行中 */
const loading = ref(true);
/** 服务端版本（`GET_PASSWORD_STATUS` 回传） */
const version = ref("");
/** 服务端版本过低需要更新 */
const needUpdate = ref(false);
/** 是否已登录 */
const isLogin = ref(false);
/** 是否已设置密码 */
const isSetPassword = ref(true);
/** HTTP 形态下是否需要填「凭证」（即非云开发形态） */
const isSetCredentials = ref(false);
/** 凭证（HTTP 形态首次设置密码时的额外口令） */
const credentials = ref("");
/** 密码 */
const password = ref("");
/** 确认密码 */
const passwordConfirm = ref("");
/** 登录/注册错误文案 */
const loginErrorMessage = ref("");
/** 当前页签 */
const activeTabName = ref("comment");
/** 密码输入框引用（聚焦用） */
const focusmeRef = ref<{ focus(): void }>();

/** 是否可提交注册 */
const canRegist = computed(
  () =>
    !isSetPassword.value &&
    !!password.value &&
    password.value === passwordConfirm.value &&
    (isSetCredentials.value || !!credentials.value),
);

/** 登录（1.x onLogin 对齐：密码 md5 后走 LOGIN 事件） */
async function onLogin(): Promise<void> {
  if (!password.value) {
    loginErrorMessage.value = t("ADMIN_PASSWORD_REQUIRED");
    return;
  }
  loading.value = true;
  loginErrorMessage.value = "";
  const passwordMd5 = md5(password.value);
  const tcb = getAppState().tcb;
  const res = await call(tcb, "LOGIN", { password: passwordMd5 });
  const result = (res.result ?? res) as { message?: string; ticket?: string; code?: number };
  if (result.message) {
    loginErrorMessage.value = result.message;
  } else if (result.ticket) {
    try {
      await tcb?.auth?.customAuthProvider().signIn(result.ticket);
      logger.info("登录成功");
      password.value = "";
      await checkAuth();
    } catch (err) {
      logger.error("登录失败", err);
    }
  } else if (result.code === 0) {
    logger.info("登录成功");
    localStorage.setItem("twikoo-access-token", passwordMd5);
    password.value = "";
    await checkAuth();
  }
  loading.value = false;
}

/**
 * 登出（1.x onLogout 对齐：云开发签出后补匿名登录，HTTP 形态清 token）。
 * @param evt 点击事件
 */
async function onLogout(evt: Event): Promise<void> {
  evt.preventDefault();
  loading.value = true;
  const tcb = getAppState().tcb;
  if (tcb?.auth) {
    await tcb.auth.signOut();
    await tcb.auth.anonymousAuthProvider().signIn();
  } else {
    localStorage.removeItem("twikoo-access-token");
  }
  isLogin.value = false;
  loading.value = false;
}

/** 首次设置密码并自动登录（1.x onRegist 对齐） */
async function onRegist(): Promise<void> {
  loading.value = true;
  const passwordMd5 = md5(password.value);
  const res = await call(getAppState().tcb, "SET_PASSWORD", {
    password: passwordMd5,
    credentials: credentials.value,
  });
  const result = (res.result ?? res) as { code?: number; message?: string };
  if (!result.code) {
    isSetPassword.value = true;
    await onLogin();
  } else {
    loginErrorMessage.value = t("ADMIN_REGIST_FAILED");
    if (result.message) loginErrorMessage.value += `，${result.message}`;
    logger.warn("Twikoo 注册失败", res);
  }
  loading.value = false;
}

/** 面板显示时的初始化（1.x onShow 对齐） */
async function onShow(): Promise<void> {
  loading.value = true;
  await checkAuth();
  if (!isLogin.value) {
    await checkIfPasswordSet();
    focusPassword();
  }
  loading.value = false;
}

/** 聚焦密码输入框（1.x focusPassword 对齐：延迟等待面板动画） */
function focusPassword(): void {
  setTimeout(() => focusmeRef.value?.focus(), 500);
}

/** 检查登录态（1.x checkAuth 对齐） */
async function checkAuth(): Promise<void> {
  const tcb = getAppState().tcb;
  if (tcb?.auth) {
    const currentUser = await tcb.auth.getCurrentUser();
    isLogin.value = currentUser.loginType === "CUSTOM";
  } else {
    const res = await call(tcb, "GET_CONFIG");
    const result = (res.result ?? res) as { config?: { IS_ADMIN?: boolean } };
    isLogin.value = result?.config?.IS_ADMIN === true;
  }
}

/** 检查服务端是否已设置密码（1.x checkIfPasswordSet 对齐） */
async function checkIfPasswordSet(): Promise<void> {
  try {
    const res = await call(getAppState().tcb, "GET_PASSWORD_STATUS");
    const result = (res.result ?? res) as { version?: string; status?: boolean };
    version.value = result.version ?? "";
    isSetPassword.value = result.status === true;
    isSetCredentials.value = !getAppState().tcb;
  } catch (e) {
    // 老版本服务端无此事件：提示更新（1.x 行为）
    needUpdate.value = true;
    loading.value = false;
    throw e;
  }
}

/** 关闭面板（1.x onClose 对齐） */
function onClose(): void {
  emit("close");
}

watch(
  () => props.show,
  (value) => {
    if (value) void onShow();
  },
);
</script>

<style>
.twikoo .tk-admin-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  pointer-events: none;
}
.twikoo .tk-admin {
  position: absolute;
  top: 0;
  left: 100%;
  width: 100%;
  height: 100%;
  overflow-y: auto;
  pointer-events: all;
  color: #ffffff;
  background-color: rgba(0, 0, 0, 0.85);
  -webkit-backdrop-filter: blur(5px);
  backdrop-filter: blur(5px);
  transition: all 0.5s ease;
  visibility: hidden;
}
.twikoo .tk-admin::-webkit-scrollbar {
  width: 5px;
  background-color: transparent;
}
.twikoo .tk-admin::-webkit-scrollbar-track {
  background-color: transparent;
}
.twikoo .tk-admin::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.31);
}
.twikoo .tk-admin.__show {
  left: 0;
  visibility: visible;
}
.twikoo .tk-admin-close {
  appearance: none;
  background: none;
  border: none;
  margin: 0;
  text-decoration: none;
  cursor: pointer;
  position: sticky;
  display: block;
  top: 1rem;
  left: calc(100% - 3rem);
  width: 1rem;
  height: 1rem;
  padding: 1rem;
  box-sizing: content-box;
  color: #ffffff;
  line-height: 0;
}
.twikoo .tk-login,
.twikoo .tk-regist {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  padding: 0 2rem;
  box-sizing: border-box;
}
.twikoo .tk-login-title {
  color: #ffffff;
  font-size: 1.25rem;
  text-align: center;
  margin-top: 10rem;
}
.twikoo .tk-password,
.twikoo .tk-login-msg {
  color: #ffffff;
  width: 80%;
  text-align: center;
  margin-top: 1rem;
}
.twikoo .tk-password .tk-input__inner {
  min-width: 100px;
}
.twikoo .tk-password .tk-input-group__prepend {
  color: #ffffff;
}
.twikoo .tk-login-msg a {
  color: #ffffff;
  margin-left: 1em;
  text-decoration: underline;
}
.twikoo .tk-regist-button {
  margin-top: 1rem;
}
.twikoo .tk-panel {
  color: #ffffff;
  padding: 2rem;
}
.twikoo .tk-panel-title {
  font-size: 1.5rem;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
}
.twikoo .tk-panel-logout {
  color: #ffffff;
  font-size: 1rem;
  text-decoration: underline;
}
.twikoo .tk-panel .tk-tabs {
  display: flex;
  margin-bottom: 1em;
  border-bottom: 2px solid #c0c4cc;
}
.twikoo .tk-panel .tk-tab {
  color: #c0c4cc;
  cursor: pointer;
  line-height: 2em;
  margin-right: 2em;
  margin-bottom: -2px;
}
.twikoo .tk-panel .tk-tab.__active {
  color: #ffffff;
  border-bottom: 2px solid #ffffff;
}
.twikoo .tk-admin-warn {
  padding: 1rem 1.5rem;
  background-color: #fff7d0;
  border-left: 0.5rem solid #e7c000;
  color: #6b5900;
  align-self: stretch;
  box-sizing: border-box;
}
</style>
