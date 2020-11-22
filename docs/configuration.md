# 配置

::: warning 注意
**因图形化配置界面已上线，此文档已废弃且不再维护，其中的内容可能已经过时**

* 配置是可选的，即使没有配置也可以使用。
* 请确保 config 表的权限**不是**“所有用户可读”，以保证 SMTP 密码等信息不会泄露。<br>
不过放心，默认权限是安全的，您不需要更改。
* 请将配置项放在一条数据记录中。
:::

## 通用

### SITE_NAME

类型: `String`<br>
默认值: `null`<br>
必要性: `false`<br>
示例: 虹墨空间站

博客、站点名称。

### SITE_URL

类型: `String`<br>
默认值: `null`<br>
必要性: `false`<br>
示例: https://www.imaegoo.com

博客、站点地址。

### BLOGGER_EMAIL

类型: `String`<br>
默认值: `null`<br>
必要性: `false`<br>
示例: 12345@qq.com

博主的邮箱地址，用于邮件通知、博主标识。

## 反垃圾

### AKISMET_KEY

类型: `String`<br>
默认值: `null`<br>
必要性: `false`<br>
示例: 8651783ed123

反垃圾评论 API key。

## 微信通知

### SC_SENDKEY

类型: `String`<br>
默认值: `null`<br>
必要性: `false`<br>
示例: SCT1364TKdsiGjGvyAZNYDVnuHW12345

[Server酱](https://sc.ftqq.com/3.version)微信推送的 `SCKEY`

## 邮件通知

### SENDER_EMAIL

类型: `String`<br>
默认值: `null`<br>
必要性: `false`<br>
示例: blog@imaegoo.com

邮件通知邮箱地址。对于大多数邮箱服务商，`SENDER_EMAIL` 必须和 `SMTP_USER` 保持一致，否则无法发送邮件。

### SENDER_NAME

类型: `String`<br>
默认值: `null`<br>
必要性: `false`<br>
示例: 虹墨空间站评论提醒

邮件通知标题。

### SMTP_SERVICE

类型: `String`<br>
默认值: `null`<br>
必要性: `false`<br>
示例: qiye.aliyun

邮件通知邮箱服务商。<br>
完整列表请参考：[Supported services](https://nodemailer.com/smtp/well-known/#supported-services)

### SMTP_USER

类型: `String`<br>
默认值: `null`<br>
必要性: `false`<br>
示例: blog@imaegoo.com

邮件通知邮箱用户名。

### SMTP_PASS

类型: `String`<br>
默认值: `null`<br>
必要性: `false`<br>
示例: password

邮件通知邮箱密码，QQ邮箱请填写授权码。
