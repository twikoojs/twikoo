<!--
  TkAdminConfig 配置管理页签（1.x TkAdminConfig.vue 的 Vue3 组合式重写）。

  分组表单（通用/插件/隐私/反垃圾/人机验证/即时消息/邮件）+ 邮件测试 + 保存/重置。
  保存时只提交「与当前服务端值不同」的配置项（1.x 行为，减少无效写入）。
-->
<template>
  <div v-loading="loading" class="tk-admin-config">
    <div v-if="clientVersion !== serverVersion" class="tk-admin-warn">
      <span>{{ t("ADMIN_CLIENT_VERSION") }}{{ clientVersion }}，</span>
      <span>{{ t("ADMIN_SERVER_VERSION") }}{{ serverVersion }}，</span>
      <!--
        用 prettier-ignore 保持单行：这一段的换行/缩进空白会被 Vue 3 的 condense 折叠成
        一个空格（Vue 2 保留、HTML 同样折叠），与两侧的 &nbsp; 叠加后会让「版本更新」
        链接左右各宽约一个空格，而 1.x 只有 &nbsp;。所以必须让 &nbsp; 与 <a> 紧贴。
      -->
      <!-- prettier-ignore -->
      <span>请参考&nbsp;<a href="https://twikoo.js.org/update.html" target="_blank" rel="noopener noreferrer">版本更新</a>&nbsp;进行升级</span>
    </div>
    <form @submit.prevent="saveConfig">
      <div class="tk-admin-config-groups">
        <details
          v-for="settingGroup in settings"
          :key="settingGroup.name"
          class="tk-admin-config-group"
        >
          <summary class="tk-admin-config-group-title">{{ settingGroup.name }}</summary>
          <div
            v-for="setting in settingGroup.items"
            v-show="showSetting(setting)"
            :key="setting.key"
            class="tk-admin-config-item"
          >
            <div class="tk-admin-config-title" :title="setting.key">{{ setting.key }}</div>
            <div class="tk-admin-config-input">
              <select v-if="setting.options" v-model="setting.value" class="tk-admin-config-select">
                <option v-for="opt in setting.options" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
              <TkInput
                v-else-if="setting.type === 'textarea'"
                v-model="setting.value"
                type="textarea"
                :rows="5"
                size="small"
                :placeholder="setting.ph"
              />
              <TkInput
                v-else
                v-model="setting.value"
                :type="setting.secret ? 'password' : 'text'"
                size="small"
                :placeholder="setting.ph"
              />
            </div>
            <div></div>
            <div class="tk-admin-config-desc">{{ setting.desc }}</div>
          </div>
        </details>
        <details class="tk-admin-config-group">
          <summary class="tk-admin-config-group-title">{{ t("ADMIN_CONFIG_EMAIL_TEST") }}</summary>
          <div class="tk-admin-config-email-test">
            <div class="tk-admin-config-email-test-desc">
              {{ t("ADMIN_CONFIG_EMAIL_TEST_HELP") }}
            </div>
            <div class="tk-admin-config-input">
              <TkInput v-model="emailTestAddress" size="small">
                <template #append>
                  <TkButton type="info" @click="testEmail">
                    {{ t("ADMIN_CONFIG_EMAIL_TEST_BTN") }}
                  </TkButton>
                </template>
              </TkInput>
            </div>
            <div class="tk-admin-config-email-test-desc">
              {{ t("ADMIN_CONFIG_EMAIL_TEST_RESULT") }}{{ emailTestResult }}
            </div>
          </div>
        </details>
      </div>
      <div class="tk-admin-config-actions">
        <TkButton size="small" type="primary" native-type="submit">
          {{ t("ADMIN_CONFIG_SAVE") }}
        </TkButton>
        <TkButton size="small" type="info" @click="resetConfig">
          {{ t("ADMIN_CONFIG_RESET") }}
        </TkButton>
      </div>
    </form>
    <div class="tk-admin-config-message">{{ message }}</div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from "vue";
import { VERSION } from "@twikoojs/shared";
import TkButton from "../components/TkButton.vue";
import TkInput from "../components/TkInput.vue";
import { call, logger, t } from "../utils";
import { getAppState } from "../utils/api";
import { EVENT_CONFIG_UPDATED, emit as busEmit, off as busOff, on as busOn } from "../utils/bus";
import { vLoading } from "../utils/directives";
import { customImageBedServices } from "../i18n/constants";
import type { ServerConfig } from "../types";

/** 配置项定义（1.x settings 表的项结构） */
interface SettingItem {
  /** 配置键 */
  key: string;
  /** 说明文案 */
  desc: string;
  /** 输入框占位提示 */
  ph: string;
  /** 当前值 */
  value: string;
  /** 下拉选项（存在则渲染 select） */
  options?: Array<{ value: string; label: string }>;
  /** 特殊输入形态 */
  type?: "textarea";
  /** 是否密码型输入 */
  secret?: boolean;
  /** 显示条件（联动其它配置项的值） */
  showIf?: (get: (key: string) => string) => boolean;
}

/** 配置分组 */
interface SettingGroup {
  /** 分组标题 */
  name: string;
  /** 组内配置项 */
  items: SettingItem[];
}

/** 取值函数类型（供 showIf 读取其它配置项的当前值） */
type GetValue = (key: string) => string;

/**
 * `IMAGE_CDN_URL` 显示条件：仅自建图床需要填 URL。
 * @param get 取值函数
 * @returns 是否显示
 */
function showImageCdnUrl(get: GetValue): boolean {
  return customImageBedServices.includes(get("IMAGE_CDN"));
}

/**
 * `IMAGE_CDN_TOKEN` 显示条件：已选图床且不是 S3（S3 用 AK/SK）。
 * @param get 取值函数
 * @returns 是否显示
 */
function showImageCdnToken(get: GetValue): boolean {
  return !!get("IMAGE_CDN") && get("IMAGE_CDN") !== "s3";
}

/**
 * S3 相关项显示条件：IMAGE_CDN === 's3'。
 * @param get 取值函数
 * @returns 是否显示
 */
function showS3(get: GetValue): boolean {
  return get("IMAGE_CDN") === "s3";
}

/**
 * 人机验证子项显示条件工厂（按 provider 联动）。
 * @param provider 目标 provider
 * @returns 显示条件函数
 */
function showCaptchaProvider(provider: string): (get: GetValue) => boolean {
  return (get: GetValue) => get("CAPTCHA_PROVIDER") === provider;
}

/** 示例值前缀（1.x 用同一前缀拼出占位提示） */
const EXAMPLE = () => t("ADMIN_CONFIG_EXAMPLE");

/**
 * 构建配置项表单（1.x TkAdminConfig data().settings 的等价物）。
 * @returns 配置分组
 */
function createSettings(): SettingGroup[] {
  return [
    {
      name: t("ADMIN_CONFIG_CATEGORY_COMMON"),
      items: [
        {
          key: "SITE_NAME",
          desc: t("ADMIN_CONFIG_ITEM_SITE_NAME"),
          ph: `${EXAMPLE()}虹墨空间站`,
          value: "",
        },
        {
          key: "SITE_URL",
          desc: t("ADMIN_CONFIG_ITEM_SITE_URL"),
          ph: `${EXAMPLE()}https://www.imaegoo.com`,
          value: "",
        },
        {
          key: "CORS_ALLOW_ORIGIN",
          desc: t("ADMIN_CONFIG_ITEM_CORS_ALLOW_ORIGIN"),
          ph: `${EXAMPLE()}https://www.imaegoo.com`,
          value: "",
        },
        {
          key: "BLOGGER_NICK",
          desc: t("ADMIN_CONFIG_ITEM_BLOGGER_NICK"),
          ph: `${EXAMPLE()}iMaeGoo`,
          value: "",
        },
        {
          key: "BLOGGER_EMAIL",
          desc: t("ADMIN_CONFIG_ITEM_BLOGGER_EMAIL"),
          ph: `${EXAMPLE()}12345@qq.com`,
          value: "",
        },
        {
          key: "COMMENT_PAGE_SIZE",
          desc: t("ADMIN_CONFIG_ITEM_COMMENT_PAGE_SIZE"),
          ph: `${EXAMPLE()}8`,
          value: "",
        },
        {
          key: "MASTER_TAG",
          desc: t("ADMIN_CONFIG_ITEM_MASTER_TAG"),
          ph: `${EXAMPLE()}站长`,
          value: "",
        },
        { key: "COMMENT_BG_IMG", desc: t("ADMIN_CONFIG_ITEM_COMMENT_BG_IMG"), ph: "", value: "" },
        {
          key: "GRAVATAR_CDN",
          desc: t("ADMIN_CONFIG_ITEM_GRAVATAR_CDN"),
          ph: `${EXAMPLE()}sdn.geekzu.org`,
          value: "",
        },
        {
          key: "DEFAULT_GRAVATAR",
          desc: t("ADMIN_CONFIG_ITEM_DEFAULT_GRAVATAR"),
          ph: `${EXAMPLE()}mp`,
          value: "",
        },
        {
          key: "COMMENT_PLACEHOLDER",
          desc: t("ADMIN_CONFIG_ITEM_COMMENT_PLACEHOLDER"),
          ph: `${EXAMPLE()}`,
          value: "",
        },
        {
          key: "SHOW_ORDER",
          desc: t("ADMIN_CONFIG_ITEM_SHOW_ORDER"),
          ph: `${EXAMPLE()}true`,
          value: "",
        },
        {
          key: "SHOW_DISLIKE",
          desc: t("ADMIN_CONFIG_ITEM_SHOW_DISLIKE"),
          ph: `${EXAMPLE()}true`,
          value: "",
        },
        {
          key: "DISPLAYED_FIELDS",
          desc: t("ADMIN_CONFIG_ITEM_DISPLAYED_FIELDS"),
          ph: `${EXAMPLE()}nick,mail,link`,
          value: "",
        },
        {
          key: "REQUIRED_FIELDS",
          desc: t("ADMIN_CONFIG_ITEM_REQUIRED_FIELDS"),
          ph: `${EXAMPLE()}nick,mail,link`,
          value: "",
        },
        {
          key: "HIDE_ADMIN_CRYPT",
          desc: t("ADMIN_CONFIG_ITEM_HIDE_ADMIN_CRYPT"),
          ph: `${EXAMPLE()}admin`,
          value: "",
        },
        {
          key: "QQ_API_KEY",
          desc: t("ADMIN_CONFIG_ITEM_QQ_API_KEY"),
          ph: `${EXAMPLE()}your_api_key`,
          value: "",
        },
      ],
    },
    {
      name: t("ADMIN_CONFIG_CATEGORY_PLUGIN"),
      items: [
        {
          key: "IMAGE_CDN",
          desc: t("ADMIN_CONFIG_ITEM_IMAGE_CDN"),
          ph: "",
          value: "",
          options: [
            { value: "", label: t("ADMIN_CONFIG_IMAGE_CDN_NONE") },
            { value: "qcloud", label: "qcloud" },
            { value: "7bu", label: "7bu (https://7bu.top)" },
            { value: "see", label: "see (https://s.ee)" },
            { value: "lskypro", label: "lskypro" },
            { value: "piclist", label: "piclist" },
            { value: "easyimage", label: "easyimage" },
            { value: "chevereto", label: "chevereto" },
            { value: "s3", label: "S3 / R2 / MinIO" },
          ],
        },
        {
          key: "IMAGE_CDN_URL",
          desc: t("ADMIN_CONFIG_ITEM_IMAGE_CDN_URL"),
          ph: `${EXAMPLE()}https://piclist.example.com`,
          value: "",
          showIf: showImageCdnUrl,
        },
        {
          key: "IMAGE_CDN_TOKEN",
          desc: t("ADMIN_CONFIG_ITEM_IMAGE_CDN_TOKEN"),
          ph: `${EXAMPLE()}example`,
          value: "",
          showIf: showImageCdnToken,
        },
        {
          key: "S3_REGION",
          desc: t("ADMIN_CONFIG_ITEM_S3_REGION"),
          ph: `${EXAMPLE()}us-east-1`,
          value: "",
          showIf: showS3,
        },
        {
          key: "S3_BUCKET",
          desc: t("ADMIN_CONFIG_ITEM_S3_BUCKET"),
          ph: `${EXAMPLE()}my-bucket`,
          value: "",
          showIf: showS3,
        },
        {
          key: "S3_ACCESS_KEY_ID",
          desc: t("ADMIN_CONFIG_ITEM_S3_ACCESS_KEY_ID"),
          // 打码示例值：不写完整示例串，避免客户端产物（twikoo.all.min.js）被下游仓库
          // 收进 git 时触发 GitHub 推送保护（secrets 误报，见 #793）
          ph: `${EXAMPLE()}AKIA****************`,
          value: "",
          showIf: showS3,
        },
        {
          key: "S3_SECRET_ACCESS_KEY",
          desc: t("ADMIN_CONFIG_ITEM_S3_SECRET_ACCESS_KEY"),
          // 同上：打码示例值，避免下游仓库触发 secrets 误报（#793）
          ph: `${EXAMPLE()}wJal********************************EKEY`,
          value: "",
          secret: true,
          showIf: showS3,
        },
        {
          key: "S3_ENDPOINT",
          desc: t("ADMIN_CONFIG_ITEM_S3_ENDPOINT"),
          ph: `${EXAMPLE()}https://xxx.r2.cloudflarestorage.com`,
          value: "",
          showIf: showS3,
        },
        {
          key: "S3_FORCE_PATH_STYLE",
          desc: t("ADMIN_CONFIG_ITEM_S3_FORCE_PATH_STYLE"),
          ph: `${EXAMPLE()}true`,
          value: "",
          showIf: showS3,
        },
        {
          key: "S3_CDN_URL",
          desc: t("ADMIN_CONFIG_ITEM_S3_CDN_URL"),
          ph: `${EXAMPLE()}https://cdn.example.com`,
          value: "",
          showIf: showS3,
        },
        {
          key: "S3_PATH_PREFIX",
          desc: t("ADMIN_CONFIG_ITEM_S3_PATH_PREFIX"),
          ph: `${EXAMPLE()}images/twikoo`,
          value: "",
          showIf: showS3,
        },
        {
          key: "NSFW_API_URL",
          desc: t("ADMIN_CONFIG_ITEM_NSFW_API_URL"),
          ph: `${EXAMPLE()}https://nsfw.example.com`,
          value: "",
        },
        {
          key: "NSFW_THRESHOLD",
          desc: t("ADMIN_CONFIG_ITEM_NSFW_THRESHOLD"),
          ph: `${EXAMPLE()}0.5`,
          value: "",
        },
        {
          key: "SHOW_EMOTION",
          desc: t("ADMIN_CONFIG_ITEM_SHOW_EMOTION"),
          ph: `${EXAMPLE()}false`,
          value: "",
        },
        { key: "EMOTION_CDN", desc: t("ADMIN_CONFIG_ITEM_EMOTION_CDN"), ph: "", value: "" },
        {
          key: "HIGHLIGHT",
          desc: t("ADMIN_CONFIG_ITEM_HIGHLIGHT"),
          ph: `${EXAMPLE()}false`,
          value: "",
        },
        {
          key: "HIGHLIGHT_THEME",
          desc: t("ADMIN_CONFIG_ITEM_HIGHLIGHT_THEME"),
          ph: `${EXAMPLE()}tomorrow`,
          value: "",
        },
        {
          key: "HIGHLIGHT_PLUGIN",
          desc: t("ADMIN_CONFIG_ITEM_HIGHLIGHT_PLUGIN"),
          ph: `${EXAMPLE()}showLanguage`,
          value: "",
        },
        {
          key: "LIGHTBOX",
          desc: t("ADMIN_CONFIG_ITEM_LIGHTBOX"),
          ph: `${EXAMPLE()}true`,
          value: "",
        },
      ],
    },
    {
      name: t("ADMIN_CONFIG_CATEGORY_PRIVACY"),
      items: [
        {
          key: "SHOW_UA",
          desc: t("ADMIN_CONFIG_ITEM_SHOW_UA"),
          ph: `${EXAMPLE()}false`,
          value: "",
        },
        {
          key: "SHOW_REGION",
          desc: t("ADMIN_CONFIG_ITEM_SHOW_REGION"),
          ph: `${EXAMPLE()}true`,
          value: "",
        },
      ],
    },
    {
      name: t("ADMIN_CONFIG_CATEGORY_SPAM"),
      items: [
        {
          key: "AKISMET_KEY",
          desc: t("ADMIN_CONFIG_ITEM_AKISMET_KEY"),
          ph: `${EXAMPLE()}8651783edxxx`,
          value: "",
        },
        {
          key: "QCLOUD_SECRET_ID",
          desc: t("ADMIN_CONFIG_ITEM_QCLOUD_SECRET_ID"),
          ph: `${EXAMPLE()}AKI******************************IHw`,
          value: "",
        },
        {
          key: "QCLOUD_SECRET_KEY",
          desc: t("ADMIN_CONFIG_ITEM_QCLOUD_SECRET_KEY"),
          ph: `${EXAMPLE()}Xrk**************************3D7`,
          value: "",
          secret: true,
        },
        {
          key: "QCLOUD_CMS_BIZTYPE",
          desc: t("ADMIN_CONFIG_ITEM_QCLOUD_CMS_BIZTYPE"),
          ph: `${EXAMPLE()}1787728329856520192`,
          value: "",
        },
        {
          key: "LIMIT_PER_MINUTE",
          desc: t("ADMIN_CONFIG_ITEM_LIMIT_PER_MINUTE"),
          ph: `${EXAMPLE()}5`,
          value: "",
        },
        {
          key: "LIMIT_PER_MINUTE_ALL",
          desc: t("ADMIN_CONFIG_ITEM_LIMIT_PER_MINUTE_ALL"),
          ph: `${EXAMPLE()}5`,
          value: "",
        },
        {
          key: "LIMIT_LENGTH",
          desc: t("ADMIN_CONFIG_ITEM_LIMIT_LENGTH"),
          ph: `${EXAMPLE()}100`,
          value: "",
        },
        {
          key: "FORBIDDEN_WORDS",
          desc: t("ADMIN_CONFIG_ITEM_FORBIDDEN_WORDS"),
          ph: `${EXAMPLE()}快递,空包`,
          value: "",
        },
        {
          key: "BLOCKED_WORDS",
          desc: t("ADMIN_CONFIG_ITEM_BLOCKED_WORDS"),
          ph: `${EXAMPLE()}快递,空包`,
          value: "",
        },
        {
          key: "NOTIFY_SPAM",
          desc: t("ADMIN_CONFIG_ITEM_NOTIFY_SPAM"),
          ph: `${EXAMPLE()}false`,
          value: "",
        },
        {
          key: "HIDE_SPAM",
          desc: t("ADMIN_CONFIG_ITEM_HIDE_SPAM"),
          ph: `${EXAMPLE()}true`,
          value: "",
        },
        {
          key: "LLM_API_KEY",
          desc: t("ADMIN_CONFIG_ITEM_LLM_API_KEY"),
          ph: "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
          value: "",
          secret: true,
        },
        {
          key: "LLM_API_ENDPOINT",
          desc: t("ADMIN_CONFIG_ITEM_LLM_API_ENDPOINT"),
          ph: "https://api.deepseek.com/v1",
          value: "",
        },
        {
          key: "LLM_MODEL",
          desc: t("ADMIN_CONFIG_ITEM_LLM_MODEL"),
          ph: "deepseek-v4-pro",
          value: "",
        },
        {
          key: "LLM_SPAM_PROMPT",
          desc: t("ADMIN_CONFIG_ITEM_LLM_SPAM_PROMPT"),
          ph: "",
          value: "",
          type: "textarea",
        },
        {
          key: "LLM_MAX_RETRIES",
          desc: t("ADMIN_CONFIG_ITEM_LLM_MAX_RETRIES"),
          ph: "3",
          value: "",
        },
      ],
    },
    {
      name: t("ADMIN_CONFIG_CATEGORY_CAPTCHA"),
      items: [
        {
          key: "CAPTCHA_PROVIDER",
          desc: t("ADMIN_CONFIG_ITEM_CAPTCHA_PROVIDER"),
          ph: "",
          value: "",
          options: [
            { value: "", label: t("ADMIN_CONFIG_CAPTCHA_NONE") },
            { value: "Turnstile", label: t("ADMIN_CONFIG_CAPTCHA_TURNSTILE") },
            { value: "Geetest", label: t("ADMIN_CONFIG_CAPTCHA_GEETEST") },
            { value: "Cap", label: t("ADMIN_CONFIG_CAPTCHA_CAP") },
          ],
        },
        {
          key: "TURNSTILE_SITE_KEY",
          desc: t("ADMIN_CONFIG_ITEM_TURNSTILE_SITE_KEY"),
          ph: `${EXAMPLE()}0x4AAAAAAAPLTtpBr_T12345`,
          value: "",
          showIf: showCaptchaProvider("Turnstile"),
        },
        {
          key: "TURNSTILE_SECRET_KEY",
          desc: t("ADMIN_CONFIG_ITEM_TURNSTILE_SECRET_KEY"),
          ph: `${EXAMPLE()}0x4AAAAAAAPLTmBm6gHmOnOqC1iwmU12345`,
          value: "",
          secret: true,
          showIf: showCaptchaProvider("Turnstile"),
        },
        {
          key: "GEETEST_CAPTCHA_ID",
          desc: t("ADMIN_CONFIG_ITEM_GEETEST_CAPTCHA_ID"),
          ph: `${EXAMPLE()}your_captcha_id`,
          value: "",
          showIf: showCaptchaProvider("Geetest"),
        },
        {
          key: "GEETEST_CAPTCHA_KEY",
          desc: t("ADMIN_CONFIG_ITEM_GEETEST_CAPTCHA_KEY"),
          ph: `${EXAMPLE()}your_captcha_key`,
          value: "",
          secret: true,
          showIf: showCaptchaProvider("Geetest"),
        },
        {
          key: "CAP_API_ENDPOINT",
          desc: t("ADMIN_CONFIG_ITEM_CAP_API_ENDPOINT"),
          ph: `${EXAMPLE()}https://cap.example.com/d9256640cb53/（留空=内嵌，无需外部服务）`,
          value: "",
          showIf: showCaptchaProvider("Cap"),
        },
        {
          key: "CAP_SECRET_KEY",
          desc: t("ADMIN_CONFIG_ITEM_CAP_SECRET_KEY"),
          ph: `${EXAMPLE()}仅外部 Cap 需要；内嵌模式可留空`,
          value: "",
          secret: true,
          showIf: showCaptchaProvider("Cap"),
        },
      ],
    },
    {
      name: t("ADMIN_CONFIG_CATEGORY_IM"),
      items: [
        {
          key: "PUSHOO_CHANNEL",
          desc: t("ADMIN_CONFIG_ITEM_PUSHOO_CHANNEL"),
          ph: `${EXAMPLE()}pushdeer`,
          value: "",
        },
        {
          key: "PUSHOO_TOKEN",
          desc: t("ADMIN_CONFIG_ITEM_PUSHOO_TOKEN"),
          ph: `${EXAMPLE()}PDU431TfFHZICvR6lJrFBswSRN1cJ*****zzFvR`,
          value: "",
        },
        {
          key: "SC_MAIL_NOTIFY",
          desc: t("ADMIN_CONFIG_ITEM_SC_MAIL_NOTIFY"),
          ph: `${EXAMPLE()}true`,
          value: "",
        },
      ],
    },
    {
      name: t("ADMIN_CONFIG_CATEGORY_MAIL"),
      items: [
        {
          key: "SENDER_EMAIL",
          desc: t("ADMIN_CONFIG_ITEM_SENDER_EMAIL"),
          ph: `${EXAMPLE()}blog@imaegoo.com`,
          value: "",
        },
        {
          key: "SENDER_NAME",
          desc: t("ADMIN_CONFIG_ITEM_SENDER_NAME"),
          ph: `${EXAMPLE()}虹墨空间站评论提醒`,
          value: "",
        },
        {
          key: "SMTP_SERVICE",
          desc: t("ADMIN_CONFIG_ITEM_SMTP_SERVICE"),
          ph: `${EXAMPLE()}QQ`,
          value: "",
        },
        {
          key: "SMTP_HOST",
          desc: t("ADMIN_CONFIG_ITEM_SMTP_HOST"),
          ph: `${EXAMPLE()}smtp.qq.com`,
          value: "",
        },
        {
          key: "SMTP_PORT",
          desc: t("ADMIN_CONFIG_ITEM_SMTP_PORT"),
          ph: `${EXAMPLE()}465`,
          value: "",
        },
        {
          key: "SMTP_SECURE",
          desc: t("ADMIN_CONFIG_ITEM_SMTP_SECURE"),
          ph: `${EXAMPLE()}true`,
          value: "",
        },
        {
          key: "SMTP_USER",
          desc: t("ADMIN_CONFIG_ITEM_SMTP_USER"),
          ph: `${EXAMPLE()}blog@imaegoo.com`,
          value: "",
        },
        {
          key: "SMTP_PASS",
          desc: t("ADMIN_CONFIG_ITEM_SMTP_PASS"),
          ph: `${EXAMPLE()}password`,
          value: "",
          secret: true,
        },
        {
          key: "MAIL_SUBJECT",
          desc: t("ADMIN_CONFIG_ITEM_MAIL_SUBJECT"),
          ph: `${EXAMPLE()}您在虹墨空间站上的评论收到了回复`,
          value: "",
        },
        {
          key: "MAIL_TEMPLATE",
          desc: t("ADMIN_CONFIG_ITEM_MAIL_TEMPLATE"),
          ph: "",
          value: "",
          type: "textarea",
        },
        {
          key: "MAIL_SUBJECT_ADMIN",
          desc: t("ADMIN_CONFIG_ITEM_MAIL_SUBJECT_ADMIN"),
          ph: `${EXAMPLE()}虹墨空间站上有新评论了`,
          value: "",
        },
        {
          key: "MAIL_TEMPLATE_ADMIN",
          desc: t("ADMIN_CONFIG_ITEM_MAIL_TEMPLATE_ADMIN"),
          ph: "",
          value: "",
          type: "textarea",
        },
      ],
    },
  ];
}

/** 表单分组（响应式） */
const settings = reactive<SettingGroup[]>(createSettings());
/** 加载中 */
const loading = ref(true);
/** 服务端全量配置 */
const serverConfig = reactive<ServerConfig>({});
/** 服务端版本 */
const serverVersion = ref("");
/** 客户端版本（构建期注入） */
const clientVersion = VERSION;
/** 操作结果提示 */
const message = ref("");
/** 邮件测试收件地址 */
const emailTestAddress = ref("");
/** 邮件测试结果 */
const emailTestResult = ref("");

/**
 * 读取服务端配置并回填表单（1.x readConfig 对齐）。
 */
async function readConfig(): Promise<void> {
  loading.value = true;
  const res = await call(getAppState().tcb, "GET_CONFIG_FOR_ADMIN");
  const result = (res.result ?? res) as { code?: number; config?: ServerConfig };
  if (result && !result.code && result.config) {
    Object.assign(serverConfig, result.config);
    serverVersion.value = String(result.config.VERSION ?? "");
    // 兼容旧配置：早期版本没有 CAPTCHA_PROVIDER / IMAGE_CDN 字段，按既有字段推断
    if (typeof serverConfig.CAPTCHA_PROVIDER === "undefined") {
      if (serverConfig.TURNSTILE_SITE_KEY) serverConfig.CAPTCHA_PROVIDER = "Turnstile";
      else if (serverConfig.GEETEST_CAPTCHA_ID) serverConfig.CAPTCHA_PROVIDER = "Geetest";
    }
    // 1.x 该分支两条路径结果同为 ''（`SHOW_IMAGE` 仅作为历史字段回写），等价简化为补空串
    if (typeof serverConfig.IMAGE_CDN === "undefined") serverConfig.IMAGE_CDN = "";
    resetConfig();
  }
  loading.value = false;
}

/** 用服务端配置回填表单（1.x resetConfig 对齐） */
function resetConfig(): void {
  for (const group of settings) {
    for (const setting of group.items) {
      const serverValue = serverConfig[setting.key];
      setting.value = serverValue === undefined ? "" : String(serverValue);
    }
  }
}

/**
 * 判断配置项是否显示（1.x showSetting 对齐）。
 * @param setting 配置项
 * @returns 是否显示
 */
function showSetting(setting: SettingItem): boolean {
  if (typeof setting.showIf !== "function") return true;
  /**
   * 读取其它配置项的当前表单值（供联动条件使用）。
   * @param key 配置键
   * @returns 当前值；不存在时为空串
   */
  const get: GetValue = (key) => {
    for (const group of settings) {
      const found = group.items.find((item) => item.key === key);
      if (found) return found.value;
    }
    return "";
  };
  return setting.showIf(get);
}

/** 保存配置（只提交变更项；1.x saveConfig 对齐） */
async function saveConfig(): Promise<void> {
  loading.value = true;
  message.value = "正在保存";
  const config: Record<string, string> = {};
  for (const group of settings) {
    for (const setting of group.items) {
      const oldValue = serverConfig[setting.key];
      if (String(oldValue ?? "") !== setting.value) config[setting.key] = setting.value;
    }
  }
  if (config.IMAGE_CDN !== undefined) config.SHOW_IMAGE = config.IMAGE_CDN ? "true" : "false";
  logger.info("保存配置", config);
  await call(getAppState().tcb, "SET_CONFIG", { config });
  await readConfig();
  // 通知评论列表刷新配置与可见性（1.x app.$emit('configUpdated')）
  busEmit(EVENT_CONFIG_UPDATED);
  message.value = "保存成功";
  loading.value = false;
}

/** 发送测试邮件（1.x testEmail 对齐） */
async function testEmail(): Promise<void> {
  loading.value = true;
  const res = await call(getAppState().tcb, "EMAIL_TEST", { mail: emailTestAddress.value });
  logger.info("邮件测试", res);
  emailTestResult.value = JSON.stringify(res);
  loading.value = false;
}

/** 配置已更新（保存或导入）后重新回填表单 */
function onConfigUpdated(): void {
  void readConfig();
}

onMounted(() => {
  void readConfig();
  // 导入配置已挪到导入页签，配置变更后本页表单需重新回填
  busOn(EVENT_CONFIG_UPDATED, onConfigUpdated);
});

onUnmounted(() => {
  busOff(EVENT_CONFIG_UPDATED, onConfigUpdated);
});
</script>

<style>
.twikoo .tk-admin-config-groups {
  overflow-y: auto;
  padding-right: 0.5em;
  position: relative;
}
.twikoo .tk-admin-config-groups .tk-admin-config-group,
.twikoo .tk-admin-config-groups .tk-admin-config-group-title {
  background: transparent;
}
.twikoo .tk-admin-config-group-title {
  margin-top: 1em;
  font-size: 1.25rem;
  font-weight: bold;
}
.twikoo .tk-admin-config-item {
  display: grid;
  align-items: center;
  grid-template-columns: 30% 70%;
  margin-top: 1em;
  position: relative;
}
.twikoo .tk-admin-config-title {
  text-align: right;
  margin-right: 1em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.twikoo .tk-admin-config-input {
  position: relative;
}
.twikoo .tk-admin-config-select {
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
  background: none;
  background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23ffffff' d='M6 8.825L1.175 4 2.238 2.938 6 6.7l3.763-3.762L10.825 4z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  border-radius: 4px;
  border: 1px solid rgba(144, 147, 153, 0.31);
  box-sizing: border-box;
  color: #ffffff;
  cursor: pointer;
  display: inline-block;
  font-size: inherit;
  height: 32px;
  line-height: 32px;
  outline: none;
  padding: 0 30px 0 10px;
  transition: border-color 0.2s cubic-bezier(0.645, 0.045, 0.355, 1);
  width: 100%;
}
.twikoo .tk-admin-config-select:focus {
  border-color: rgba(255, 255, 255, 0.6);
}
.twikoo .tk-admin-config-select option {
  color: #fff;
  background: #333;
}
.twikoo .tk-admin-config-desc {
  margin-top: 0.5em;
  font-size: 0.75em;
  overflow-wrap: break-word;
}
.twikoo .tk-admin-config-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 1em;
}
.twikoo .tk-admin-config-message {
  margin-top: 0.5em;
  text-align: center;
}
.twikoo .tk-admin-config-email-test-desc {
  margin: 1em 0;
}
</style>
