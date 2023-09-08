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
          { text: '云函数部署', link: '/backend' },
          { text: '前端部署', link: '/frontend' },
          { text: '版本更新', link: '/update' },
          { text: '常见问题', link: '/faq' },
          { text: 'API 文档', link: '/api' },
          { text: '相关文档', link: '/link' }
        ]
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
