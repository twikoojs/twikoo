import i18n from './i18n'

const langs = {
  'zh-CN': 0,
  'zh-HK': 1,
  'zh-TW': 2,
  'en-US': 3,
  'en-GB': 3
}

const translate = (key, language) => {
  const lang = language || navigator.language
  let value
  if (lang && langs[lang]) {
    value = i18n[key][langs[lang]]
  } else {
    value = i18n[key][langs['zh-CN']]
  }
  return value || ''
}

export default translate
