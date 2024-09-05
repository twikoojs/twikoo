import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  head: [
    ['link', { rel: 'icon', href: '/twikoo-logo-mini.png' }],
    ['meta', { name: 'theme-color', content: '#007aff' }]
  ],
  locales: {
    root: {
      label: '简体中文',
      lang: 'zh-CN',
      link: '/',
      title: 'Twikoo 文档',
      description: '一个简洁、安全、免费的静态网站评论系统',
      themeConfig: {
        sidebar: [
          { text: '简介', link: '/intro' },
          { text: '快速上手', link: '/quick-start' },
          { text: 'MongoDB Atlas', link: '/mongodb-atlas' },
          { text: '云函数部署', link: '/backend' },
          { text: '前端部署', link: '/frontend' },
          { text: '版本更新', link: '/update' },
          { text: '常见问题', link: '/faq' },
          { text: 'API 文档', link: '/api' },
          { text: '相关文档', link: '/link' }
        ],
        editLink: {
          pattern: 'https://github.com/twikoojs/twikoo/edit/main/docs/:path',
          text: '在 GitHub 上编辑此页面'
        },
        footer: {
          message: '基于 MIT 许可发布',
          copyright: `版权所有 © 2020 至今 iMaeGoo`
        },
        docFooter: {
          prev: '上一篇',
          next: '下一篇'
        },
        outline: {
          label: '本页导航'
        },
        lastUpdated: {
          text: '最后更新于',
          formatOptions: {
            dateStyle: 'short',
            timeStyle: 'medium'
          }
        },
        langMenuLabel: '多语言',
        returnToTopLabel: '回到顶部',
        sidebarMenuLabel: '菜单',
        darkModeSwitchLabel: '主题',
        lightModeSwitchTitle: '切换到浅色模式',
        darkModeSwitchTitle: '切换到深色模式'
      }
    },
    en: {
      label: 'English (US)',
      lang: 'en',
      link: '/en/',
      title: 'Twikoo Docs',
      description: 'A simple, safe, free comment system',
      themeConfig: {
        sidebar: [
          { text: 'Introduction', link: '/en/intro' },
          { text: 'Quick start', link: '/en/quick-start' },
          { text: 'FAQ', link: '/en/faq' },
          { text: 'API', link: '/en/api' }
        ]
      }
    }
  },
  themeConfig: {
    logo: {
      src: '/twikoo-logo-mini.png',
      width: 24,
      height: 24
    },
    search: {
      provider: 'algolia',
      options: {
        appId: 'TM627WNO90',
        apiKey: 'f81194a47bc4be7984df25fc480c60a7',
        indexName: 'twikoo'
      }
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/twikoojs/twikoo' }
    ],
    editLink: {
      pattern: 'https://github.com/twikoojs/twikoo/edit/main/docs/:path'
    },
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2020-present iMaeGoo'
    }
  },
  lastUpdated: true
})
