const twikooTheme = require('./theme')

module.exports = {
  lang: 'zh-cn',
  theme: twikooTheme({
    locales: {
      '/en/': {
      sidebar: [
        { text: 'Introduction', link: '/en/' },
        { text: '英文文档正在搭建 实际请参考中文文档', link: '/' },
        { text: 'The English document is being built. Please refer to the Chinese document.', link: '/' },
      ],
      lastUpdated: true,
      // 假定是 GitHub. 同时也可以是一个完整的 GitLab URL
      repo: 'imaegoo/twikoo',
      // 假如文档不是放在仓库的根目录下：
      docsDir: 'docs/en',
      // 假如文档放在一个特定的分支下：
      docsBranch: 'main',},
      '/':{
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
      }
,    },
  }),
  locales: {
    // 键名是该语言所属的子路径
    // 作为特例，默认语言可以使用 '/' 作为其路径。
    '/en/': {
      lang: 'English-US',
      title: 'Twikoo Docs',
      description: 'Twikoo Docs',
    },
    '/index.html': {
      lang: '简体中文',
      title: 'Twikoo 文档',
      description: 'Twikoo 文档',
    },
    '/': {
      title: 'Twikoo 文档',
      description: 'Twikoo 文档',
    },
  },
}
