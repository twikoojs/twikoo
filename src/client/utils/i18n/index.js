import i18n, { idI18n } from './i18n'

// ISO Language Code Table http://www.lingoes.net/en/translator/langcode.htm
// RSS Language Code Table https://www.rssboard.org/rss-language-codes

const langs = {
  zh: 0,
  'zh-cn': 0,
  'zh-hk': 1,
  'zh-tw': 2,

  en: 3,
  'en-us': 3,
  'en-gb': 3,

  uz: 4,
  'uz-uz': 4,

  ja: 5,
  'ja-jp': 5,

  ko: 6,
  'ko-kr': 6,

  vi: 7,
  'vi-vn': 7,

  id: 8,
  'id-id': 8,
  indonesia: 8,
  indonesian: 8
}

const defaultLanguage = 'id'
let twikooLangOption = ''

const hasLang = (lang) => {
  return Object.prototype.hasOwnProperty.call(langs, lang)
}

const setLanguage = (options = {}) => {
  const lang = options.lang?.toLowerCase()

  if (lang && hasLang(lang)) {
    twikooLangOption = lang
  }
}

const translate = (key, language) => {
  const lang = (
    language ||
    twikooLangOption ||
    navigator.language ||
    defaultLanguage
  ).toLowerCase()

  const langIndex = hasLang(lang)
    ? langs[lang]
    : langs[defaultLanguage]

  if (langIndex === langs.id && Object.prototype.hasOwnProperty.call(idI18n, key)) {
    return idI18n[key]
  }

  return i18n[key]?.[langIndex] || i18n[key]?.[langs.en] || ''
}

export default translate
export {
  setLanguage
}
