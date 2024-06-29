import { app } from '../view'

const PRISM_CDN = 'https://cdn.jsdelivr.net/npm/prismjs@1.28.0'
let Prism
let cssEl

const renderCode = (el, theme, plugins) => {
  const prismCdn = (app && app.$twikoo.prismCdn) ? app.$twikoo.prismCdn : PRISM_CDN
  window.Prism = window.Prism || {}
  window.Prism.manual = true
  if (!Prism) {
    Prism = require('prismjs')
    require('prismjs/plugins/autoloader/prism-autoloader')
    Prism.plugins.autoloader.languages_path = `${prismCdn}/components/`
    if (plugins) {
      require('prismjs/plugins/toolbar/prism-toolbar')
      plugins.split(',').map(item => { return item.trim() }).forEach(p => {
        if (p === 'showLanguage') {
          require('prismjs/plugins/show-language/prism-show-language')
        } else if (p === 'copyButton') {
          require('prismjs/plugins/copy-to-clipboard/prism-copy-to-clipboard')
        }
      })
    }
  }
  loadCss(theme, prismCdn)
  Prism.highlightAllUnder(el)
}

const loadCss = (theme, prismCdn) => {
  const twikooEl = document.getElementById('twikoo')
  if ((cssEl && twikooEl.contains(cssEl)) || !theme || theme === 'none') return
  cssEl = document.createElement('link')
  if (theme === 'default') {
    cssEl.href = `${prismCdn}/themes/prism.min.css`
  } else {
    cssEl.href = `${prismCdn}/themes/prism-${theme}.min.css`
  }
  cssEl.rel = 'stylesheet'
  cssEl.type = 'text/css'
  twikooEl.appendChild(cssEl)
}

export default renderCode
