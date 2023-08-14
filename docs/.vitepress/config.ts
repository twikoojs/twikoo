import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  locales: {
    root: {
      label: '简体中文',
      lang: 'zh-CN',
      title: 'Twikoo 文档',
      description: 'Twikoo 文档',
      themeConfig: {
        sidebar: [
          { text: '简介', link: '/' },
          { text: '快速上手', link: '/quick-start' },
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
      description: 'Twikoo Docs',
      themeConfig: {
        sidebar: [
          { text: 'Introduction', link: '/en/' },
          { text: 'Quick start', link: '/en/quick-start' },
          { text: 'FAQ', link: '/en/faq' },
          { text: 'API', link: '/en/api' }
        ]
      }
    }
  },
  themeConfig: {
    search: {
      provider: 'algolia',
      options: {
        appId: 'TM627WNO90',
        apiKey: 'f81194a47bc4be7984df25fc480c60a7',
        indexName: 'twikoo'
      }
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/imaegoo/twikoo' }
    ],
    editLink: {
      pattern: 'https://github.com/imaegoo/twikoo/edit/main/docs/:path'
    }
  },
  lastUpdated: true
})
