# 反垃圾

## 使用腾讯云内容安全服务

Twikoo 支持接入腾讯云文本内容检测，使用深度学习技术，识别涉黄、涉政、涉恐等有害内容，同时支持用户配置词库，打击自定义的违规文本。

腾讯云文本内容检测是付费服务，提供 1 个月的免费试用，之后价格为 25 元/万条。如果您对反垃圾评论要求不高，也可以使用免费的 Akismet。

如何申请腾讯云文本内容检测

1. 访问[腾讯云控制台-文本内容安全](https://console.cloud.tencent.com/cms/text/overview)，开通文本内容安全服务
2. 访问[腾讯云控制台-用户列表](https://console.cloud.tencent.com/cam)，点击新建用户，点击快速创建
3. 输入用户名，访问方式选择“编程访问”，用户权限取消“AdministratorAccess”，只勾选“QcloudCMSFullAccess”
4. 点击“创建用户”
5. 复制“成功新建用户”页面的“SecretId”和“SecretKey”，到 Twikoo 管理面板“反垃圾”模块中配置
6. 测试反垃圾效果

成功后，站长可以在[腾讯云控制台-自定义库管理](https://console.cloud.tencent.com/cms/text/lib)配置自定义文本内容过滤。

## 使用 Akismet 反垃圾服务

Akismet (Automattic Kismet) 是应用广泛的一个垃圾留言过滤系统，其作者是大名鼎鼎的 WordPress 创始人 Matt Mullenweg，Akismet 也是 WordPress 默认安装的插件，其使用非常广泛，设计目标便是帮助博客网站来过滤垃圾留言。

1. 注册 [akismet.com](https://akismet.com)
2. 选择 Akismet Personal 订阅，复制得到的 Akismet API Key，到 Twikoo 管理面板“反垃圾”模块中配置
