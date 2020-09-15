module.exports = {
  title: 'Twikoo 中文文档',
  description: 'Twikoo 中文文档',
  themeConfig: {
    sidebar: [
      '/',
      '/quick-start',
      '/configuration',
      '/faq'
    ],
    lastUpdated: true,
    // 假定是 GitHub. 同时也可以是一个完整的 GitLab URL
    repo: 'imaegoo/twikoo',
    // 假如文档不是放在仓库的根目录下：
    docsDir: 'docs',
    // 假如文档放在一个特定的分支下：
    docsBranch: 'dev',
    // 默认是 false, 设置为 true 来启用
    editLinks: true
  }
}
