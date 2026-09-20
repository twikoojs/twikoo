<!--
  TkSubmit 评论提交组件（1.x TkSubmit.vue 的 Vue3 组合式重写）。

  能力面：meta 输入（TkMetaInput）+ 正文 textarea（TkInput）+ 头像预览 + 表情面板（OwO）
  + 图片上传（选择/粘贴/压缩/云存储或第三方图床）+ 预览（marked + 消毒 + 公式 + 高亮）
  + 草稿持久化 + Ctrl/Cmd+Enter 发送 + 三种人机验证（Turnstile / Geetest / Cap）
  + 内联错误卡片（TkError）。

  类名映射（1.x `.el-*` → 2.0 `.tk-*`）：`.el-textarea__inner` → `.tk-textarea__inner`；
  `.el-button` → `.tk-button`（其余 tk- 类名与 1.x 同名保留）。
-->
<template>
  <div ref="tkSubmitRef" class="tk-submit tk-fade-in">
    <div class="tk-row">
      <TkAvatar :config="config" :mail="mail" :nick="nick" />
      <div class="tk-col">
        <TkMetaInput
          :nick="nick"
          :mail="mail"
          :link="link"
          :config="config"
          @update="onMetaUpdate"
        />
        <TkInput
          ref="textareaRef"
          v-model="comment"
          class="tk-input"
          type="textarea"
          :placeholder="commentPlaceholder"
          :autosize="{ minRows: 3 }"
          :maxlength="maxLength"
          show-word-limit
          @input="onCommentInput"
          @keyup="onKeyup"
        />
      </div>
    </div>
    <div class="tk-row actions">
      <div class="tk-row-actions-start">
        <!-- 表情按钮：首屏先渲染图标，随后由 OwO 面板以同样的 logo 接管容器内容 -->
        <!-- 图标为构建期内联的 fontawesome 官方 SVG，非运行时用户数据 -->
        <!-- eslint-disable vue/no-v-html -->
        <div
          v-show="config.SHOW_EMOTION === 'true'"
          ref="owoRef"
          v-clickoutside="closeOwo"
          class="tk-submit-action-icon OwO"
          v-html="emotionIcon"
        ></div>
        <!-- eslint-enable vue/no-v-html -->
        <div v-show="showImage" class="tk-submit-action-icon" @click="openSelectImage">
          <TkIcon name="image-regular" />
        </div>
        <input
          ref="inputFileRef"
          class="tk-input-image"
          type="file"
          accept="image/*"
          value=""
          @change="onSelectImage"
        />
        <div class="tk-error-message">
          <TkError v-if="error" :error="error" />
        </div>
      </div>
      <a
        class="tk-submit-action-icon __markdown"
        alt="Markdown is supported"
        href="https://guides.github.com/features/mastering-markdown/"
        target="_blank"
        rel="noopener noreferrer"
      >
        <TkIcon name="markdown" />
      </a>
      <TkButton v-if="!!replyId" class="tk-cancel" size="small" @click="cancel">
        {{ t("SUBMIT_CANCEL") }}
      </TkButton>
      <TkButton class="tk-preview" size="small" @click="preview">{{
        t("SUBMIT_PREVIEW")
      }}</TkButton>
      <TkButton class="tk-send" type="primary" size="small" :disabled="!canSend" @click="send">
        {{ isSending ? t("SUBMIT_SENDING") : t("SUBMIT_SEND") }}
      </TkButton>
      <div
        v-show="captchaProvider === 'Turnstile'"
        ref="turnstileContainerRef"
        class="tk-turnstile-container"
      >
        <div ref="turnstileRef" class="tk-turnstile"></div>
      </div>
      <div
        v-show="captchaProvider === 'Geetest'"
        ref="geetestContainerRef"
        class="tk-geetest-container"
      ></div>
      <div v-show="captchaProvider === 'Cap'" ref="capContainerRef" class="tk-cap-container"></div>
    </div>
    <div v-if="isPreviewing" ref="commentPreviewRef" class="tk-preview-container">
      <!-- 预览内容经 sanitizeHtml 消毒 -->
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div v-html="commentHtml"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import TkAvatar from "./TkAvatar.vue";
import TkMetaInput from "./TkMetaInput.vue";
import TkButton from "../components/TkButton.vue";
import TkInput from "../components/TkInput.vue";
import TkIcon from "../components/TkIcon.vue";
import TkError from "../components/TkError.vue";
import { ICONS } from "../components/icons";
import OwO from "../lib/owo";
import { TwikooError, call, getAppState } from "../utils/api";
import {
  blobToDataURL,
  getHref,
  getUserAgent,
  getUrl,
  initMarkedOwo,
  initOwoEmotions,
  logger,
  parseMarkdown,
  renderCode,
  renderLinks,
  renderMath,
  sanitizeHtml,
  t,
} from "../utils";
import { vClickoutside } from "../utils/directives";
import { EMPTY_CONFIG } from "./defaults";
import type { OwoData } from "../utils/emotion";
import type { ServerConfig } from "../types";

/** 可上传的图片扩展名（1.x imageTypes 同表） */
const imageTypes = ["apng", "bmp", "gif", "jpeg", "jpg", "png", "svg", "tif", "tiff", "webp"];

/**
 * 表情按钮图标（fontawesome regular/laugh 的 SVG 源码）。
 *
 * OwO 面板会用它重写容器内容为 `<div class="OwO-logo">…</div>`，所以必须把图标
 * 交给 OwO 的 `logo` 选项；留空会让 OwO 回退到文案 logo（"OwO表情"），
 * 在 1.25em 宽的按钮里折行并与右侧图标重叠。
 */
const emotionIcon = ICONS["laugh-regular"];

/** TkInput 经 defineExpose 暴露的结构面 */
interface TkInputExposed {
  /** 聚焦 */
  focus(): void;
  /** 失焦 */
  blur(): void;
  /** 原生输入框元素 */
  inputEl?: HTMLInputElement | HTMLTextAreaElement;
}

/** 组件属性 */
const props = withDefaults(
  defineProps<{
    /** 所属根评论 ID（回复时） */
    replyId?: string;
    /** 被回复的评论 ID */
    pid?: string;
    /** 服务端配置 */
    config?: ServerConfig;
  }>(),
  { replyId: "", pid: "", config: EMPTY_CONFIG },
);

/** 组件事件（1.x `$emit` 同名保留） */
const emit = defineEmits<{
  (e: "load"): void;
  (e: "cancel"): void;
}>();

/** 发送中 */
const isSending = ref(false);
/** 是否处于预览态 */
const isPreviewing = ref(false);
/** meta 是否校验通过 */
const isMetaValid = ref(false);
/** 提交错误（统一错误模型）*/
const error = ref<TwikooError>();
/** OwO 面板实例 */
const owo = ref<OwO | null>(null);
/** 正文 Markdown 源文本 */
const comment = ref("");
/** 正文预览 HTML */
const commentHtml = ref("");
/** 昵称 */
const nick = ref("");
/** 邮箱 */
const mail = ref("");
/** 网址 */
const link = ref("");
/** Turnstile 脚本加载 Promise */
const turnstileLoad = ref<Promise<void> | null>(null);
/** Geetest 脚本加载 Promise */
const geetestLoad = ref<Promise<void> | null>(null);
/** Cap 脚本加载 Promise */
const capLoad = ref<Promise<void> | null>(null);

/** 根节点引用（回复时滚动定位） */
const tkSubmitRef = ref<HTMLElement>();
/** textarea 组件引用（OwO 插入目标 / 图片 placeholder 定位） */
const textareaRef = ref<TkInputExposed>();
/** OwO 容器引用 */
const owoRef = ref<HTMLElement>();
/** 文件选择框引用 */
const inputFileRef = ref<HTMLInputElement>();
/** 预览容器引用（渲染后处理目标） */
const previewRef = ref<HTMLElement>();
/** Turnstile 容器 */
const turnstileRef = ref<HTMLElement>();
/** Turnstile 外层容器（脚本挂载点） */
const turnstileContainerRef = ref<HTMLElement>();
/** Geetest 容器 */
const geetestContainerRef = ref<HTMLElement>();
/** Cap 容器 */
const capContainerRef = ref<HTMLElement>();

/** 人机验证提供方（1.x captchaProvider 判定链） */
const captchaProvider = computed(() => {
  const c = props.config;
  if (typeof c.CAPTCHA_PROVIDER !== "undefined") return c.CAPTCHA_PROVIDER;
  if (c.TURNSTILE_SITE_KEY) return "Turnstile";
  if (c.GEETEST_CAPTCHA_ID) return "Geetest";
  if (c.CAP_API_ENDPOINT || c.CAP_BUILTIN) return "Cap";
  return "";
});

/** 是否显示图片上传按钮（配置了图床） */
const showImage = computed(() => !!props.config.IMAGE_CDN);

/** 是否可发送 */
const canSend = computed(() => !isSending.value && isMetaValid.value && !!comment.value.trim());

/** 评论框提示语（`<br>` 还原为换行；1.x commentPlaceholder 对齐） */
const commentPlaceholder = computed(() => {
  const options = getAppState().options;
  const raw = options.placeholder ?? props.config.COMMENT_PLACEHOLDER;
  return (typeof raw === "string" ? raw : "").replace(/<br>/g, "\n");
});

/** 最大长度（`LIMIT_LENGTH` ≤0 表示不限长） */
const maxLength = computed(() => {
  let limitLength = parseInt(String(props.config.LIMIT_LENGTH), 10);
  if (Number.isNaN(limitLength)) limitLength = 500;
  return limitLength > 0 ? limitLength : undefined;
});

/** 原生 textarea 元素（OwO 插入与 placeholder 定位用） */
const textarea = computed<HTMLTextAreaElement | null>(() => {
  const el = textareaRef.value?.inputEl;
  return el instanceof HTMLTextAreaElement ? el : null;
});

/** 草稿持久化（1.x saveDraft 对齐） */
function saveDraft(): void {
  localStorage.setItem("twikoo-draft", comment.value);
}

/** 读取草稿（1.x initDraft 对齐：已有内容时不覆盖） */
function initDraft(): void {
  const draft = localStorage.getItem("twikoo-draft");
  if (!comment.value && draft) comment.value = draft;
}

/** 初始化 OwO 表情面板（`SHOW_EMOTION=true` 时；1.x initOwo 对齐） */
async function initOwo(): Promise<void> {
  if (props.config.SHOW_EMOTION !== "true") return;
  const odata: OwoData = await initOwoEmotions(
    String(props.config.EMOTION_CDN || "https://owo.imaegoo.com/owo.json"),
  );
  // 注册表情映射给 marked（2.0 的 setOwoImages 调用点）
  initMarkedOwo(odata);
  if (!owoRef.value || !textarea.value) return;
  owo.value = new OwO({
    logo: emotionIcon,
    container: owoRef.value,
    target: textarea.value,
    odata,
    position: "down",
    maxHeight: "250px",
  });
}

/** 点击 OwO 面板外部时收起（1.x v-clickoutside 等价物） */
function closeOwo(): void {
  if (owo.value?.container.classList.contains("OwO-open")) owo.value.toggle();
}

/**
 * 动态加载外部脚本（幂等）。
 * @param src 脚本地址
 * @returns 加载完成的 Promise
 */
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const scriptEl = document.createElement("script");
    scriptEl.src = src;
    scriptEl.onload = () => resolve();
    scriptEl.onerror = () => reject(new Error(`脚本加载失败：${src}`));
    document.head.appendChild(scriptEl);
  });
}

/** Turnstile 全局对象最小结构面（CDN 脚本注入；声明为属性式函数类型，避免跨对象提取方法） */
interface TurnstileGlobal {
  /**
   * 渲染验证组件。
   * @param el 宿主元素
   * @param options 渲染选项
   * @returns widget id
   */
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  /**
   * 移除验证组件。
   * @param widgetId widget id
   */
  remove: (widgetId: string) => void;
}

/** Geetest 验证实例最小结构面（链式回调） */
interface GeetestCaptchaInstance {
  /** 实例就绪 */
  onReady: (cb: () => void) => GeetestCaptchaInstance;
  /** 验证成功 */
  onSuccess: (cb: () => void) => GeetestCaptchaInstance;
  /** 验证出错 */
  onError: (cb: (e: unknown) => void) => GeetestCaptchaInstance;
  /** 验证被关闭 */
  onClose: (cb: () => void) => void;
  /** 显示验证面板 */
  showCaptcha: () => void;
  /** 取验证结果 */
  getValidate: () => {
    lot_number: string;
    captcha_output: string;
    pass_token: string;
    gen_time: string;
  };
}

/** Geetest 初始化函数最小结构面 */
type InitGeetest4 = (
  options: Record<string, unknown>,
  callback: (captcha: GeetestCaptchaInstance) => void,
) => void;

/** Cap 自定义 fetch 的响应结构面（widget 只消费 `ok` 与 `json()`） */
interface CapFetchResponse {
  /** 是否成功 */
  ok: boolean;
  /**
   * 取响应体。
   * @returns 响应数据
   */
  json: () => Promise<Record<string, unknown>>;
}

/**
 * 构造 Cap 自定义 fetch 的响应对象。
 * @param ok 是否成功
 * @param payload 响应数据
 * @returns 响应对象
 */
function capResponse(ok: boolean, payload: Record<string, unknown>): CapFetchResponse {
  /**
   * 取响应体（Cap widget 只消费 `ok` 与 `json()`）。
   * @returns 响应数据
   */
  const json = (): Promise<Record<string, unknown>> => Promise.resolve(payload);
  return { ok, json };
}

/** 初始化 Turnstile（1.x initTurnstile 对齐） */
function initTurnstile(): void {
  if (captchaProvider.value !== "Turnstile" || !props.config.TURNSTILE_SITE_KEY) return;
  const win = window as unknown as { turnstile?: unknown };
  if (win.turnstile) {
    turnstileLoad.value = Promise.resolve();
    return;
  }
  if (turnstileLoad.value) return;
  turnstileLoad.value = loadScript(
    "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit",
  );
}

/**
 * 取得 Turnstile token（渲染 widget 并在回调里 resolve）。
 * @returns token
 */
function getTurnstileToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    void turnstileLoad.value?.then(() => {
      const turnstile = (window as unknown as { turnstile: TurnstileGlobal }).turnstile;
      const widgetId = turnstile.render(turnstileRef.value as HTMLElement, {
        sitekey: props.config.TURNSTILE_SITE_KEY,
        /**
         * 校验成功回调。
         * @param token 校验 token
         */
        callback: (token: string) => {
          resolve(token);
          setTimeout(() => turnstile.remove(widgetId), 1000);
        },
        /** 校验失败回调 */
        "error-callback": () => reject(new Error("验证码校验失败，请重试")),
        /** 校验过期回调 */
        "expired-callback": () => reject(new Error("验证码已过期，请重试")),
        /** 校验超时回调 */
        "timeout-callback": () => reject(new Error("验证码超时，请重试")),
      });
    });
  });
}

/** 初始化 Geetest（1.x initGeeTest 对齐） */
function initGeeTest(): void {
  if (captchaProvider.value !== "Geetest" || !props.config.GEETEST_CAPTCHA_ID) return;
  const win = window as unknown as { initGeetest4?: unknown };
  if (win.initGeetest4) {
    geetestLoad.value = Promise.resolve();
    return;
  }
  if (geetestLoad.value) return;
  geetestLoad.value = loadScript("https://static.geetest.com/v4/gt4.js");
}

/** Geetest 校验结果（1.x getGeeTestToken 返回结构） */
interface GeeTestResult {
  /** 验证流水号 */
  geeTestLotNumber: string;
  /** 验证输出 */
  geeTestCaptchaOutput: string;
  /** 通过令牌 */
  geeTestPassToken: string;
  /** 生成时间 */
  geeTestGenTime: string;
}

/**
 * 取得 Geetest 校验结果（1.x getGeeTestToken 对齐）。
 * @returns 校验结果
 */
function getGeeTestToken(): Promise<GeeTestResult> {
  return new Promise((resolve, reject) => {
    void geetestLoad.value?.then(() => {
      const initGeetest4 = (window as unknown as { initGeetest4: InitGeetest4 }).initGeetest4;
      initGeetest4(
        { captchaId: props.config.GEETEST_CAPTCHA_ID, product: "bind", language: "zho" },
        (captcha) => {
          captcha
            .onReady(() => captcha.showCaptcha())
            .onSuccess(() => {
              const result = captcha.getValidate();
              resolve({
                geeTestLotNumber: result.lot_number,
                geeTestCaptchaOutput: result.captcha_output,
                geeTestPassToken: result.pass_token,
                geeTestGenTime: result.gen_time,
              });
            })
            .onError((e: unknown) =>
              reject(e instanceof Error ? e : new Error("Geetest 验证失败，请重试")),
            )
            .onClose(() => reject(new Error("验证已取消")));
        },
      );
    });
  });
}

/** 初始化 Cap（内嵌模式经 Twikoo 事件转发 challenge/redeem；1.x initCap 对齐） */
function initCap(): void {
  if (captchaProvider.value !== "Cap") return;
  if (!props.config.CAP_API_ENDPOINT && !props.config.CAP_BUILTIN) return;
  const win = window as unknown as {
    CAP_CUSTOM_FETCH?: (url: string, options?: { body?: string }) => Promise<CapFetchResponse>;
    Cap?: unknown;
  };
  if (props.config.CAP_BUILTIN) {
    win.CAP_CUSTOM_FETCH = async (url, options = {}) => {
      const path = String(url);
      const body = options.body ? (JSON.parse(options.body) as Record<string, unknown>) : {};
      try {
        if (path.includes("challenge")) {
          const res = await call(getAppState().tcb, "CAP_CHALLENGE");
          const result = (res.result ?? res) as {
            code?: number;
            message?: string;
            challenge?: string;
            token?: string;
            expires?: number;
          };
          if (result.code && result.code !== 0) {
            return capResponse(false, { error: result.message ?? "challenge_failed" });
          }
          return capResponse(true, {
            challenge: result.challenge,
            token: result.token,
            expires: result.expires,
          });
        }
        if (path.includes("redeem")) {
          const res = await call(getAppState().tcb, "CAP_REDEEM", body);
          const result = (res.result ?? res) as {
            code?: number;
            success?: boolean;
            message?: string;
            error?: string;
            token?: string;
            expires?: number;
          };
          if (result.code && result.code !== 0 && result.success !== true) {
            return capResponse(true, {
              success: false,
              error: result.message ?? result.error ?? "redeem_failed",
            });
          }
          return capResponse(true, {
            success: result.success,
            token: result.token,
            expires: result.expires,
            message: result.message,
            error: result.error ?? result.message,
          });
        }
        return capResponse(false, { error: "unknown_cap_path" });
      } catch (e) {
        return capResponse(false, { error: e instanceof Error ? e.message : "cap_fetch_failed" });
      }
    };
  }
  if (win.Cap || customElements.get("cap-widget")) {
    capLoad.value = Promise.resolve();
    return;
  }
  if (capLoad.value) return;
  capLoad.value = loadScript("https://cdn.jsdmirror.com/npm/@cap.js/widget");
}

/**
 * 取得 Cap token（渲染 cap-widget 并等待 solve；1.x getCapToken 对齐）。
 * @returns token
 */
function getCapToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    capLoad.value
      ?.then(() => {
        const capWidget = document.createElement("cap-widget") as HTMLElement & {
          solve(): Promise<{ success?: boolean; token?: string }>;
        };
        capWidget.setAttribute("id", "cap-widget");
        const endpoint = props.config.CAP_BUILTIN ? "/" : String(props.config.CAP_API_ENDPOINT);
        capWidget.setAttribute("data-cap-api-endpoint", endpoint);
        capContainerRef.value?.appendChild(capWidget);
        /** 移除临时插入的 cap-widget 元素 */
        const cleanup = (): void => {
          capWidget.parentNode?.removeChild(capWidget);
        };
        capWidget
          .solve()
          .then((result) => {
            cleanup();
            if (result.success) resolve(typeof result.token === "string" ? result.token : "");
            else reject(new Error("Cap 验证失败"));
          })
          .catch((e: unknown) => {
            cleanup();
            reject(e instanceof Error ? e : new Error("Cap 验证失败"));
          });
      })
      .catch(reject);
  });
}

/**
 * meta 输入变更回调（1.x onMetaUpdate 对齐）。
 * @param updates meta 与校验结果
 */
function onMetaUpdate(updates: {
  meta: { nick: string; mail: string; link: string };
  valid: boolean;
}): void {
  nick.value = updates.meta.nick;
  mail.value = updates.meta.mail;
  link.value = updates.meta.link;
  isMetaValid.value = updates.valid;
}

/** 取消回复（1.x cancel 对齐） */
function cancel(): void {
  emit("cancel");
}

/** 正文输入：存草稿 + 实时刷新预览（1.x onCommentInput 对齐） */
function onCommentInput(): void {
  saveDraft();
  updatePreview();
}

/** 切换预览态（1.x preview 对齐） */
function preview(): void {
  isPreviewing.value = !isPreviewing.value;
  updatePreview();
}

/** 刷新预览 HTML（marked → 消毒 → DOM 后处理；1.x updatePreview 对齐） */
function updatePreview(): void {
  if (!isPreviewing.value) return;
  commentHtml.value = sanitizeHtml(parseMarkdown(comment.value));
  void nextTick(() => {
    const el = previewRef.value;
    if (!el) return;
    renderLinks(el);
    renderMath(el, getAppState().options.katex);
    if (props.config.HIGHLIGHT === "true") {
      renderCode(el, props.config.HIGHLIGHT_THEME, props.config.HIGHLIGHT_PLUGIN);
    }
  });
}

/**
 * 发送评论（1.x send 对齐：校验 → 人机验证 → COMMENT_SUBMIT → 清草稿）。
 */
async function send(): Promise<void> {
  isSending.value = true;
  error.value = undefined;
  try {
    if (comment.value.match(new RegExp(`!\\[${t("IMAGE_UPLOAD_PLACEHOLDER")}.+\\]\\(\\)`))) {
      throw new Error(t("IMAGE_UPLOAD_PLEASE_WAIT"));
    }
    const payload: Record<string, unknown> = {
      nick: nick.value,
      mail: mail.value,
      link: link.value,
      ua: await getUserAgent(),
      url: getUrl(getAppState().options.path),
      href: getHref(getAppState().options.href),
      comment: parseMarkdown(comment.value),
      pid: props.pid ? props.pid : props.replyId,
      rid: props.replyId,
    };
    if (captchaProvider.value === "Turnstile" && props.config.TURNSTILE_SITE_KEY) {
      payload.turnstileToken = await getTurnstileToken();
    }
    if (captchaProvider.value === "Geetest" && props.config.GEETEST_CAPTCHA_ID) {
      Object.assign(payload, await getGeeTestToken());
    }
    if (
      captchaProvider.value === "Cap" &&
      (props.config.CAP_API_ENDPOINT || props.config.CAP_BUILTIN)
    ) {
      payload.capToken = await getCapToken();
    }
    const res = await call(getAppState().tcb, "COMMENT_SUBMIT", payload);
    const result = (res.result ?? res) as { id?: string; code?: number; message?: string };
    if (result.id) {
      comment.value = "";
      error.value = undefined;
      emit("load");
      saveDraft();
    } else {
      throw new TwikooError(
        result.code !== undefined ? "REJECTED" : "UNKNOWN",
        result.message ?? t("COMMENT_FAILED"),
        { rawMessage: result.message ?? "" },
      );
    }
  } catch (e) {
    logger.error("评论失败", e);
    error.value =
      e instanceof TwikooError
        ? e
        : new TwikooError("UNKNOWN", `${t("COMMENT_FAILED")}: ${(e as Error).message}`, {
            rawMessage: (e as Error).message,
          });
  } finally {
    isSending.value = false;
  }
}

/**
 * 键盘事件（Ctrl/Cmd + Enter 发送；1.x onEnterKeyUp 对齐）。
 * @param evt 键盘事件
 */
function onKeyup(evt: KeyboardEvent): void {
  if ((evt.ctrlKey || evt.metaKey) && evt.key === "Enter") void send();
}

/** 打开文件选择框（1.x openSelectImage 对齐） */
function openSelectImage(): void {
  inputFileRef.value?.click();
}

/** 选择图片后上传（1.x onSelectImage 对齐） */
function onSelectImage(): void {
  const photo = inputFileRef.value?.files?.[0];
  void parseAndUploadPhoto(photo);
}

/**
 * 粘贴图片上传（1.x onPaste 对齐）。
 * @param evt 粘贴事件
 */
function onPaste(evt: ClipboardEvent): void {
  if (!evt.clipboardData) return;
  const photo = evt.clipboardData.files[0] ?? evt.clipboardData.items[0]?.getAsFile() ?? undefined;
  void parseAndUploadPhoto(photo);
}

/**
 * 校验类型 → 压缩 → 按图床配置上传（1.x parseAndUploadPhoto 对齐）。
 * @param photo 图片文件
 */
async function parseAndUploadPhoto(photo?: File): Promise<void> {
  if (!photo || !showImage.value) return;
  const nameSplit = photo.name.split(".");
  const fileType = nameSplit.length > 1 ? String(nameSplit.pop()) : "";
  if (imageTypes.indexOf(fileType.toLowerCase()) === -1) return;
  const { tcb } = getAppState();
  const userId = tcb?.auth?.currentUser?.uid ?? localStorage.getItem("twikoo-access-token") ?? "";
  const fileIndex = `${Date.now()}-${userId}`;
  const fileName = nameSplit.join(".");
  const isGif = photo.type === "image/gif";
  const newFileName = isGif ? fileName : `${fileName}.webp`;
  const newFileType = isGif ? fileType : "webp";
  paste(getImagePlaceholder(fileIndex, newFileType));
  const imageCdn = String(props.config.IMAGE_CDN ?? "");
  const compressedPhoto = await compressImage(photo);
  if (tcb && (!imageCdn || imageCdn === "qcloud")) {
    void uploadPhotoToQcloud(fileIndex, newFileName, newFileType, compressedPhoto);
  } else if (imageCdn) {
    void uploadPhotoToThirdParty(fileIndex, newFileName, newFileType, compressedPhoto);
  } else {
    uploadFailed(fileIndex, newFileType, t("IMAGE_UPLOAD_FAILED_NO_CONF"));
  }
}

/**
 * 图片压缩（长边 1920、webp 质量 0.85；GIF 原样返回；1.x compressImage 对齐）。
 * @param photo 原图
 * @returns 压缩后的文件
 */
async function compressImage(photo: File): Promise<File> {
  if (photo.type === "image/gif") return photo;
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        const maxSize = 1920;
        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = (height * maxSize) / width;
            width = maxSize;
          } else {
            width = (width * maxSize) / height;
            height = maxSize;
          }
        }
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d")?.drawImage(img, 0, 0, width, height);
        const webpType = "image/webp";
        const fileName = photo.name.replace(/\.[^.]+$/, ".webp");
        canvas.toBlob(
          (blob) => resolve(new File([blob ?? new Blob()], fileName, { type: webpType })),
          webpType,
          0.85,
        );
      };
      const loaded = e.target?.result;
      img.src = typeof loaded === "string" ? loaded : "";
    };
    reader.readAsDataURL(photo);
  });
}

/**
 * 上传到云开发存储（1.x uploadPhotoToQcloud 对齐）。
 * @param fileIndex 文件索引（占位符标识）
 * @param fileName 文件名
 * @param fileType 文件类型
 * @param photo 压缩后的图片
 */
async function uploadPhotoToQcloud(
  fileIndex: string,
  fileName: string,
  fileType: string,
  photo: File,
): Promise<void> {
  try {
    const app = getAppState().tcb?.app as unknown as {
      uploadFile(params: { cloudPath: string; filePath: File }): Promise<{ fileID?: string }>;
      getTempFileURL(params: {
        fileList: string[];
      }): Promise<{ fileList: Array<{ tempFileURL: string }> }>;
    };
    const uploadResult = await app.uploadFile({
      cloudPath: `tk-img/${fileIndex}.${fileType}`,
      filePath: photo,
    });
    if (!uploadResult.fileID) return;
    const tempUrlResult = await app.getTempFileURL({ fileList: [uploadResult.fileID] });
    uploadCompleted(fileIndex, fileName, fileType, tempUrlResult.fileList[0].tempFileURL);
  } catch (e) {
    console.error(e);
    uploadFailed(fileIndex, fileType, (e as Error).message);
  }
}

/**
 * 上传到第三方图床（1.x uploadPhotoToThirdParty 对齐）。
 * @param fileIndex 文件索引
 * @param fileName 文件名
 * @param fileType 文件类型
 * @param photo 压缩后的图片
 */
async function uploadPhotoToThirdParty(
  fileIndex: string,
  fileName: string,
  fileType: string,
  photo: File,
): Promise<void> {
  try {
    const res = await call(getAppState().tcb, "UPLOAD_IMAGE", {
      fileName,
      photo: await blobToDataURL(photo),
    });
    const result = (res.result ?? res) as {
      data?: { url?: string };
      code?: number;
      err?: string;
    };
    if (result.data) {
      uploadCompleted(fileIndex, fileName, fileType, String(result.data.url));
    } else if (result.code === 1041) {
      uploadFailed(fileIndex, fileType, t("IMAGE_UPLOAD_NSFW"));
    } else {
      console.error(result);
      uploadFailed(fileIndex, fileType, String(result.err));
    }
  } catch (e) {
    console.error(e);
    uploadFailed(fileIndex, fileType, (e as Error).message);
  }
}

/**
 * 上传成功：把占位符替换为 Markdown 图片（1.x uploadCompleted 对齐）。
 * @param fileIndex 文件索引
 * @param fileName 文件名
 * @param fileType 文件类型
 * @param fileUrl 图片地址
 */
function uploadCompleted(
  fileIndex: string,
  fileName: string,
  fileType: string,
  fileUrl: string,
): void {
  const safeName = fileName.replace(/[[\]]/g, "_");
  comment.value = comment.value.replace(
    getImagePlaceholder(fileIndex, fileType),
    `![${safeName}](${fileUrl})`,
  );
  if (inputFileRef.value) inputFileRef.value.value = "";
}

/**
 * 上传失败：把占位符替换为错误提示（1.x uploadFailed 对齐）。
 * @param fileIndex 文件索引
 * @param fileType 文件类型
 * @param reason 失败原因
 */
function uploadFailed(fileIndex: string, fileType: string, reason: string): void {
  comment.value = comment.value.replace(
    getImagePlaceholder(fileIndex, fileType),
    `_${t("IMAGE_UPLOAD_FAILED")}: ${reason}_`,
  );
  if (inputFileRef.value) inputFileRef.value.value = "";
}

/**
 * 在光标处插入文本（1.x paste 对齐；插入后把光标移到文本末尾）。
 * @param text 待插入文本
 */
function paste(text: string): void {
  const el = textarea.value;
  const start = el?.selectionStart ?? comment.value.length;
  const end = el?.selectionEnd ?? comment.value.length;
  comment.value = comment.value.substring(0, start) + text + comment.value.substring(end);
  void nextTick(() => {
    if (!el) return;
    const caret = start + text.length;
    el.selectionStart = caret;
    el.selectionEnd = caret;
  });
}

/**
 * 生成图片占位符（1.x getImagePlaceholder 对齐）。
 * @param fileIndex 文件索引
 * @param fileType 文件类型
 * @returns 占位符 Markdown
 */
function getImagePlaceholder(fileIndex: string, fileType: string): string {
  return `![${t("IMAGE_UPLOAD_PLACEHOLDER")} ${fileIndex}.${fileType}]()`;
}

/** 按 `COMMENT_BG_IMG` 设置 textarea 背景图（1.x onBgImgChange 对齐） */
function onBgImgChange(): void {
  if (props.config.COMMENT_BG_IMG && textarea.value) {
    textarea.value.style["background-image"] = `url("${String(props.config.COMMENT_BG_IMG)}")`;
  }
}

/** 初始化全部人机验证脚本（1.x mounted 里的三连调用） */
function initCaptcha(): void {
  initTurnstile();
  initGeeTest();
  initCap();
}

watch(
  () => props.config.SHOW_EMOTION,
  () => {
    void initOwo();
  },
);
watch(
  () => props.config.COMMENT_BG_IMG,
  () => {
    onBgImgChange();
  },
);
watch(
  () => props.config.TURNSTILE_SITE_KEY,
  () => {
    initTurnstile();
  },
);
watch(
  () => props.config.GEETEST_CAPTCHA_ID,
  () => {
    initGeeTest();
  },
);
watch(
  () => props.config.CAP_API_ENDPOINT,
  () => {
    initCap();
  },
);
watch(captchaProvider, () => {
  initCaptcha();
});

onMounted(() => {
  if (props.pid) tkSubmitRef.value?.scrollIntoView({ behavior: "instant", block: "center" });
  initDraft();
  textarea.value?.addEventListener("paste", onPaste);
  onBgImgChange();
  initCaptcha();
  void initOwo();
});

onUnmounted(() => {
  textarea.value?.removeEventListener("paste", onPaste);
});
</script>

<style>
.twikoo .tk-submit {
  display: flex;
  flex-direction: column;
}
.twikoo .tk-col {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.twikoo .tk-meta-input {
  margin-bottom: 0.5rem;
}
.twikoo .tk-row.actions {
  position: relative;
  margin-top: 1rem;
  margin-bottom: 1rem;
  margin-left: 3.5rem;
  align-items: center;
  justify-content: flex-end;
}
.twikoo .tk-row-actions-start {
  flex: 1;
  display: flex;
  align-items: center;
}
.twikoo .tk-submit-action-icon {
  align-self: center;
  display: inline-block;
  width: 1.25em;
  line-height: 0;
  margin-right: 10px;
  cursor: pointer;
  flex-shrink: 0;
}
.twikoo .tk-submit-action-icon svg:hover {
  opacity: 0.8;
}
/*
 * 提交栏图标按按钮宽度等比铺开（1.x 由全局 `.twikoo svg { width:100%; height:100% }` 达成）。
 * tk-icon 默认按 1em 定高，会让图片 / Markdown 图标比 1.x 小一圈；
 * 这里改成宽度撑满、高度按 SVG 比例自适应。
 */
.twikoo .tk-submit-action-icon .tk-icon,
.twikoo .tk-submit-action-icon .tk-icon svg {
  width: 100%;
}
.twikoo .tk-submit-action-icon .tk-icon svg {
  height: auto;
}
.twikoo .tk-submit-action-icon.__markdown {
  color: #909399;
}
.twikoo .tk-error-message {
  word-break: break-all;
  color: #ff0000;
  font-size: 0.75em;
  flex-shrink: 1;
}
.twikoo .tk-input-image {
  display: none;
}
.twikoo .tk-input {
  flex: 1;
}
.twikoo .tk-input .tk-textarea__inner {
  background-position: right bottom;
  background-repeat: no-repeat;
}
.twikoo .tk-turnstile-container,
.twikoo .tk-geetest-container,
.twikoo .tk-cap-container {
  position: absolute;
  right: 0;
  bottom: -75px;
  z-index: 1;
}
.twikoo .tk-turnstile {
  display: flex;
  flex-direction: column;
}
.twikoo .tk-preview-container {
  margin-left: 3rem;
  margin-bottom: 1rem;
  padding: 5px 15px;
  border: 1px solid rgba(128, 128, 128, 0.31);
  border-radius: 4px;
  word-break: break-word;
}
.twikoo .tk-fade-in {
  animation: tkFadeIn 0.3s;
}
@keyframes tkFadeIn {
  0% {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
</style>
