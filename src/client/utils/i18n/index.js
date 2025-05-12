import i18n from './i18n'

// ISO Language Code Table http://www.lingoes.net/en/translator/langcode.htm
// RSS Language Code Table https://www.rssboard.org/rss-language-codes

const langs = {
  zh: 0,
  'zh-cn': 0,
  'zh-hk': 1,
  'zh-tw': 2,
  'en-us': 3,
  'en-gb': 3,
  en: 3,
  uz: 4,
  'uz-uz': 4,
  ja: 5,
  'ja-jp': 5,
  ko: 6,
  'ko-kr': 6
}

const defaultLanguage = 'zh-cn'
let twikooLangOption = ''

const setLanguage = (options = {}) => {
  if (options.lang && options.lang.toLowerCase() in langs) {
    twikooLangOption = options.lang
  }
}

const translate = (key, language) => {
  // 优先级: translate 入参 > twikoo.init 入参 > 浏览器语言设置 > 默认语言
  const lang = (language || twikooLangOption || navigator.language).toLowerCase()
  let value
  if (lang && langs[lang]) {
    value = i18n[key][langs[lang]]
  } else {
    value = i18n[key][langs[defaultLanguage]]
  }
  return value || ''
}

export default translate
export {
  setLanguage
}
