const twikooTheme = require('./theme')

module.exports = {
  lang: 'zh-CN',
  title: 'Twikoo 中文文档',
  description: 'Twikoo 中文文档',
  theme: twikooTheme({
    sidebar: [
      { text: '简介', link: '/' },
      '/quick-start',
      '/faq',
      '/api',
      '/link'
    ],
    lastUpdated: true,
    // 假定是 GitHub. 同时也可以是一个完整的 GitLab URL
    repo: 'imaegoo/twikoo',
    // 假如文档不是放在仓库的根目录下：
    docsDir: 'docs',
    // 假如文档放在一个特定的分支下：
    docsBranch: 'main',
  })
}
