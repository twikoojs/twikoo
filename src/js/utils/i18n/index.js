import i18n from './i18n'

// ISO Language Code Table http://www.lingoes.net/en/translator/langcode.htm
// RSS Language Code Table https://www.rssboard.org/rss-language-codes

const langs = {
  zh: 0,
  'zh-cn': 0,
  'zh-CN': 0,
  'zh-HK': 1,
  'zh-tw': 2,
  'zh-TW': 2,
  'en-us': 3,
  'en-US': 3,
  'en-gb': 3,
  'en-GB': 3,
  en: 3
}

let userLanguage = ''

const setLanguage = (options = {}) => {
  userLanguage = options.lang in langs ? options.lang : navigator.language
}

const translate = (key, language) => {
  const lang = language || userLanguage || navigator.language
  let value
  if (lang && langs[lang]) {
    value = i18n[key][langs[lang]]
  } else {
    value = i18n[key][langs['zh-CN']]
  }
  return value || ''
}

export default translate
export {
  setLanguage
}
