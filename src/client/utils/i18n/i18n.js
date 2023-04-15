/* eslint-disable no-template-curly-in-string */

/**
 * 把 i18n 的 key 中相同的部分提取出来可以减小打包 js 的体积
 */
const S = {
  AC: 'ADMIN_COMMENT',
  ACC: 'ADMIN_CONFIG_CATEGORY',
  ACI: 'ADMIN_CONFIG_ITEM',
  AI: 'ADMIN_IMPORT'
}

const pushooChannels = [
  'qmsg',
  'serverchan',
  'pushplus',
  'pushplushxtrip',
  'dingtalk',
  'wecom',
  'bark',
  'gocqhttp',
  'atri',
  'pushdeer',
  'igot',
  'telegram',
  'feishu'
].map(s => `"${s}"`)

const smtpServices = [
  '126',
  '163',
  '1und1',
  'AOL',
  'DebugMail',
  'DynectEmail',
  'FastMail',
  'GandiMail',
  'Gmail',
  'Godaddy',
  'GodaddyAsia',
  'GodaddyEurope',
  'Hotmail',
  'Mail.ru',
  'Maildev',
  'Mailgun',
  'Mailjet',
  'Mailosaur',
  'Mandrill',
  'Naver',
  'OpenMailBox',
  'Outlook365',
  'Postmark',
  'QQ',
  'QQex',
  'SES',
  'SES-EU-WEST-1',
  'SES-US-EAST-1',
  'SES-US-WEST-2',
  'SendCloud',
  'SendGrid',
  'SendPulse',
  'SendinBlue',
  'Sparkpost',
  'Yahoo',
  'Yandex',
  'Zoho',
  'hot.ee',
  'iCloud',
  'mail.ee',
  'qiye.aliyun'
].map(s => `"${s}"`)

const highlightThemes = [
  'default',
  'coy',
  'dark',
  'funky',
  'okaidia',
  'solarizedlight',
  'tomorrow',
  'twilight'
].map(s => `"${s}"`)

const imageBedServices = [
  'qcloud',
  '7bu',
  'https://7bu.top',
  'smms'
].map(s => `"${s}"`)

const defaultGravatar = [
  '404',
  'mp',
  'identicon',
  'monsterid',
  'wavatar',
  'retro',
  'robohash',
  'blank'
].map(s => `"${s}"`)

/**
 * 把所有语言翻译放在同一对象下可以减小打包 js 的体积 (~17kb)
 *
 * [key]: [
 *   'zh-CN',
 *   'zh-HK', // Contributor: [Jerry Wong](https://github.com/jerryc127)
 *   'zh-TW', // Contributor: [Jerry Wong](https://github.com/jerryc127), [kuohuanhuan](https://github.com/kuohuanhuan)
 *   'en'     // Contributor: [PCloud](https://github.com/HEIGE-PCloud)
 *   'uz-UZ'  // Contributor: [Nomad](https://github.com/digitaltwinz)
 * ]
 */
export default {
  ADMIN_CLIENT_VERSION: [
    '前端版本：',
    '前端版本：',
    '前端版本：',
    'Client version: '
    'Клиент версияси: '
  ],
  ADMIN_SERVER_VERSION: [
    '云函数版本：',
    '云函數版本：',
    '雲端函式版本：',
    'Server version: '
    'Сервернинг версияси: '
  ],
  [S.AC]: [
    '评论管理',
    '評論管理',
    '留言管理',
    'Comment'
    'Изоҳ'
  ],
  [S.AC + '_DELETE']: [
    '删除',
    '刪除',
    '移除',
    'Delete'
    'Ўчирмоқ'
  ],
  [S.AC + '_DELETE_CONFIRM']: [
    '确认删除？',
    '確認刪除？',
    '確認移除？',
    'Confirm deletion?'
    'Ўчириш тасдиқлансинми?'
  ],
  [S.AC + '_FILTER_ALL']: [
    '全部',
    '全部',
    '全部',
    'All'
    'Ҳаммаси'
  ],
  [S.AC + '_FILTER_VISIBLE']: [
    '只看可见',
    '只看可見',
    '只看可見',
    'Visible'
    'Кўринадиган'
  ],
  [S.AC + '_FILTER_HIDDEN']: [
    '只看隐藏',
    '只看隱藏',
    '只看隱藏',
    'Hidden'
    'Яширилган'
  ],
  [S.AC + '_HIDE']: [
    '隐藏',
    '隱藏',
    '隱藏',
    'Hide'
    'Яшириш'
  ],
  [S.AC + '_IS_SPAM_SUFFIX']: [
    ' (已隐藏)',
    ' (已隱藏)',
    ' (已隱藏)',
    ' (Hidden)'
    ' (Яширилган)'
  ],
  [S.AC + '_SEARCH']: [
    '搜索',
    '搜索',
    '搜尋',
    'Search'
    'Излаш'
  ],
  [S.AC + '_SEARCH_PLACEHOLDER']: [
    '搜索昵称、邮箱、网址、IP、评论正文、文章地址',
    '搜索暱稱、郵箱、網址、IP、評論正文、文章地址',
    '搜索暱稱、郵件、網址、IP、留言正文、文章路徑',
    'Search by nick, mail, website, IP, comment, or article path'
    'Тахаллус, почта, веб-сайт, ИП, шарҳ ёки мақола йўли бўйича излаш'
  ],
  [S.AC + '_SHOW']: [
    '显示',
    '顯示',
    '顯示',
    'Show'
    'Кўрсатиш'
  ],
  [S.AC + '_TOP']: [
    '置顶',
    '置頂',
    '置頂',
    'Pin'
    'Қадамоқ'
  ],
  [S.AC + '_UNTOP']: [
    '取消置顶',
    '取消置頂',
    '取消置頂',
    'Unpin'
    'Қадоқни ечмоқ'
  ],
  [S.AC + '_VIEW']: [
    '查看',
    '查看',
    '檢視',
    'View'
    'Кўриниш'
  ],
  ADMIN_CONFIG: [
    '配置管理',
    '配置管理',
    '設定值管理',
    'Configuration'
    'Конфигурация'
  ],
  [S.ACC + '_COMMON']: [
    '通用',
    '通用',
    '一般',
    'General'
    'Умумий'
  ],
  [S.ACC + '_IM']: [
    '即时通知',
    '即時通知',
    '即時通知',
    'Instant notification'
    'Тезкор хабарнома'
  ],
  [S.ACC + '_MAIL']: [
    '邮件通知',
    '郵件通知',
    '郵件通知',
    'Email notification'
    'Электрон почта хабарномаси'
  ],
  [S.ACC + '_PLUGIN']: [
    '插件',
    '插件',
    '擴充功能',
    'Plugin'
    'Плагин'
  ],
  [S.ACC + '_PRIVACY']: [
    '隐私',
    '隱私',
    '隱私權',
    'Privacy'
    'Шахсий қоидалар'
  ],
  [S.ACC + '_SPAM']: [
    '反垃圾',
    '反垃圾',
    '防垃圾',
    'Spam'
    'Спам'
  ],
  ADMIN_CONFIG_EMAIL_TEST: [
    '邮件通知测试',
    '郵件通知測試',
    '郵件通知測試',
    'Email notification test'
    'Электрон почта хабарномаси тести'
  ],
  ADMIN_CONFIG_EMAIL_TEST_BTN: [
    '发送测试邮件',
    '發送測試郵件',
    '發送測試郵件',
    'Send test mail'
    'Синов хатини юбориш'    
  ],
  ADMIN_CONFIG_EMAIL_TEST_HELP: [
    '输入一个邮箱地址，发送测试邮件',
    '輸入一個郵箱位址，發送測試郵件',
    '輸入一個郵箱帳號，發送測試郵件',
    'Input an email address & send test mail'
    'Э-почта манзилини киритинг ва синов хатини юборинг'
  ],
  ADMIN_CONFIG_EMAIL_TEST_RESULT: [
    '测试结果：',
    '測試結果：',
    '測試結果：',
    'Test result: '
    'Тест натижаси: '
  ],
  ADMIN_CONFIG_EXAMPLE: [
    '示例：',
    '示例：',
    '範例：',
    'Example: '
    'Намуна: '
  ],
  [S.ACI + '_AKISMET_KEY']: [
    'Akismet 反垃圾评论，用于垃圾评论检测，设为 "MANUAL_REVIEW" 开启人工审核，留空不使用反垃圾。注册：https://akismet.com',
    'Akismet 反垃圾評論，用於垃圾評論檢測，設為 "MANUAL_REVIEW" 開啟人工審核，留空不使用反垃圾。註冊：https://akismet.com',
    'Akismet 防垃圾留言，用於垃圾留言檢測，設為 "MANUAL_REVIEW" 以開啟人工審核，留空則不使用防垃圾。註冊：https://akismet.com',
    'Akismet spam protection. Set to "MANUAL_REVIEW" to enable manual review. Leave it blank to not use anti-spam. Register Akismet: https://akismet.com'
    'Акисмет спам ҳимояси. Қўлда кўриб чиқишни ёқиш учун "MANUAL_REVIEW" га созланг. Анти-спамдан фойдаланмаслик учун уни бўш қолдиринг. Акисметни рўйхатдан ўтказиш: https://akismet.com'
  ],
  [S.ACI + '_BLOGGER_NICK']: [
    '博主的昵称。',
    '博主的昵稱。',
    '站長的暱稱。', // 「部落客」才是台灣對於「博主」的稱呼，音譯 "Blogger"。但此處用「站長」意譯 "Admin"。
    'Admin nick name.'
    'Админ исми.'
  ],
  [S.ACI + '_BLOGGER_EMAIL']: [
    '博主的邮箱地址，用于邮件通知、博主标识。',
    '博主的郵箱地址，用於郵件通知、博主標識。',
    '站長的郵箱帳號，用於郵件通知、站長認證。',
    'Admin Email address. Used for Email notification and admin identification.'
    'Админ электрон почта манзили. Электрон почта хабарномаси ва администратор идентификацияси учун фойдаланилади.'
  ],
  [S.ACI + '_COMMENT_BG_IMG']: [
    '评论框自定义背景图片 URL 地址。',
    '評論框自定義背景圖片 URL 地址。',
    '留言區塊自訂背景圖片 URL 網址。',
    'URL for custom background image.'
    'Махсус фон расми учун УРЛ.'
  ],
  [S.ACI + '_COMMENT_PAGE_SIZE']: [
    '评论列表分页大小，默认为 8。',
    '評論列表分頁大小，預設為 8。',
    '留言列表分頁大小，預設為 8。',
    'Comment page size. Default: 8.'
    'Изоҳ саҳифаси ўлчами. Стандарт: 8.'
  ],
  [S.ACI + '_COMMENT_PLACEHOLDER']: [
    '评论框提示信息，可用<br>换行，默认为空',
    '評論框提示信息，可用<br>換行，預設為空',
    '留言區塊提示資訊，可用<br>換行，預設空白',
    'Comment placeholder. Use <br> to start a newline. Default: empty.'
    'Изоҳ тўлдирувчиси. Янги қаторни бошлаш учун <бр> дан фойдаланинг. Стандарт: бўш.'
  ],
  [S.ACI + '_CORS_ALLOW_ORIGIN']: [
    'Vercel CORS 安全域名，注意：错误设置会导致无法加载，默认为空，格式为 https://blog.example.com；如需添加多域名请使用,分隔',
    'Vercel CORS 安全域名，注意：错误设置会导致无法加載，默認為空，格式为 https://blog.example.com；如需添加多域名請使用,分隔',
    'Vercel CORS 安全網域，注意：設定錯誤將會導致載入失敗，預設空白，格式應為 https://blog.example.com；如需添加多域名請使用,分隔',
    'Vercel CORS allow origin, note: incorrect settings can cause loading failure. Default: blank, format: https://blog.example.com; If you need to add multiple domain names, please use, separate'
    'Версел СОРС келиб чиқишига рухсат беради, эътибор беринг: нотўғри созламалар юклашда хатоликка олиб келиши мумкин. Стандарт: бўш, формат: https://blog.example.com; Агар сиз бир нечта домен номларини қўшмоқчи бўлсангиз, илтимос, ажратишдан фойдаланинг.'
  ],
  [S.ACI + '_DEFAULT_GRAVATAR']: [
    `默认的头像显示。默认值为 "identicon"，可选：${defaultGravatar.join('、')}`,
    `預設的頭像顯示。預設值為 "identicon"，可選：${defaultGravatar.join('、')}`,
    `預設的大頭貼照圖示。預設值為 "identicon"，選項：${defaultGravatar.join('、')}`,
    `Avatar placeholder. Default:  "identicon". Choose from: ${defaultGravatar.join(', ')}`
    `Аватар тўлдирувчиси. Стандарт: «идентификатор». Қуйидагилардан танланг: ${defaultGravatar.join(', ʼ)}`
  ],
  [S.ACI + '_EMOTION_CDN']: [
    '表情 CDN，默认为：https://owo.imaegoo.com/owo.json',
    '表情 CDN，預設為：https://owo.imaegoo.com/owo.json',
    '表情 CDN 來源，預設為：https://owo.imaegoo.com/owo.json',
    'Emotion CDN. Default: https://owo.imaegoo.com/owo.json'
    'Emotion CDN. Default: https://owo.imaegoo.com/owo.json'
  ],
  [S.ACI + '_FORBIDDEN_WORDS']: [
    '违禁词配置，包含违禁词的内容会直接标记为垃圾评论。英文逗号分隔。',
    '違禁詞配置，包含違禁詞的內容會直接標記為垃圾評論。英文逗號分隔。',
    '禁用詞語設定，包含禁用詞語的內容會直接標記為垃圾留言。使用英文逗號分隔。',
    'Configure prohibited words. Comments containing prohibited words will be auto spammed. Separate by comma.'
    'Тақиқланган сўзларни созланг. Тақиқланган сўзларни ўз ичига олган шарҳлар автоматик равишда спамга юборилади. Вергул билан ажратинг.'
  ],
  [S.ACI + '_GRAVATAR_CDN']: [
    '自定义头像 CDN 地址。如：cn.gravatar.com, cravatar.cn, sdn.geekzu.org, gravatar.loli.net，默认：cravatar.cn',
    '自定義頭像 CDN 地址。如：cn.gravatar.com, cravatar.cn, sdn.geekzu.org, gravatar.loli.net，預設：cravatar.cn',
    '自訂大頭貼照 CDN 來源。如：cn.gravatar.com, cravatar.cn, sdn.geekzu.org, gravatar.loli.net，預設：cravatar.cn',
    'Custom avator CDN. (Examples: gravatar.com) Default: cravatar.cn.'
    'Custom avator CDN. (Мисоллар: gravatar.com) Default: cravatar.cn.'
  ],
  [S.ACI + '_HIDE_ADMIN_CRYPT']: [
    '隐藏管理面板入口。可设置一个“暗号”，只有在“昵称”一栏输入相同的“暗号”时，管理面板入口才会显示，留空则不隐藏管理入口',
    '隱藏管理面板入口。可設定一個“暗號”，只有在“暱稱”一欄輸入相同的“暗號”時，管理面板入口才會顯示，留空則不隱藏管理入口',
    '隱藏管理控制台入口。可設定一個“暗號”，只有在「暱稱」一欄輸入相同的「暗號」時，管理控制台入口才會顯示，留白則不隱藏管理入口',
    'Set a cipher to hide the management panel entrance, only when the same cipher is entered in the nickname field the management panel entry will be displayed. Leave it blank to not hide the management entrance.'
    'Бошқарув панелига киришни яшириш учун шифрни ўрнатинг, фақат тахаллус майдонига худди шу шифр киритилганда бошқарув панелидаги ёзув кўрсатилади. Бошқарув киришини яширмаслик учун уни бўш қолдиринг.'
  ],
  [S.ACI + '_HIGHLIGHT']: [
    '启用代码高亮功能。如果您的主题和代码高亮有冲突，请设为 false。默认：true',
    '啟用代碼高亮功能。如果您的主題和代碼高亮有衝突，請設為 false。預設：true',
    '啟用程式碼醒目顯示功能。如果您的主題和此功能發生衝突，請設定為 false。預設：true',
    'Enable code highlighting. If your theme conflicts with code highlighting, please set it to false. Default: true.'
    'Кодни ажратиб кўрсатишни ёқинг. Агар мавзуингиз кодни ажратиб кўрсатишга зид бўлса, уни «фалсе» га ўрнатинг. Стандарт: рост.'
  ],
  [S.ACI + '_HIGHLIGHT_THEME']: [
    `代码高亮主题，可选：${highlightThemes.join('、')}，访问 https://prismjs.com 可预览主题效果。如果您的主题和代码高亮有冲突，请设为 none。默认：none`,
    `代碼高亮主題，可選：${highlightThemes.join('、')}，訪問 https://prismjs.com 可預覽主題效果。如果您的主題和代碼高亮有衝突，請設為 none。預設：none`,
    `程式碼醒目顯示主題，選項：${highlightThemes.join('、')}，瀏覽 https://prismjs.com 可預覽主題效果。如果您的主題和此功能發生衝突，請設定為 none。預設：none`,
    `Code highlighting theme. Select from: ${highlightThemes.join(', ')}. Visit https://prismjs.com for preview. If your theme conflicts with code highlighting, please set it to none. Default: none.`
    `Кодни таъкидлаш мавзуси. Қуйидагилардан танланг: ${highlightThemes.join(', ʼ)}. Олдиндан кўриш учун https://prismjs.com сайтига ташриф буюринг. Агар мавзуингиз кодни ажратиб кўрсатишга зид бўлса, уни «Ҳеч» га ўрнатинг. Стандарт: йўқ.`
  ],
  [S.ACI + '_IMAGE_CDN']: [
    `插入图片所使用的图床，目前支持：${imageBedServices.join('、')}`,
    `插入圖片所使用的圖床，目前支持：${imageBedServices.join('、')}`,
    `插入圖片所使用的圖床，目前支援：${imageBedServices.join('、')}`,
    `The image bed for image uploading. Select from: ${imageBedServices.join(', ')}`
    `Расм юклаш учун расм тўшаги. Қуйидагилардан танланг: ${imageBedServices.join(', ʼ)}`
  ],
  [S.ACI + '_IMAGE_CDN_TOKEN']: [
    '图床 token。qcloud 图床无需设置',
    '图床 token。qcloud 图床无需设置',
    '圖床 token。qcloud 圖床不需設定',
    'The image bed token. Unnessessary for qcloud'
    'Тасвир токен белгиси. Қслоуд учун кераксиз'
  ],
  [S.ACI + '_LIMIT_PER_MINUTE']: [
    '单个 IP 发言频率限制（条/10分钟），0 为无限制，默认：10',
    '單個 IP 發言頻率限制（條/10分鐘），0 為無限制，預設：10',
    '單個 IP 留言頻率限制（則/10分鐘），0 為無限，預設：10',
    'How many comments can be posted by each IP every 10 minutes, 0 is unlimited, default: 10.'
    'Ҳар бир ИП ҳар 10 дақиқада қанча шарҳ қолдириши мумкин, 0 чексиз, стандарт: 10.'
  ],
  [S.ACI + '_LIMIT_PER_MINUTE_ALL']: [
    '全站发言频率限制（条/10分钟），0 为无限制，默认：10',
    '全站發言頻率限制（條/10分鐘），0 為無限制，預設：10',
    '全站留言頻率限制（則/10分鐘），0 為無限，預設：10',
    'How many comments can be posted by all IPs every 10 minutes, 0 is unlimited, default: 10.'
    'Барча ИП-лар ҳар 10 дақиқада қанча шарҳ қўйиши мумкин, 0 чексиз, стандарт: 10.'
  ],
  [S.ACI + '_LIMIT_LENGTH']: [
    '评论长度限制，0 为无限制，默认：500',
    '評論長度限制，0 為無限制，預設：500',
    '留言長度限制，0 為無限，預設：500',
    'Comment length limitation, 0 is unlimited, default: 500.'
    'Шарҳ узунлиги чеклови, 0 чексиз, стандарт: 500.'
  ],
  [S.ACI + '_MAIL_SUBJECT']: [
    '自定义通知邮件主题，留空则使用默认主题。',
    '自定義通知郵件主題，留空則使用預設主題。',
    '自訂通知郵件主題，留白則使用預設主題。',
    'Custom Email notification subject. Leave it blank to use the default subject.'
    'Махсус электрон почта хабарномаси мавзуси. Стандарт мавзуни ишлатиш учун уни бўш қолдиринг.'
  ],
  [S.ACI + '_MAIL_SUBJECT_ADMIN']: [
    '自定义博主通知邮件主题，留空则使用默认主题。',
    '自定義博主通知郵件主題，留空則使用預設主題。',
    '自訂站長通知郵件主題，留白則使用預設主題。',
    'Custom admin Email notification subject. Leave it blank to use the default subject.'
    'Махсус администратор электрон почта хабарномаси мавзуси. Стандарт мавзуни ишлатиш учун уни бўш қолдиринг.'
  ],
  [S.ACI + '_MAIL_TEMPLATE']: [
    '自定义通知邮件模板，留空则使用默认模板。可包含的字段：${SITE_URL}, ${SITE_NAME}, ${PARENT_NICK}, ${PARENT_COMMENT}, ${NICK}, ${COMMENT}, ${POST_URL}, ${IMG}, ${PARENT_IMG}',
    '自定義通知郵件模板，留空則使用預設模板。可包含的字段：${SITE_URL}, ${SITE_NAME}, ${PARENT_NICK}, ${PARENT_COMMENT}, ${NICK}, ${COMMENT}, ${POST_URL}, ${IMG}, ${PARENT_IMG}',
    '自訂通知郵件模板，留白則使用預設模板。可包含的欄位：${SITE_URL}, ${SITE_NAME}, ${PARENT_NICK}, ${PARENT_COMMENT}, ${NICK}, ${COMMENT}, ${POST_URL}, ${IMG}, ${PARENT_IMG}',
    'Custom Email notification template. Leave it blank to use the default template. Fields that can be included: ${SITE_URL}, ${SITE_NAME}, ${NICK}, ${COMMENT}, ${POST_URL}, ${IMG}, ${PARENT_IMG}'
    'Махсус электрон почта хабарномаси шаблони. Стандарт шаблонни ишлатиш учун уни бўш қолдиринг. Қўшилиши мумкин бўлган майдонлар:  ${SITE_URL}, ${SITE_NAME}, ${NICK}, ${COMMENT}, ${POST_URL}, ${IMG}, ${PARENT_IMG}'
  ],
  [S.ACI + '_MAIL_TEMPLATE_ADMIN']: [
    '自定义博主通知邮件模板，留空则使用默认模板。可包含的字段：${SITE_URL}, ${SITE_NAME}, ${NICK}, ${COMMENT}, ${POST_URL}, ${IP}, ${MAIL}, ${IMG}',
    '自定義博主通知郵件模板，留空則使用預設模板。可包含的字段：${SITE_URL}, ${SITE_NAME}, ${NICK}, ${COMMENT}, ${POST_URL}, ${IP}, ${MAIL}, ${IMG}',
    '自訂站長通知郵件模板，留白則使用預設模板。可包含的欄位：${SITE_URL}, ${SITE_NAME}, ${NICK}, ${COMMENT}, ${POST_URL}, ${IP}, ${MAIL}, ${IMG}',
    'Custom admin Email notification template. Leave it blank to use the default template. Fields that can be included: ${SITE_URL}, ${SITE_NAME}, ${NICK}, ${COMMENT}, ${POST_URL}, ${IP}, ${MAIL}, ${IMG}'
    'Махсус администратор электрон почта хабарномаси шаблони. Стандарт шаблонни ишлатиш учун уни бўш қолдиринг. Қўшилиши мумкин бўлган майдонлар:  ${SITE_URL}, ${SITE_NAME}, ${NICK}, ${COMMENT}, ${POST_URL}, ${IMG}, ${PARENT_IMG}'
  ],
  [S.ACI + '_MASTER_TAG']: [
    '博主标识自定义文字，默认为 “博主”。',
    '博主標識自定義文字，預設為 “博主”。',
    '站長認證自訂文字，預設為「博主」。', // 可能牽涉到程式碼層面，不做更動以免造成誤導。
    'Custom admin identifier.'
    'Махсус администратор идентификатори.'
  ],
  [S.ACI + '_NOTIFY_SPAM']: [
    '垃圾评论是否发送通知，默认：true',
    '垃圾評論是否發送通知，默認：true',
    '垃圾留言是否發送通知，預設：true',
    'Notifications for spam comments. Default: true.'
    'Спам шарҳлар учун билдиришномалар. Стандарт: рост.'
  ],
  [S.ACI + '_QCLOUD_SECRET_ID']: [
    '腾讯云 secret id，用于垃圾评论检测。同时设置腾讯云和 Akismet 时，只有腾讯云会生效。注册：https://twikoo.js.org/cms.html',
    '騰訊雲 secret id，用於垃圾評論檢測。同時設定騰訊雲和 Akismet 時，只有騰訊雲會生效。註冊：https://twikoo.js.org/cms.html',
    '騰訊雲 Secret ID，用於垃圾留言檢測。同時設定騰訊雲和 Akismet 時，只有騰訊雲會被啟用。註冊：https://twikoo.js.org/cms.html', // 「騰訊雲」是一家網路服務提供商，不改為「騰訊雲端」。
    'Tencent Cloud secret id for spam detection. When Tencent Cloud and Akismet are set at the same time, only Tencent Cloud will take effect. Register: https://twikoo.js.org/cms.html'
    'Спамни аниқлаш учун Тенсент Слоуд махфий идентификатори. Тенсент Слоуд ва Акисмет бир вақтнинг ўзида ўрнатилганда, фақат Тенсент Слоуд кучга киради. Рўйхатдан ўтиш: https://twikoo.js.org/cms.html'
  ],
  [S.ACI + '_QCLOUD_SECRET_KEY']: [
    '腾讯云 secret key',
    '騰訊雲 secret key',
    '騰訊雲 Secret Key',
    'Tencent Cloud secret key.'
    'Тенсент Клауд махфий калити.'
  ],
  [S.ACI + '_PUSHOO_CHANNEL']: [
    `即时消息推送平台名称，支持：${pushooChannels.join('、')} 等`,
    `即時消息推送平台名称，支持：${pushooChannels.join('、')} 等`,
    `即時訊息推送平台名稱，支援：${pushooChannels.join('、')} 等`,
    `IM notification push channel. Support: ${pushooChannels.join(', ')}`
    `ИМ билдиришномаси суриш канали. Қўллаб-қувватлаш: ${pushooChannels.join(', ')}`
  ],
  [S.ACI + '_PUSHOO_TOKEN']: [
    '即时消息推送 token。请参考 https://pushoo.js.org 里的详细说明配置',
    '即時消息推送 token。请参考 https://pushoo.js.org 里的详细说明配置',
    '即時訊息推送 Token。請参考 https://pushoo.js.org 裡的詳細說明進行設定',
    'IM notification push token. See https://pushoo.js.org for details'
    'ИМ билдиришномаси пуш токени. Тафсилотлар учун https://pushoo.js.org га қаранг'
  ],
  [S.ACI + '_REQUIRED_FIELDS']: [
    '评论必填信息，设为 nick,mail,link 代表全必填，设为 none 代表全选填，默认：nick,mail',
    '評論必填信息，設為 nick,mail,link 代表全必填，設為 none 代表全選填，預設：nick,mail',
    '留言必填資訊，設為 nick,mail,link 代表全必填，設為 none 代表全選填，預設：nick,mail',
    'Required fields for comments. Set to "nick,mail,link" means all fields are required. Set to "none" means all fields are optional. Default: nick,mail.'
    'Шарҳлар учун зарур майдонлар. «Ниск,маил,линк» га ўрнатилган бўлса, барча майдонлар талаб қилинади. «Йўқ» га ўрнатилиши барча майдонлар ихтиёрий эканлигини англатади. Стандарт: ник, почта.'
  ],
  [S.ACI + '_SC_MAIL_NOTIFY']: [
    '是否同时通过 IM 和邮件 2 种方式通知博主，默认只通过 IM 通知博主，默认：false',
    '是否同時通過 IM 和郵件 2 種方式通知博主，預設只通過 IM 通知博主，預設：false',
    '是否同時透過 IM 和郵件 2 種方式通知博主，預設只透過 IM 通知博主，預設：false',
    'Whether to notify admin via IM and email at the same time, the default is to notify admin only via IM. Default: false.'
    'Администраторни бир вақтнинг ўзида ИМ ва электрон почта орқали хабардор қилиш керакми, сукут бўйича администраторни фақат ИМ орқали хабардор қилиш керак. Стандарт: нотўғри.'
  ],
  [S.ACI + '_SENDER_EMAIL']: [
    '邮件通知邮箱地址。对于大多数邮箱服务商，SENDER_EMAIL 必须和 SMTP_USER 保持一致，否则无法发送邮件。',
    '郵件通知郵箱地址。對於大多數郵箱服務商，SENDER_EMAIL 必須和 SMTP_USER 保持一致，否則無法發送郵件。',
    '郵件通知郵箱帳號。對於大多數電郵服務提供商，SENDER_EMAIL 必須和 SMTP_USER 保持一致，否則無法傳送郵件。',
    'Email address for Email notification. For most email service providers, SENDER_EMAIL must be consistent with SMTP_USER, otherwise emails cannot be sent.'
    'Электрон почта хабарномаси учун электрон почта манзили. Аксарият электрон почта хизмати провайдерлари учун  SENDER_EMAIL билан мос келиши керак, акс ҳолда электрон почта хабарларини юбориб бўлмайди.'
  ],
  [S.ACI + '_SENDER_NAME']: [
    '邮件通知标题。',
    '郵件通知標題。',
    '郵件通知標題。',
    'The title for Email notification.'
    'Электрон почта хабарномаси сарлавҳаси.'
  ],
  [S.ACI + '_SHOW_EMOTION']: [
    '启用插入表情功能，默认为：true',
    '啟用插入表情功能，預設為：true',
    '啟用插入表情功能，預設為：true',
    'Enable emoticons. Default: true.'
    'Кулгичларни ёқинг. Стандарт: рост.'
  ],
  [S.ACI + '_SHOW_IMAGE']: [
    '启用插入图片功能，默认为：true',
    '啟用插入圖片功能，預設為：true',
    '啟用插入圖片功能，預設為：true',
    'Enable picture uploading. Default: true.'
    'Расм юклашни ёқинг. Стандарт: рост.'
  ],
  [S.ACI + '_SHOW_UA']: [
    '是否显示用户系统和浏览器，默认为：true',
    '是否顯示使用者系統和瀏覽器，預設為：true',
    '是否顯示使用者作業系統和瀏覽器，預設為：true',
    'Show users\' OS and browser. Default: true.'
    'Фойдаланувчиларнинг ОС ва браузерини кўрсатиш. Стандарт: рост.'
  ],
  [S.ACI + '_SHOW_REGION']: [
    '是否显示用户 IP 属地到省，默认为：false',
    '是否顯示使用者 IP 屬地到省，預設為：false',
    '是否顯示使用者 IP 所屬地（精確到省），預設為：false',
    'Show users\' IP region (province). Default: false.'
    'Фойдаланувчиларнинг ИП ҳудудини (вилоят) кўрсатиш. Стандарт: нотўғри.'
  ],
  [S.ACI + '_SITE_NAME']: [
    '网站名称',
    '網站名稱',
    '網站名稱',
    'Website name.'
    'Вебсайт номи.'
  ],
  [S.ACI + '_SITE_URL']: [
    '网站地址',
    '網站地址',
    '網站網址',
    'Website URL.'
    'Вебсайт URL.'
  ],
  [S.ACI + '_SMTP_HOST']: [
    '自定义 SMTP 服务器地址。如您已配置 SMTP_SERVICE，此项请留空。',
    '自定義 SMTP 伺服器地址。如您已配置 SMTP_SERVICE，此項請留空。',
    '自訂 SMTP 伺服器位址。如您已設定 SMTP_SERVICE，此項請留白。',
    'Custom SMTP server address. If you have configured SMTP_SERVICE, please leave it empty.'
    'Махсус СМТП сервер манзили. Агар сиз СМТП_СEРВИСE созлаган бўлсангиз, уни бўш қолдиринг.'
  ],
  [S.ACI + '_SMTP_PASS']: [
    '邮件通知邮箱密码，QQ、163邮箱请填写授权码。',
    '郵件通知郵箱密碼，QQ、163郵箱請填寫授權碼。',
    '郵件通知郵箱密碼，QQ、163 郵箱請填寫授權碼。',
    'Email notification mailbox password. Enter authorization code for QQ/163 mail.'
    'Электрон почта хабарномаси почта қутиси пароли. ҚҚ/163 почтаси учун авторизация кодини киритинг.'
  ],
  [S.ACI + '_SMTP_PORT']: [
    '自定义 SMTP 端口。如您已配置 SMTP_SERVICE，此项请留空。',
    '自定義 SMTP 端口。如您已配置 SMTP_SERVICE，此項請留空。',
    '自訂 SMTP 連接埠。如您已設定 SMTP_SERVICE，此項請留白。',
    'Custom SMTP port. If you have configured SMTP_SERVICE, please leave it empty.'
    'Махсус СМТП порти. Агар сиз СМТП_СEРВИС созлаган бўлсангиз, уни бўш қолдиринг.'
  ],
  [S.ACI + '_SMTP_SECURE']: [
    '自定义 SMTP 是否使用TLS，请填写 true 或 false。如您已配置 SMTP_SERVICE，此项请留空。',
    '自定義 SMTP 是否使用TLS，請填寫 true 或 false。如您已配置 SMTP_SERVICE，此項請留空。',
    '自訂 SMTP 是否使用 TLS，請填寫 true 或 false。如您已設定 SMTP_SERVICE，此項請留白。',
    'Custom TLS for SMTP. Enter "true" or "false". If you have configured SMTP_SERVICE, please leave it empty.'
    'СМТП учун махсус ТЛС. «Тўғри» ёки «нотўғри» ни киритинг. Агар сиз СМТП_СEРВИС созлаган бўлсангиз, уни бўш қолдиринг.'
  ],
  [S.ACI + '_SMTP_SERVICE']: [
    `邮件通知邮箱服务商。支持：${smtpServices.join('、')}`,
    `郵件通知郵箱服務商。支持：${smtpServices.join('、')}`,
    `郵件通知郵箱服務提供商。支援：${smtpServices.join('、')}`,
    `Email service provider for Email notification. Support: ${smtpServices.join(', ')}`
    `Электрон почта хабарномаси учун электрон почта хизмати провайдери. Қўллаб-қувватлаш: ${smtpServices.join(', ')}`
  ],
  [S.ACI + '_SMTP_USER']: [
    '邮件通知邮箱用户名。',
    '郵件通知郵箱用户名。',
    '郵件通知郵箱使用者名稱。',
    'Email notification mailbox username.'
    'Электрон почта хабарномаси почта қутиси фойдаланувчи номи.'
  ],
  ADMIN_CONFIG_RESET: [
    '重置',
    '重置',
    '還原',
    'Reset'
    'Ресет'
  ],
  ADMIN_CONFIG_SAVE: [
    '保存',
    '保存',
    '儲存',
    'Save'
    'Сақлаш'
  ],
  ADMIN_CREDENTIALS: [
    '私钥文件',
    '私鑰文件',
    '私鑰檔案',
    'Private key file'
    'Shaxsiy kalit fayli'
  ],
  ADMIN_CREDENTIALS_FAQ: [
    '如何获得私钥',
    '如何獲得私鑰',
    '如何獲取私鑰',
    'How to get the private key'
    'Shaxsiy kalitni qanday olish mumkin'
  ],
  ADMIN_CREDENTIALS_PLACEHOLDER: [
    '请粘贴私钥文件内容',
    '請貼上私鑰文件內容',
    '請貼上私鑰檔案內容',
    'Please paste the contents of the private key file'
    'Iltimos, shaxsiy kalit faylining mazmunini joylashtiring'
  ],
  ADMIN_FORGOT: [
    '忘记密码',
    '忘記密碼',
    '忘記密碼',
    'Forget your password'
    'Парол унутилган'    
  ],
  ADMIN_EXPORT: [
    '导出',
    '匯出',
    '匯出',
    'Export'
    'Экспорт'
  ],
  ADMIN_EXPORT_WARN: [
    '将全部数据导出为 JSON 文件。如果遇到评论较多、导出失败或缺失数据，请连接数据库手动导出',
    '將全部數據匯出為 JSON 檔。如果遇到評論較多、匯出失敗或缺失數據，請連接資料庫手動匯出',
    '將全部數據匯出為 JSON 檔。如果遇到評論較多、匯出失敗或缺失數據，請連接資料庫手動匯出',
    'Export all data as a JSON file. If you encounter export failures or missing data, connect to the database to export manually'
    'Барча маълумотларни ЖСОН файли сифатида экспорт қилинг. Экспорт хатоси ёки этишмаётган маълумотларга дуч келсангиз, қўлда экспорт қилиш учун маълумотлар базасига уланинг'
  ],
  ADMIN_EXPORT_COMMENT: [
    '导出评论',
    '匯出評論',
    '匯出評論',
    'Export comment'
    'Изохни экспорт килиш'
  ],
  ADMIN_EXPORT_COUNTER: [
    '导出访问量',
    '匯出訪問量',
    '匯出訪問量',
    'Export counter'
    'Экспорт сони'
  ],
  [S.AI]: [
    '导入',
    '匯入',
    '匯入',
    'Import'
    'Импорт'
  ],
  [S.AI + '_FILE_REQUIRED']: [
    '未选择文件',
    '未選擇文件',
    '未選擇檔案',
    'No file selected'
    'Файлни танланмади'
  ],
  [S.AI + '_IMPORTED']: [
    '完成导入 ',
    '完成匯入 ',
    '完成匯入 ',
    'Imported '
    'Импорт қилинди '
  ],
  [S.AI + '_IMPORTING']: [
    '开始导入 ',
    '開始匯入 ',
    '開始匯入 ',
    'Importing '
    'Импорт қилинмоқда '
  ],
  [S.AI + '_LOG']: [
    '日志',
    '日誌',
    '日誌',
    'Log'
    'Лог'
  ],
  [S.AI + '_SELECT']: [
    '请选择',
    '請選擇',
    '請選擇',
    'Select'
    'Танланг'
  ],
  [S.AI + '_SELECT_FILE']: [
    '选择文件',
    '選擇文件',
    '選擇檔案',
    'Select file'
    'Файлни танланг'
  ],
  [S.AI + '_SELECT_SOURCE']: [
    '选择源系统',
    '選擇源系統',
    '選擇來源系統',
    'Select source'
    'Манба танланг'
  ],
  [S.AI + '_SOURCE_REQUIRED']: [
    '未选择源系统',
    '未選擇源系統',
    '未選擇來源系統',
    'No source selected.'
    'Ҳеч қандай манба танланмаган.'
  ],
  [S.AI + '_START']: [
    '开始导入',
    '開始匯入',
    '開始匯入',
    'Start import'
    'Импортни бошлаш'
  ],
  [S.AI + '_STARTING']: [
    '开始导入',
    '開始匯入',
    '開始匯入',
    'Importing'
    'Импорт қилинмоқда'
  ],
  [S.AI + '_TIP_ARTALK']: [
    '请上传 JSON 格式的 Artalk 导出文件，文件名通常为 comments.data.json',
    '請上傳 JSON 格式的 Artalk 導出文件，文件名通常為 comments.data.json',
    '請上傳 JSON 格式的 Artalk 匯出檔案，檔名通常為 comments.data.json',
    'Please upload the Artalk export file in JSON format.The file name is usually comments.data.json'
    'Арталк экспорт файлини ЖСОН форматида юкланг. Файл номи одатда comments.data.json бўлади.'
  ],
  [S.AI + '_TIP_DISQUS']: [
    '请上传 XML 格式的 Disqus 导出文件，文件名通常为 [网站名称]-[导出时间]-all.xml',
    '請上傳 XML 格式的 Disqus 導出文件，文件名通常為 [網站名稱]-[導出時間]-all.xml',
    '請上傳 XML 格式的 Disqus 匯出檔案，檔名通常為 [網站名稱]-[匯出時間]-all.xml',
    'Please upload the Disqus export file in XML format. The file name is usually [website name]-[export time]-all.xml'
    'Disqus экспорт файлини ХМЛ форматида юкланг. Файл номи одатда [веб-сайт номи]-[экспорт vaqti]-all.xml'
  ],
  [S.AI + '_TIP_VALINE']: [
    '请上传 JSON 格式的 Valine 导出文件，文件名通常为 Comment.json',
    '請上傳 JSON 格式的 Valine 導出文件，文件名通常為 Comment.json',
    '請上傳 JSON 格式的 Valine 匯出檔案，檔名通常為 Comment.json',
    'Please upload the Valine export file in JSON format. The file name is usually Comment.json'
    'Илтимос, Валине экспорт файлини ЖСОН форматида юкланг. Файл номи одатда Comment.json'
  ],
  [S.AI + '_UPLOADED']: [
    '上传完成 ',
    '上傳完成 ',
    '上傳完成 ',
    'Uploaded '
    'Юкланди '
  ],
  [S.AI + '_UPLOADING']: [
    '已上传 ',
    '已上傳 ',
    '已上傳 ',
    'Uploading '
    'Юкланмоқда '
  ],
  [S.AI + '_WARN']: [
    '支持从其他评论系统的备份文件导入评论。\n数据是安全的，导入功能完全在您的云环境进行。\n建议在导入前备份 comment 数据库。',
    '支持從其他評論系統的備份文件匯入評論。\n數據是安全的，匯入功能完全在您的雲環境進行。\n建議在匯入前備份 comment 數據庫。',
    '支援從其他留言系統的備份檔案匯入留言。\n資料是安全的，匯入功能完全在您的雲端環境進行。\n建議在匯入前備份 comment 資料庫。',
    'Import comments from other comment systems.\nThe data is safe, and the import function is performed entirely in your cloud environment.\nPlease backup your comment database before importing.'
    'Бошқа шарҳ тизимларидан шарҳларни импорт қилинг.\nМаълумотлар хавфсиз ва импорт функцияси тўлиқ булутли муҳитда амалга оширилади.\nИмпорт қилишдан олдин шарҳлар маълумотлар базасини захираланг.'
  ],
  ADMIN_LOGIN: [
    '登录',
    '登入',
    '登入',
    'Sign in'
    'Тизимга кириш'
  ],
  ADMIN_LOGIN_TITLE: [
    'Twikoo 评论管理',
    'Twikoo 評論管理',
    'Twikoo 留言管理',
    'Twikoo Management Panel'
    'Twikoo Бошқарув Панели'
  ],
  ADMIN_LOGOUT: [
    '退出登录',
    '退出登入',
    '登出',
    'Sign out'
    'Тизимдан чиқиш'
  ],
  ADMIN_NEED_UPDATE: [
    '若要使用评论管理，请更新 Twikoo 云函数',
    '若要使用評論管理，請更新 Twikoo 雲函數',
    '若要使用留言管理功能，請更新 Twikoo 雲端函數',
    'A new version of Twikoo is required for comment management.'
    'Фикрларни бошқариш учун Твикоо нинг янги версияси талаб қилинади.'
  ],
  ADMIN_PASSWORD: [
    '密码',
    '密碼',
    '密碼',
    'Password'
    'Пароль'
  ],
  ADMIN_PASSWORD_PLACEHOLDER: [
    '请输入',
    '請輸入',
    '請輸入',
    'Enter your password...'
    'Паролингизни киритинг...'
  ],
  ADMIN_PASSWORD_REQUIRED: [
    '请输入密码',
    '請輸入密碼',
    '請輸入密碼',
    'Please enter your password'
    'Илтимос, паролингизни киритинг'
  ],
  ADMIN_REGIST: [
    '注册',
    '註冊',
    '註冊',
    'Register'
    'Рўйхатдан ўтиш'
  ],
  ADMIN_REGIST_FAILED: [
    '注册失败',
    '註冊失敗',
    '註冊失敗',
    'Register failed'
    'Рўйхатдан ўтиш амалга ошмади'
  ],
  ADMIN_SET_PASSWORD: [
    '设置密码',
    '設置密碼',
    '設定密碼',
    'Set password'
    'Пароль қўйиш'
  ],
  ADMIN_SET_PASSWORD_CONFIRM: [
    '确认密码',
    '確認密碼',
    '確認密碼',
    'Confirm password'
    'Паролни тасдиқланг'
  ],
  ADMIN_SET_PASSWORD_CONFIRM_PLACEHOLDER: [
    '确认密码',
    '確認密碼',
    '確認密碼',
    'Confirm password...'
    'Паролни тасдиқлаш...'
  ],
  ADMIN_SET_PASSWORD_PLACEHOLDER: [
    '密码',
    '密碼',
    '密碼',
    'Password'
    'Пароль'
  ],
  ADMIN_TITLE: [
    'Twikoo 管理面板',
    'Twikoo 管理面板',
    'Twikoo 管理控制台',
    'Twikoo Management Panel'
    'Twikoo Бошқарув Панели'
  ],
  COMMENTS_COUNT_SUFFIX: [
    ' 条评论',
    ' 條評論',
    ' 則留言',
    ' comments'
    ' изоҳлар'
  ],
  COMMENTS_EXPAND: [
    '查看更多',
    '查看更多',
    '檢視更多',
    'Load more'
    'Давомини юклаш'
  ],
  COMMENTS_NO_COMMENTS: [
    '没有评论',
    '沒有評論',
    '沒有留言',
    'No comment'
    'Изоҳларсиз'
  ],
  COMMENT_EXPAND: [
    '展开',
    '展開',
    '展開',
    'Read more'
    'Давомини ўқиш'
  ],
  COMMENT_COLLAPSE: [
    '收起',
    '收起',
    '閉合',
    'Collapse'
    'Очиш'
  ],
  COMMENT_MASTER_TAG: [
    '博主',
    '博主',
    '站長',
    'Admin'
    'Модератор'
  ],
  COMMENT_REPLIED: [
    '回复',
    '回覆',
    '回覆',
    'Reply'
    'Жавоб бериш'
  ],
  COMMENT_REVIEWING_TAG: [
    '审核中',
    '審核中',
    '審核中',
    'Pending'
    'Кутилмоқда'
  ],
  COMMENT_TOP_TAG: [
    '置顶',
    '置頂',
    '置頂',
    'Pinned'
    'Қадоқланган'
  ],
  COMMENT_FAILED: [
    '评论失败',
    '評論失敗',
    '評論失敗',
    'Comment failed'
    'Фикр билдирилмади'
  ],
  META_INPUT_LINK: [
    '网址',
    '網址',
    '網址',
    'Website'
    'Веб-сайт'
  ],
  META_INPUT_MAIL: [
    '邮箱',
    '郵箱',
    '郵箱',
    'Email'
    'Email'
  ],
  META_INPUT_NICK: [
    '昵称',
    '暱稱',
    '暱稱',
    'Nickname'
    'Исм'
  ],
  META_INPUT_NOT_REQUIRED: [
    '选填',
    '選填',
    '選填',
    'Optional'
    'Ихтиёрий'
  ],
  META_INPUT_REQUIRED: [
    '必填',
    '必填',
    '必填',
    'Required'
    'Мажбурий'
  ],
  PAGINATION_COUNT_PREFIX: [
    '共 ',
    '共 ',
    '共 ',
    ''
    ''
  ],
  PAGINATION_COUNT_SUFFIX: [
    ' 条',
    ' 條',
    ' 條',
    ' entries'
    ' ёзувлар'
  ],
  PAGINATION_GOTO_PREFIX: [
    '前往',
    '前往',
    '前往',
    'Goto page'
    'Саҳифага ўтиш'
  ],
  PAGINATION_GOTO_SUFFIX: [
    '页',
    '頁',
    '頁',
    ''
    ''
  ],
  PAGINATION_PAGESIZE: [
    '条/页',
    '條/頁',
    '則/頁',
    'entries/page'
    'ёзувлар/саҳифа'
  ],
  SUBMIT_CANCEL: [
    '取消',
    '取消',
    '取消',
    'Cancel'
    'Бекор қилиш'
  ],
  SUBMIT_PREVIEW: [
    '预览',
    '預覽',
    '預覽',
    'Preview'
    'Кўриб чиқиш'
  ],
  SUBMIT_SEND: [
    '发送',
    '發送',
    '傳送',
    'Send'
    'Юбормоқ'
  ],
  IMAGE_UPLOAD_PLACEHOLDER: [
    '图片上传中',
    '圖片上傳中',
    '圖片上傳中',
    'Uploading image'
    'Расм юклаш'
  ],
  IMAGE_UPLOAD_FAILED: [
    '图片上传失败',
    '圖片上傳失敗',
    '圖片上傳失敗',
    'IMAGE UPLOAD FAILED'
    'РАСМ ЮКЛАНМАДИ'
  ],
  IMAGE_UPLOAD_FAILED_NO_CONF: [
    '博主未配置图床服务',
    '博主未配置圖床服務',
    '博主未配置圖床服務',
    'The blogger didn\'t configured any image bed service'
    'Муаллиф ҳеч қандай тасвир хизматини созламаган'
  ],
  IMAGE_UPLOAD_PLEASE_WAIT: [
    '图片上传中，请稍候再发送',
    '圖片上傳中，請稍候再發送',
    '圖片上傳中，請稍候再傳送',
    'Uploading image, please try again later'
    'Расм юкланмоқда, кейинроқ қайта уриниб кўринг'
  ],
  SUBMIT_SENDING: [
    '发送中',
    '發送中',
    '正在傳送',
    'Sending'
    'Юбориш'
  ],
  TIMEAGO_DAYS: [
    '天前',
    '天前',
    '天前',
    'days ago'
    'кунлар олдин'
  ],
  TIMEAGO_HOURS: [
    '小时前',
    '小時前',
    '小時前',
    'hours ago'
    'соатлар олдин'
  ],
  TIMEAGO_MINUTES: [
    '分钟前',
    '分鐘前',
    '分鐘前',
    'minutes ago'
    'дақиқалар олдин'
  ],
  TIMEAGO_NOW: [
    '刚刚',
    '剛剛',
    '剛剛',
    'Just now'
    'Ҳозиргина'
  ],
  TIMEAGO_SECONDS: [
    '秒前',
    '秒前',
    '秒前',
    'seconds ago'
    'сониялар олдин'
  ]
}
