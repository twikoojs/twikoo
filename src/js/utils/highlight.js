const PRISM_CDN = 'https://cdn.jsdelivr.net/npm/prismjs@1.23.0'
let Prism
let cssEl

const renderCode = (el, theme) => {
  window.Prism = window.Prism || {}
  window.Prism.manual = true
  if (!Prism) {
    Prism = require('prismjs')
    require('prismjs/plugins/autoloader/prism-autoloader')
    Prism.plugins.autoloader.languages_path = `${PRISM_CDN}/components/`
  }
  loadCss(theme)
  Prism.highlightAllUnder(el)
}

const loadCss = (theme) => {
  const twikooEl = document.getElementById('twikoo')
  if ((cssEl && twikooEl.contains(cssEl)) || !theme || theme === 'none') return
  cssEl = document.createElement('link')
  if (theme === 'default') {
    cssEl.href = `${PRISM_CDN}/themes/prism.css`
  } else {
    cssEl.href = `${PRISM_CDN}/themes/prism-${theme}.css`
  }
  cssEl.rel = 'stylesheet'
  cssEl.type = 'text/css'
  twikooEl.appendChild(cssEl)
}

export default renderCode
