import { app } from '../../view'

const PRISM_CDN = 'https://cdn.staticfile.org/prism/1.28.0'
let Prism
let cssEl

const renderCode = (el, theme) => {
  const prismCdn = (app && app.$twikoo.prismCdn) ? app.$twikoo.prismCdn : PRISM_CDN
  window.Prism = window.Prism || {}
  window.Prism.manual = true
  if (!Prism) {
    Prism = require('prismjs')
    require('prismjs/plugins/autoloader/prism-autoloader')
    Prism.plugins.autoloader.languages_path = `${prismCdn}/components/`
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
