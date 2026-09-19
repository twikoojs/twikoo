import { defineConfig } from "vitepress";

/**
 * 文档示例里的 twikoo 版本占位符。
 *
 * 为什么需要它：CDN 示例写在代码块里，而 **VitePress 不会对代码块做 Vue 插值**，
 * `{{ }}` 在这里不可用 —— 于是沿用客户端产物同名的占位符 `__TWIKOO_VERSION__`
 * （见 `packages/shared/src/version.ts`），由下面的 markdown-it 规则在**构建时**替换。
 *
 * 版本来源与 `theme/Twikoo.vue` 完全一致，都由 `.github/workflows/docs.yml` 注入：
 *   - release 触发 → 发布 tag（本仓库 tag 即 twikoo 版本号）
 *   - push `docs/**` / 手动触发 → registry 最新稳定版（`npm view twikoo version`）
 * 本地未注入时回退 `latest`（不写死版本号，避免又变成"发版必须改文档"）。
 */
const TWIKOO_VERSION_PLACEHOLDER = "__TWIKOO_VERSION__";
const twikooVersion = process.env.VITE_TWIKOO_VERSION || "latest";

/** markdown-it token 的最小子集（只用到 content / children，避免引入其类型包） */
interface VersionToken {
  content?: string;
  children?: VersionToken[] | null;
}

/**
 * 递归替换 token 内容里的版本占位符（fence / code_inline / text 都会命中）。
 * @param tokens markdown-it token 列表
 */
function replaceVersionPlaceholder(tokens: VersionToken[]): void {
  for (const token of tokens) {
    if (token.content && token.content.includes(TWIKOO_VERSION_PLACEHOLDER)) {
      token.content = token.content.split(TWIKOO_VERSION_PLACEHOLDER).join(twikooVersion);
    }
    if (token.children?.length) replaceVersionPlaceholder(token.children);
  }
}

// https://vitepress.dev/reference/site-config
export default defineConfig({
  markdown: {
    /**
     * 构建时把 `__TWIKOO_VERSION__` 换成上面解析出的版本（见文件头说明）。
     * @param md markdown-it 实例
     */
    config(md) {
      md.core.ruler.push("twikoo-version-placeholder", (state) => {
        replaceVersionPlaceholder(state.tokens);
      });
    },
  },
  head: [
    ["link", { rel: "icon", href: "/twikoo-logo-mini.png" }],
    ["meta", { name: "theme-color", content: "#007aff" }],
  ],
  locales: {
    root: {
      label: "简体中文",
      lang: "zh-CN",
      link: "/",
      title: "Twikoo 文档",
      description: "一个简洁、安全、免费的静态网站评论系统",
      themeConfig: {
        sidebar: [
          { text: "简介", link: "/intro" },
          { text: "快速上手", link: "/quick-start" },
          { text: "MongoDB Atlas", link: "/mongodb-atlas" },
          { text: "云函数部署", link: "/backend" },
          { text: "前端部署", link: "/frontend" },
          { text: "版本更新", link: "/update" },
          { text: "常见问题", link: "/faq" },
          { text: "API 文档", link: "/api" },
          { text: "相关文档", link: "/link" },
        ],
        editLink: {
          pattern: "https://github.com/twikoojs/twikoo/edit/main/docs/:path",
          text: "在 GitHub 上编辑此页面",
        },
        footer: {
          message: "基于 MIT 许可发布",
          copyright: `版权所有 © 2020 至今 iMaeGoo`,
        },
        docFooter: {
          prev: "上一篇",
          next: "下一篇",
        },
        outline: {
          label: "本页导航",
        },
        lastUpdated: {
          text: "最后更新于",
          formatOptions: {
            dateStyle: "short",
            timeStyle: "medium",
          },
        },
        langMenuLabel: "多语言",
        returnToTopLabel: "回到顶部",
        sidebarMenuLabel: "菜单",
        darkModeSwitchLabel: "主题",
        lightModeSwitchTitle: "切换到浅色模式",
        darkModeSwitchTitle: "切换到深色模式",
      },
    },
    en: {
      label: "English (US)",
      lang: "en",
      link: "/en/",
      title: "Twikoo Docs",
      description: "A simple, safe, free comment system",
      themeConfig: {
        sidebar: [
          { text: "Introduction", link: "/en/intro" },
          { text: "Quick start", link: "/en/quick-start" },
          { text: "MongoDB Atlas", link: "/en/mongodb-atlas" },
          { text: "Serverless deployment", link: "/en/backend" },
          { text: "Frontend deployment", link: "/en/frontend" },
          { text: "Update", link: "/en/update" },
          { text: "FAQ", link: "/en/faq" },
          { text: "API", link: "/en/api" },
          { text: "Links", link: "/en/link" },
        ],
      },
    },
  },
  themeConfig: {
    logo: {
      src: "/twikoo-logo-mini.png",
      width: 24,
      height: 24,
    },
    search: {
      provider: "algolia",
      options: {
        appId: "TM627WNO90",
        apiKey: "f81194a47bc4be7984df25fc480c60a7",
        indexName: "twikoo",
      },
    },
    socialLinks: [{ icon: "github", link: "https://github.com/twikoojs/twikoo" }],
    editLink: {
      pattern: "https://github.com/twikoojs/twikoo/edit/main/docs/:path",
    },
    footer: {
      message: "Released under the MIT License.",
      copyright: "Copyright © 2020-present iMaeGoo",
    },
  },
  lastUpdated: true,
});
