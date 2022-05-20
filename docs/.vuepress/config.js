const { searchPlugin } = require('@vuepress/plugin-search')
const twikooTheme = require('./theme')

module.exports = {
  locales: {
    // 键名是该语言所属的子路径
    // 作为特例，默认语言可以使用 '/' 作为其路径。
    '/': {
      lang: 'zh-CN',
      title: 'Twikoo 文档',
      description: 'Twikoo 文档'
    },
    '/en/': {
      lang: 'en-US',
      title: 'Twikoo Docs',
      description: 'Twikoo Docs'
    }
  },
  theme: twikooTheme({
    locales: {
      '/': {
        selectLanguageName: '简体中文',
        sidebar: [
          { text: '简介', link: '/' },
          '/quick-start',
          '/faq',
          '/api',
          '/link'
        ]
      },
      '/en/': {
        selectLanguageName: 'English',
        sidebar: [
          { text: 'Introduction', link: '/en/' },
          '/en/quick-start',
          '/en/faq',
          '/en/api'
        ]
      }
    },
    lastUpdated: true,
    // 假定是 GitHub. 同时也可以是一个完整的 GitLab URL
    repo: 'imaegoo/twikoo',
    // 假如文档不是放在仓库的根目录下：
    docsDir: 'docs',
    // 假如文档放在一个特定的分支下：
    docsBranch: 'main',
  }),
  plugins: [
    searchPlugin({})
  ]
}
