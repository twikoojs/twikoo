const { defaultTheme } = require('@vuepress/theme-default')
const { path } = require('@vuepress/utils')

/**
 * 继承 VuePress 默认主题，并在 page-bottom 插槽中显示评论区
 * https://v2.vuepress.vuejs.org/zh/reference/default-theme/extending.html
 */
module.exports = (options) => {
  return {
    name: 'vuepress-theme-twikoo',
    extends: defaultTheme(options),
    layouts: {
      Layout: path.resolve(__dirname, 'layouts/Layout.vue'),
    }
  }
}
