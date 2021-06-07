const i18n = {
  'zh-CN': require('./zh-CN.json'),
  'zh-HK': require('./zh-HK.json'),
  'zh-TW': require('./zh-TW.json'),
  'en-US': require('./en-US.json'),
  'en-GB': require('./en-GB.json')
}

const translate = (key, language) => {
  const lang = language || navigator.language
  let value
  if (lang && i18n[lang]) {
    value = i18n[lang][key]
  } else {
    value = i18n['zh-CN'][key]
  }
  return value || ''
}

export default translate
