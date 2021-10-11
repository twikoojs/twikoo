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

/**
 * 把所有语言翻译放在同一对象下可以减小打包 js 的体积 (~17kb)
 *
 * [key]: [
 *   'zh-CN',
 *   'zh-HK', // Contributor: [Jerry Wong](https://github.com/jerryc127)
 *   'zh-TW', // Contributor: [Jerry Wong](https://github.com/jerryc127)
 *   'en'     // Contributor: [PCloud](https://github.com/HEIGE-PCloud)
 * ]
 */
export default {
  ADMIN_CLIENT_VERSION: [
    '前端版本：',
    '前端版本：',
    '前端版本：',
    'Client version: '
  ],
  ADMIN_SERVER_VERSION: [
    '云函数版本：',
    '云函數版本：',
    '云函數版本：',
    'Server version: '
  ],
  [S.AC]: [
    '评论管理',
    '評論管理',
    '評論管理',
    'Comment'
  ],
  [S.AC + '_DELETE']: [
    '删除',
    '刪除',
    '刪除',
    'Delete'
  ],
  [S.AC + '_DELETE_CONFIRM']: [
    '确认删除？',
    '確認刪除？',
    '確認刪除？',
    'Confirm deletion?'
  ],
  [S.AC + '_FILTER_ALL']: [
    '全部',
    '全部',
    '全部',
    'All'
  ],
  [S.AC + '_FILTER_VISIBLE']: [
    '只看可见',
    '只看可見',
    '只看可見',
    'Visible'
  ],
  [S.AC + '_FILTER_HIDDEN']: [
    '只看隐藏',
    '只看隱藏',
    '只看隱藏',
    'Hidden'
  ],
  [S.AC + '_HIDE']: [
    '隐藏',
    '隱藏',
    '隱藏',
    'Hide'
  ],
  [S.AC + '_IS_SPAM_SUFFIX']: [
    ' (已隐藏)',
    ' (已隱藏)',
    ' (已隱藏)',
    ' (Hidden)'
  ],
  [S.AC + '_SEARCH']: [
    '搜索',
    '搜索',
    '搜索',
    'Search'
  ],
  [S.AC + '_SEARCH_PLACEHOLDER']: [
    '搜索昵称、邮箱、网址、IP、评论正文、文章地址',
    '搜索暱稱、郵箱、網址、IP、評論正文、文章地址',
    '搜索暱稱、郵箱、網址、IP、評論正文、文章地址',
    'Search by nick, mail, website, IP, comment, or article path'
  ],
  [S.AC + '_SHOW']: [
    '显示',
    '顯示',
    '顯示',
    'Show'
  ],
  [S.AC + '_TOP']: [
    '置顶',
    '置頂',
    '置頂',
    'Pin'
  ],
  [S.AC + '_UNTOP']: [
    '取消置顶',
    '取消置頂',
    '取消置頂',
    'Unpin'
  ],
  [S.AC + '_VIEW']: [
    '查看',
    '查看',
    '檢視',
    'View'
  ],
  ADMIN_CONFIG: [
    '配置管理',
    '配置管理',
    '配置管理',
    'Configuration'
  ],
  [S.ACC + '_COMMON']: [
    '通用',
    '通用',
    '通用',
    'General'
  ],
  [S.ACC + '_IM']: [
    '即时通知',
    '即時通知',
    '即時通知',
    'Instant notification'
  ],
  [S.ACC + '_MAIL']: [
    '邮件通知',
    '郵件通知',
    '郵件通知',
    'Email notification'
  ],
  [S.ACC + '_PLUGIN']: [
    '插件',
    '插件',
    '外掛',
    'Plugin'
  ],
  [S.ACC + '_SPAM']: [
    '反垃圾',
    '反垃圾',
    '反垃圾',
    'Spam'
  ],
  ADMIN_CONFIG_EMAIL_TEST: [
    '邮件通知测试',
    '郵件通知測試',
    '郵件通知測試',
    'Email notification test'
  ],
  ADMIN_CONFIG_EMAIL_TEST_BTN: [
    '发送测试邮件',
    '發送測試郵件',
    '發送測試郵件',
    'Send test mail'
  ],
  ADMIN_CONFIG_EMAIL_TEST_HELP: [
    '输入一个邮箱地址，发送测试邮件',
    '輸入一個郵箱位址，發送測試郵件',
    '輸入一個郵箱位址，發送測試郵件',
    'Input an email address & send test mail'
  ],
  ADMIN_CONFIG_EMAIL_TEST_RESULT: [
    '测试结果：',
    '測試結果：',
    '測試結果：',
    'Test result: '
  ],
  ADMIN_CONFIG_EXAMPLE: [
    '示例：',
    '示例：',
    '示例：',
    'Example: '
  ],
  [S.ACI + '_AKISMET_KEY']: [
    'Akismet 反垃圾评论，用于垃圾评论检测，设为 "MANUAL_REVIEW" 开启人工审核，留空不使用反垃圾。注册：https://akismet.com',
    'Akismet 反垃圾評論，用於垃圾評論檢測，設為 "MANUAL_REVIEW" 開啟人工審核，留空不使用反垃圾。註冊：https://akismet.com',
    'Akismet 反垃圾評論，用於垃圾評論檢測，設為 "MANUAL_REVIEW" 開啟人工審核，留空不使用反垃圾。註冊：https://akismet.com',
    'Akismet spam protection. Set to "MANUAL_REVIEW" to enable manual review. Leave it blank to not use anti-spam. Register Akismet: https://akismet.com'
  ],
  [S.ACI + '_BLOGGER_EMAIL']: [
    '博主的邮箱地址，用于邮件通知、博主标识。',
    '博主的郵箱地址，用於郵件通知、博主標識。',
    '博主的郵箱地址，用於郵件通知、博主標識。',
    'Admin Email address. Used for Email notification and admin identification.'
  ],
  [S.ACI + '_COMMENT_BG_IMG']: [
    '评论框自定义背景图片 URL 地址。',
    '評論框自定義背景圖片 URL 地址。',
    '評論框自定義背景圖片 URL 地址。',
    'URL for custom background image.'
  ],
  [S.ACI + '_COMMENT_PAGE_SIZE']: [
    '评论列表分页大小，默认为 8。',
    '評論列表分頁大小，預設為 8。',
    '評論列表分頁大小，預設為 8。',
    'Comment page size. Default: 8.'
  ],
  [S.ACI + '_COMMENT_PLACEHOLDER']: [
    '评论框提示信息，可用<br>换行，默认为空',
    '評論框提示信息，可用<br>換行，預設為空',
    '評論框提示資訊，可用<br>換行，預設為空',
    'Comment placeholder. Use <br> to start a newline. Default: empty.'
  ],
  [S.ACI + '_CORS_ALLOW_ORIGIN']: [
    'Vercel 安全域名，防止环境被盗用，请注意设置后将无法在本地（localhost）加载评论，默认为空',
    'Vercel 安全域名，防止環境被盜用，請注意設置後將無法在本地（localhost）加載評論，默認為空',
    'Vercel 安全域名，防止環境被盜用，請注意設置後將無法在本地（localhost）加載評論，默認為空',
    'Vercel 安全域名，防止环境被盗用，请注意设置后将无法在本地（localhost）加载评论，默认为空'
  ],
  [S.ACI + '_DEFAULT_GRAVATAR']: [
    '默认的头像显示。默认值为 "identicon"，可选： 404、mp、identicon、monsterid、wavatar、retro、robohash、blank',
    '預設的頭像顯示。預設值為 "identicon"，可選： 404、mp、identicon、monsterid、wavatar、retro、robohash、blank',
    '預設的頭像顯示。預設值為 "identicon"，可選： 404、mp、identicon、monsterid、wavatar、retro、robohash、blank',
    'Avatar placeholder. Default:  "identicon". Choose from: 404, mp, identicon, monsterid, wavatar, retro, robohash, blank.'
  ],
  [S.ACI + '_EMOTION_CDN']: [
    '表情 CDN，默认为：https://cdn.jsdelivr.net/gh/imaegoo/emotion/owo.json',
    '表情 CDN，預設為：https://cdn.jsdelivr.net/gh/imaegoo/emotion/owo.json',
    '表情 CDN，預設為：https://cdn.jsdelivr.net/gh/imaegoo/emotion/owo.json',
    'Emotion CDN. Default: https://cdn.jsdelivr.net/gh/imaegoo/emotion/owo.json'
  ],
  [S.ACI + '_FORBIDDEN_WORDS']: [
    '违禁词配置，包含违禁词的内容会直接标记为垃圾评论。英文逗号分隔。',
    '違禁詞配置，包含違禁詞的內容會直接標記為垃圾評論。英文逗號分隔。',
    '違禁詞配置，包含違禁詞嘅內容會直接標記為垃圾評論。英文逗號分隔。',
    'Configure prohibited words. Comments containing prohibited words will be auto spammed. Separate by comma.'
  ],
  [S.ACI + '_GRAVATAR_CDN']: [
    '自定义头像 CDN 地址。如：cn.gravatar.com, sdn.geekzu.org, gravatar.loli.net，默认：cn.gravatar.com',
    '自定義頭像 CDN 地址。如：cn.gravatar.com, sdn.geekzu.org, gravatar.loli.net，預設：cn.gravatar.com',
    '自定義頭像 CDN 地址。如：cn.gravatar.com, sdn.geekzu.org, gravatar.loli.net，預設：cn.gravatar.com',
    'Custom avator CDN. (Examples: cn.gravatar.com, sdn.geekzu.org, gravatar.loli.net) Default: cn.gravatar.com.'
  ],
  [S.ACI + '_HIDE_ADMIN_CRYPT']: [
    '隐藏管理面板入口。可设置一个“暗号”，只有在“昵称”一栏输入相同的“暗号”时，管理面板入口才会显示，留空则不隐藏管理入口',
    '隱藏管理面板入口。可設定一個“暗號”，只有在“暱稱”一欄輸入相同的“暗號”時，管理面板入口才會顯示，留空則不隱藏管理入口',
    '隱藏管理面板入口。可設定一個“暗號”，只有在“暱稱”一欄輸入相同的“暗號”時，管理面板入口才會顯示，留空則不隱藏管理入口',
    'Set a cipher to hide the management panel entrance, only when the same cipher is entered in the nickname field the management panel entry will be displayed. Leave it blank to not hide the management entrance.'
  ],
  [S.ACI + '_HIGHLIGHT']: [
    '启用代码高亮功能。如果您的主题和代码高亮有冲突，请设为 false。默认：true',
    '啟用代碼高亮功能。如果您的主題和代碼高亮有衝突，請設為 false。預設：true',
    '啟用程式碼高亮功能。如果您的主題和程式碼高亮有衝突，請設為 false。預設：true',
    'Enable code highlighting. If your theme conflicts with code highlighting, please set it to false. Default: true.'
  ],
  [S.ACI + '_HIGHLIGHT_THEME']: [
    '代码高亮主题，可选：default、coy、dark、funky、okaidia、solarizedlight、tomorrow、twilight，访问 https://prismjs.com 可预览主题效果。如果您的主题和代码高亮有冲突，请设为 none。默认：none',
    '代碼高亮主題，可選：default、coy、dark、funky、okaidia、solarizedlight、tomorrow、twilight，訪問 https://prismjs.com 可預覽主題效果。如果您的主題和代碼高亮有衝突，請設為 none。預設：none',
    '程式碼高亮主題，可選：default、coy、dark、funky、okaidia、solarizedlight、tomorrow、twilight，訪問 https://prismjs.com 可預覽主題效果。如果您的主題和程式碼高亮有衝突，請設為 none。預設：none',
    'Code highlighting theme. Select from: default、coy、dark、funky、okaidia、solarizedlight、tomorrow、twilight. Visit https://prismjs.com for preview. If your theme conflicts with code highlighting, please set it to none. Default: none.'
  ],
  [S.ACI + '_IMAGE_CDN']: [
    '插入图片所使用的图床，目前支持：7bu、qcloud，默认为：qcloud',
    '插入圖片所使用的圖床，目前支持：7bu、qcloud，預設為：qcloud',
    '插入圖片所使用的圖床，目前支援：7bu、qcloud，預設為：qcloud',
    'The image bed for image uploading. Select from: 7bu、qcloud. Default: qcloud.'
  ],
  [S.ACI + '_LIMIT_PER_MINUTE']: [
    '每个 IP 每 10 分钟最多发表多少条评论，默认：0（无限制）',
    '每個 IP 每 10 分鐘最多發表多少條評論，預設：0（無限制）',
    '每個 IP 每 10 分鐘最多發表多少條評論，預設：0（無限制）',
    'How many comments can be posted by each IP every 10 minutes, default: 0 (unlimited).'
  ],
  [S.ACI + '_LIMIT_PER_MINUTE_ALL']: [
    '所有 IP 每 10 分钟最多发表多少条评论，默认：0（无限制）',
    '所有 IP 每 10 分鐘最多發表多少條評論，預設：0（無限制）',
    '所有 IP 每 10 分鐘最多發表多少條評論，預設：0（無限制）',
    'How many comments can be posted by all IPs every 10 minutes, default: 0 (unlimited).'
  ],
  [S.ACI + '_MAIL_SUBJECT']: [
    '自定义通知邮件主题，留空则使用默认主题。',
    '自定義通知郵件主題，留空則使用預設主題。',
    '自定義通知郵件主題，留空則使用預設主題。',
    'Custom Email notification subject. Leave it blank to use the default subject.'
  ],
  [S.ACI + '_MAIL_SUBJECT_ADMIN']: [
    '自定义博主通知邮件主题，留空则使用默认主题。',
    '自定義博主通知郵件主題，留空則使用預設主題。',
    '自定義博主通知郵件主題，留空則使用預設主題。',
    'Custom admin Email notification subject. Leave it blank to use the default subject.'
  ],
  [S.ACI + '_MAIL_TEMPLATE']: [
    '自定义通知邮件模板，留空则使用默认模板。可包含的字段：${SITE_URL}, ${SITE_NAME}, ${PARENT_NICK}, ${PARENT_COMMENT}, ${NICK}, ${COMMENT}, ${POST_URL}',
    '自定義通知郵件模板，留空則使用預設模板。可包含的字段：${SITE_URL}, ${SITE_NAME}, ${PARENT_NICK}, ${PARENT_COMMENT}, ${NICK}, ${COMMENT}, ${POST_URL}',
    '自定義通知郵件模板，留空則使用預設模板。可包含的欄位：${SITE_URL}, ${SITE_NAME}, ${PARENT_NICK}, ${PARENT_COMMENT}, ${NICK}, ${COMMENT}, ${POST_URL}',
    'Custom Email notification template. Leave it blank to use the default template. Fields that can be included: ${SITE_URL}, ${SITE_NAME}, ${NICK}, ${COMMENT}, ${POST_URL}'
  ],
  [S.ACI + '_MAIL_TEMPLATE_ADMIN']: [
    '自定义博主通知邮件模板，留空则使用默认模板。可包含的字段：${SITE_URL}, ${SITE_NAME}, ${NICK}, ${COMMENT}, ${POST_URL}',
    '自定義博主通知郵件模板，留空則使用預設模板。可包含的字段：${SITE_URL}, ${SITE_NAME}, ${NICK}, ${COMMENT}, ${POST_URL}',
    '自定義博主通知郵件模板，留空則使用預設模板。可包含的欄位：${SITE_URL}, ${SITE_NAME}, ${NICK}, ${COMMENT}, ${POST_URL}',
    'Custom admin Email notification template. Leave it blank to use the default template. Fields that can be included: ${SITE_URL}, ${SITE_NAME}, ${NICK}, ${COMMENT}, ${POST_URL}'
  ],
  [S.ACI + '_MASTER_TAG']: [
    '博主标识自定义文字，默认为 “博主”。',
    '博主標識自定義文字，預設為 “博主”。',
    '博主標識自定義文字，預設為 “博主”。',
    'Custom admin identifier.'
  ],
  [S.ACI + '_NOTIFY_SPAM']: [
    '垃圾评论是否发送通知，默认：true',
    '垃圾評論是否發送通知，默認：true',
    '垃圾評論是否發送通知，默認：true',
    'Notifications for spam comments. Default: true.'
  ],
  [S.ACI + '_PUSH_PLUS_TOKEN']: [
    '推送加（pushplus.hxtrip.com）推送的 Token',
    '推送加（pushplus.hxtrip.com）推送的 Token',
    '推送加（pushplus.hxtrip.com）推送的 Token',
    'Push+ (pushplus.hxtrip.com) Token.'
  ],
  [S.ACI + '_QCLOUD_SECRET_ID']: [
    '腾讯云 secret id，用于垃圾评论检测。同时设置腾讯云和 Akismet 时，只有腾讯云会生效。注册：https://twikoo.js.org/cms.html',
    '騰訊雲 secret id，用於垃圾評論檢測。同時設定騰訊雲和 Akismet 時，只有騰訊雲會生效。註冊：https://twikoo.js.org/cms.html',
    '騰訊雲 secret id，用於垃圾評論檢測。同時設定騰訊雲和 Akismet 時，只有騰訊雲會生效。註冊：https://twikoo.js.org/cms.html',
    'Tencent Cloud secret id for spam detection. When Tencent Cloud and Akismet are set at the same time, only Tencent Cloud will take effect. Register: https://twikoo.js.org/cms.html'
  ],
  [S.ACI + '_QCLOUD_SECRET_KEY']: [
    '腾讯云 secret key',
    '騰訊雲 secret key',
    '騰訊雲 secret key',
    'Tencent Cloud secret key.'
  ],
  [S.ACI + '_QM_SENDKEY']: [
    'Qmsg酱（qmsg.zendee.cn）QQ推送的 KEY',
    'Qmsg醬（qmsg.zendee.cn）QQ推送的 KEY',
    'Qmsg醬（qmsg.zendee.cn）QQ推送的 KEY',
    'Qmsg chan (qmsg.zendee.cn) KEY for QQ notification.'
  ],
  [S.ACI + '_REQUIRED_FIELDS']: [
    '评论必填信息，设为 nick,mail,link 代表全必填，设为 none 代表全选填，默认：nick,mail',
    '評論必填信息，設為 nick,mail,link 代表全必填，設為 none 代表全選填，預設：nick,mail',
    '評論必填資訊，設為 nick,mail,link 代表全必填，設為 none 代表全選填，預設：nick,mail',
    'Required fields for comments. Set to "nick,mail,link" means all fields are required. Set to "none" means all fields are optional. Default: nick,mail.'
  ],
  [S.ACI + '_SC_MAIL_NOTIFY']: [
    '是否同时通过微信和邮件 2 种方式通知博主，默认只通过微信通知博主，默认：false',
    '是否同時通過微信和郵件 2 種方式通知博主，預設只通過微信通知博主，預設：false',
    '是否同時通過微信和郵件 2 種方式通知博主，預設只通過微信通知博主，預設：false',
    'Whether to notify admin via WeChat and email at the same time, the default is to notify admin only via WeChat. Default: false.'
  ],
  [S.ACI + '_SC_SENDKEY']: [
    'Server酱（sc.ftqq.com）微信推送的 SCKEY',
    'Server醬（sc.ftqq.com）微信推送的 SCKEY',
    'Server醬（sc.ftqq.com）微信推送的 SCKEY',
    'Server chan (sc.ftqq.com) SCKEY for WeChat notification.'
  ],
  [S.ACI + '_WECOM_API_URL']: [
    '自行搭建的企业微信通知 API 接口 URL，免费不限量，参考教程：https://guole.fun/posts/626/',
    '自行搭建的企業微信通知 API 接口 URL，免費不限量，參考教程：https://guole.fun/posts/626/',
    '自行搭建的企業微信通知 API 接口 URL，免費不限量，參考教程：https://guole.fun/posts/626/',
    'Self-built enterprise WeChat notification API interface URL, free unlimited, refer to the tutorial: https://guole.fun/posts/626/'
  ],
  [S.ACI + '_SENDER_EMAIL']: [
    '邮件通知邮箱地址。对于大多数邮箱服务商，SENDER_EMAIL 必须和 SMTP_USER 保持一致，否则无法发送邮件。',
    '郵件通知郵箱地址。對於大多數郵箱服務商，SENDER_EMAIL 必須和 SMTP_USER 保持一致，否則無法發送郵件。',
    '郵件通知郵箱地址。對於大多數郵箱服務商，SENDER_EMAIL 必須和 SMTP_USER 保持一致，否則無法傳送郵件。',
    'Email address for Email notification. For most email service providers, SENDER_EMAIL must be consistent with SMTP_USER, otherwise emails cannot be sent.'
  ],
  [S.ACI + '_SENDER_NAME']: [
    '邮件通知标题。',
    '郵件通知標題。',
    '郵件通知標題。',
    'The title for Email notification.'
  ],
  [S.ACI + '_SHOW_EMOTION']: [
    '启用插入表情功能，默认为：true',
    '啟用插入表情功能，預設為：true',
    '啟用插入表情功能，預設為：true',
    'Enable emoticons. Default: true.'
  ],
  [S.ACI + '_SHOW_IMAGE']: [
    '启用插入图片功能，默认为：true',
    '啟用插入圖片功能，預設為：true',
    '啟用插入圖片功能，預設為：true',
    'Enable picture uploading. Default: true.'
  ],
  [S.ACI + '_SITE_NAME']: [
    '网站名称',
    '網站名稱',
    '網站名稱',
    'Website name.'
  ],
  [S.ACI + '_SITE_URL']: [
    '网站地址',
    '網站地址',
    '網站地址',
    'Website URL.'
  ],
  [S.ACI + '_SMTP_HOST']: [
    '自定义 SMTP 服务器地址。如您已配置 SMTP_SERVICE，此项请留空。',
    '自定義 SMTP 伺服器地址。如您已配置 SMTP_SERVICE，此項請留空。',
    '自定義 SMTP 伺服器地址。如您已配置 SMTP_SERVICE，此項請留空。',
    'Custom SMTP server address. If you have configured SMTP_SERVICE, please leave it empty.'
  ],
  [S.ACI + '_SMTP_PASS']: [
    '邮件通知邮箱密码，QQ邮箱请填写授权码。',
    '郵件通知郵箱密碼，QQ郵箱請填寫授權碼。',
    '郵件通知郵箱密碼，QQ郵箱請填寫授權碼。',
    'Email notification mailbox password. Enter authorization code for QQ mail.'
  ],
  [S.ACI + '_SMTP_PORT']: [
    '自定义 SMTP 端口。如您已配置 SMTP_SERVICE，此项请留空。',
    '自定義 SMTP 端口。如您已配置 SMTP_SERVICE，此項請留空。',
    '自定義 SMTP 埠。如您已配置 SMTP_SERVICE，此項請留空。',
    'Custom SMTP port. If you have configured SMTP_SERVICE, please leave it empty.'
  ],
  [S.ACI + '_SMTP_SECURE']: [
    '自定义 SMTP 是否使用TLS，请填写 true 或 false。如您已配置 SMTP_SERVICE，此项请留空。',
    '自定義 SMTP 是否使用TLS，請填寫 true 或 false。如您已配置 SMTP_SERVICE，此項請留空。',
    '自定義 SMTP 是否使用TLS，請填寫 true 或 false。如您已配置 SMTP_SERVICE，此項請留空。',
    'Custom TLS for SMTP. Enter "true" or "false". If you have configured SMTP_SERVICE, please leave it empty.'
  ],
  [S.ACI + '_SMTP_SERVICE']: [
    '邮件通知邮箱服务商。支持："126", "163", "1und1", "AOL", "DebugMail", "DynectEmail", "FastMail", "GandiMail", "Gmail", "Godaddy", "GodaddyAsia", "GodaddyEurope", "Hotmail", "Mail.ru", "Maildev", "Mailgun", "Mailjet", "Mailosaur", "Mandrill", "Naver", "OpenMailBox", "Outlook365", "Postmark", "QQ", "QQex", "SES", "SES-EU-WEST-1", "SES-US-EAST-1", "SES-US-WEST-2", "SendCloud", "SendGrid", "SendPulse", "SendinBlue", "Sparkpost", "Yahoo", "Yandex", "Zoho", "hot.ee", "iCloud", "mail.ee", "qiye.aliyun"',
    '郵件通知郵箱服務商。支持："126", "163", "1und1", "AOL", "DebugMail", "DynectEmail", "FastMail", "GandiMail", "Gmail", "Godaddy", "GodaddyAsia", "GodaddyEurope", "Hotmail", "Mail.ru", "Maildev", "Mailgun", "Mailjet", "Mailosaur", "Mandrill", "Naver", "OpenMailBox", "Outlook365", "Postmark", "QQ", "QQex", "SES", "SES-EU-WEST-1", "SES-US-EAST-1", "SES-US-WEST-2", "SendCloud", "SendGrid", "SendPulse", "SendinBlue", "Sparkpost", "Yahoo", "Yandex", "Zoho", "hot.ee", "iCloud", "mail.ee", "qiye.aliyun"',
    '郵件通知郵箱服務商。支援："126", "163", "1und1", "AOL", "DebugMail", "DynectEmail", "FastMail", "GandiMail", "Gmail", "Godaddy", "GodaddyAsia", "GodaddyEurope", "Hotmail", "Mail.ru", "Maildev", "Mailgun", "Mailjet", "Mailosaur", "Mandrill", "Naver", "OpenMailBox", "Outlook365", "Postmark", "QQ", "QQex", "SES", "SES-EU-WEST-1", "SES-US-EAST-1", "SES-US-WEST-2", "SendCloud", "SendGrid", "SendPulse", "SendinBlue", "Sparkpost", "Yahoo", "Yandex", "Zoho", "hot.ee", "iCloud", "mail.ee", "qiye.aliyun"',
    'Email service provider for Email notification. Support: "126", "163", "1und1", "AOL", "DebugMail", "DynectEmail", "FastMail", "GandiMail", "Gmail", "Godaddy", "GodaddyAsia", "GodaddyEurope", "Hotmail", "Mail.ru", "Maildev", "Mailgun", "Mailjet", "Mailosaur", "Mandrill", "Naver", "OpenMailBox", "Outlook365", "Postmark", "QQ", "QQex", "SES", "SES-EU-WEST-1", "SES-US-EAST-1", "SES-US-WEST-2", "SendCloud", "SendGrid", "SendPulse", "SendinBlue", "Sparkpost", "Yahoo", "Yandex", "Zoho", "hot.ee", "iCloud", "mail.ee", "qiye.aliyun"'
  ],
  [S.ACI + '_SMTP_USER']: [
    '邮件通知邮箱用户名。',
    '郵件通知郵箱用户名。',
    '郵件通知郵箱使用者名稱。',
    'Email notification mailbox username.'
  ],
  ADMIN_CONFIG_RESET: [
    '重置',
    '重置',
    '重置',
    'Reset'
  ],
  ADMIN_CONFIG_SAVE: [
    '保存',
    '保存',
    '儲存',
    'Save'
  ],
  ADMIN_CREDENTIALS: [
    '私钥文件',
    '私鑰文件',
    '私鑰檔案',
    'Private key file'
  ],
  ADMIN_CREDENTIALS_FAQ: [
    '如何获得私钥',
    '如何獲得私鑰',
    '如何獲得私鑰',
    'How to get the private key'
  ],
  ADMIN_CREDENTIALS_PLACEHOLDER: [
    '请粘贴私钥文件内容',
    '請貼上私鑰文件內容',
    '請貼上私鑰檔案內容',
    'Please paste the contents of the private key file'
  ],
  ADMIN_FORGOT: [
    '忘记密码',
    '忘記密碼',
    '忘記密碼',
    'Forget your password'
  ],
  [S.AI]: [
    '导入',
    '匯入',
    '匯入',
    'Import'
  ],
  [S.AI + '_FILE_REQUIRED']: [
    '未选择文件',
    '未選擇文件',
    '未選擇檔案',
    'No file selected'
  ],
  [S.AI + '_IMPORTED']: [
    '完成导入 ',
    '完成匯入 ',
    '完成匯入 ',
    'Imported '
  ],
  [S.AI + '_IMPORTING']: [
    '开始导入 ',
    '開始匯入 ',
    '開始匯入 ',
    'Importing '
  ],
  [S.AI + '_LOG']: [
    '日志',
    '日誌',
    '日誌',
    'Log'
  ],
  [S.AI + '_SELECT']: [
    '请选择',
    '請選擇',
    '請選擇',
    'Select'
  ],
  [S.AI + '_SELECT_FILE']: [
    '选择文件',
    '選擇文件',
    '選擇檔案',
    'Select file'
  ],
  [S.AI + '_SELECT_SOURCE']: [
    '选择源系统',
    '選擇源系統',
    '選擇源系統',
    'Select source'
  ],
  [S.AI + '_SOURCE_REQUIRED']: [
    '未选择源系统',
    '未選擇源系統',
    '未選擇源系統',
    'No source selected.'
  ],
  [S.AI + '_START']: [
    '开始导入',
    '開始匯入',
    '開始匯入',
    'Start import'
  ],
  [S.AI + '_STARTING']: [
    '开始导入',
    '開始匯入',
    '開始匯入',
    'Importing'
  ],
  [S.AI + '_TIP_ARTALK']: [
    '请上传 JSON 格式的 Artalk 导出文件，文件名通常为 comments.data.json',
    '請上傳 JSON 格式的 Artalk 導出文件，文件名通常為 comments.data.json',
    '請上傳 JSON 格式的 Artalk 匯出檔案，檔名通常為 comments.data.json',
    'Please upload the Artalk export file in JSON format.The file name is usually comments.data.json'
  ],
  [S.AI + '_TIP_DISQUS']: [
    '请上传 XML 格式的 Disqus 导出文件，文件名通常为 [网站名称]-[导出时间]-all.xml',
    '請上傳 XML 格式的 Disqus 導出文件，文件名通常為 [網站名稱]-[導出時間]-all.xml',
    '請上傳 XML 格式的 Disqus 匯出檔案，檔名通常為 [網站名稱]-[匯出時間]-all.xml',
    'Please upload the Disqus export file in XML format. The file name is usually [website name]-[export time]-all.xml'
  ],
  [S.AI + '_TIP_VALINE']: [
    '请上传 JSON 格式的 Valine 导出文件，文件名通常为 Comment.json',
    '請上傳 JSON 格式的 Valine 導出文件，文件名通常為 Comment.json',
    '請上傳 JSON 格式的 Valine 匯出檔案，檔名通常為 Comment.json',
    'Please upload the Valine export file in JSON format. The file name is usually Comment.json'
  ],
  [S.AI + '_UPLOADED']: [
    '上传完成 ',
    '上傳完成 ',
    '上傳完成 ',
    'Uploaded '
  ],
  [S.AI + '_UPLOADING']: [
    '已上传 ',
    '已上傳 ',
    '已上傳 ',
    'Uploading '
  ],
  [S.AI + '_WARN']: [
    '支持从其他评论系统的备份文件导入评论。\n数据是安全的，导入功能完全在您的云环境进行。\n建议在导入前备份 comment 数据库。',
    '支持從其他評論系統的備份文件匯入評論。\n數據是安全的，匯入功能完全在您的雲環境進行。\n建議在匯入前備份 comment 數據庫。',
    '支援從其他評論系統的備份檔案匯入評論。\n資料是安全的，匯入功能完全在您的雲環境進行。\n建議在匯入前備份 comment 資料庫。',
    'Import comments from other comment systems.\nThe data is safe, and the import function is performed entirely in your cloud environment.\nPlease backup your comment database before importing.'
  ],
  ADMIN_LOGIN: [
    '登录',
    '登入',
    '登入',
    'Sign in'
  ],
  ADMIN_LOGIN_TITLE: [
    'Twikoo 评论管理',
    'Twikoo 評論管理',
    'Twikoo 評論管理',
    'Twikoo Management Panel'
  ],
  ADMIN_LOGOUT: [
    '退出登录',
    '退出登入',
    '退出登入',
    'Sign out'
  ],
  ADMIN_NEED_UPDATE: [
    '若要使用评论管理，请更新 Twikoo 云函数',
    '若要使用評論管理，請更新 Twikoo 雲函數',
    '若要使用評論管理，請更新 Twikoo 雲函數',
    'A new version of Twikoo is required for comment management.'
  ],
  ADMIN_PASSWORD: [
    '密码',
    '密碼',
    '密碼',
    'Password'
  ],
  ADMIN_PASSWORD_PLACEHOLDER: [
    '请输入',
    '請輸入',
    '請輸入',
    'Enter your password...'
  ],
  ADMIN_PASSWORD_REQUIRED: [
    '请输入密码',
    '請輸入密碼',
    '請輸入密碼',
    'Please enter your password'
  ],
  ADMIN_REGIST: [
    '注册',
    '註冊',
    '註冊',
    'Register'
  ],
  ADMIN_REGIST_FAILED: [
    '注册失败',
    '註冊失敗',
    '註冊失敗',
    'Register failed'
  ],
  ADMIN_SET_PASSWORD: [
    '设置密码',
    '設置密碼',
    '設定密碼',
    'Set password'
  ],
  ADMIN_SET_PASSWORD_CONFIRM: [
    '确认密码',
    '確認密碼',
    '確認密碼',
    'Confirm password'
  ],
  ADMIN_SET_PASSWORD_CONFIRM_PLACEHOLDER: [
    '确认密码',
    '確認密碼',
    '確認密碼',
    'Confirm password...'
  ],
  ADMIN_SET_PASSWORD_PLACEHOLDER: [
    '密码',
    '密碼',
    '密碼',
    'Password'
  ],
  ADMIN_TITLE: [
    'Twikoo 管理面板',
    'Twikoo 管理面板',
    'Twikoo 管理面板',
    'Twikoo Management Panel'
  ],
  COMMENTS_COUNT_SUFFIX: [
    ' 条评论',
    ' 條評論',
    ' 條評論',
    ' comments'
  ],
  COMMENTS_EXPAND: [
    '查看更多',
    '查看更多',
    '檢視更多',
    'Load more'
  ],
  COMMENTS_NO_COMMENTS: [
    '没有评论',
    '沒有評論',
    '沒有評論',
    'No comment'
  ],
  COMMENT_EXPAND: [
    '展开',
    '展開',
    '展開',
    'Read more'
  ],
  COMMENT_COLLAPSE: [
    '收起',
    '收起',
    '收起',
    'Collapse'
  ],
  COMMENT_MASTER_TAG: [
    '博主',
    '博主',
    '博主',
    'Admin'
  ],
  COMMENT_REPLIED: [
    '回复',
    '回覆',
    '回覆',
    'Reply'
  ],
  COMMENT_REVIEWING_TAG: [
    '审核中',
    '審核中',
    '審核中',
    'Reviewing'
  ],
  COMMENT_TOP_TAG: [
    '置顶',
    '置頂',
    '置頂',
    'Pinned'
  ],
  META_INPUT_LINK: [
    '网址',
    '網址',
    '網址',
    'Website'
  ],
  META_INPUT_MAIL: [
    '邮箱',
    '郵箱',
    '郵箱',
    'Email'
  ],
  META_INPUT_NICK: [
    '昵称',
    '暱稱',
    '暱稱',
    'Nickname'
  ],
  META_INPUT_NOT_REQUIRED: [
    '选填',
    '選填',
    '選填',
    'Optional'
  ],
  META_INPUT_REQUIRED: [
    '必填',
    '必填',
    '必填',
    'Required'
  ],
  PAGINATION_COUNT_PREFIX: [
    '共 ',
    '共 ',
    '共 ',
    ''
  ],
  PAGINATION_COUNT_SUFFIX: [
    ' 条',
    ' 條',
    ' 條',
    ' entries'
  ],
  PAGINATION_GOTO_PREFIX: [
    '前往',
    '前往',
    '前往',
    'Goto page'
  ],
  PAGINATION_GOTO_SUFFIX: [
    '页',
    '頁',
    '頁',
    ''
  ],
  PAGINATION_PAGESIZE: [
    '条/页',
    '條/頁',
    '條/頁',
    'entries/page'
  ],
  SUBMIT_CANCEL: [
    '取消',
    '取消',
    '取消',
    'Cancel'
  ],
  SUBMIT_PREVIEW: [
    '预览',
    '預覽',
    '預覽',
    'Preview'
  ],
  SUBMIT_SEND: [
    '发送',
    '發送',
    '傳送',
    'Send'
  ],
  SUBMIT_SENDING: [
    '发送中',
    '發送中',
    '傳送中',
    'Sending'
  ],
  TIMEAGO_DAYS: [
    '天前',
    '天前',
    '天前',
    'days ago'
  ],
  TIMEAGO_HOURS: [
    '小时前',
    '小時前',
    '小時前',
    'hours ago'
  ],
  TIMEAGO_MINUTES: [
    '分钟前',
    '分鐘前',
    '分鐘前',
    'minutes ago'
  ],
  TIMEAGO_NOW: [
    '刚刚',
    '剛剛',
    '剛剛',
    'Just now'
  ],
  TIMEAGO_SECONDS: [
    '秒前',
    '秒前',
    '秒前',
    'seconds ago'
  ]
}
