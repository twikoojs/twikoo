import Prism from 'prismjs'
import 'prismjs/plugins/autoloader/prism-autoloader'

const PRISM_CDN = 'https://cdn.jsdelivr.net/npm/prismjs@1.22.0'
let cssEl

Prism.plugins.autoloader.languages_path = `${PRISM_CDN}/components/`

const renderCode = (el, theme) => {
  loadCss(theme)
  Prism.highlightAllUnder(el)
}

const loadCss = (theme) => {
  if (cssEl || !theme || theme === 'none') return
  cssEl = document.createElement('link')
  if (theme === 'default') {
    cssEl.href = `${PRISM_CDN}/themes/prism.css`
  } else {
    cssEl.href = `${PRISM_CDN}/themes/prism-${theme}.css`
  }
  cssEl.rel = 'stylesheet'
  cssEl.type = 'text/css'
  document.getElementById('twikoo').appendChild(cssEl)
}

export default renderCode
