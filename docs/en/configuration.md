# Configuration

::: warning
**This document is deprecated and no longer maintained, because the graphical configuration panel is available. Some of the content below may be outdated.**

- Configuration is optional: Twikoo works without it.
- Make sure the `config` collection is **not** publicly readable, otherwise secrets such as your SMTP password may leak.<br>
  The default permissions are safe, so you normally do not need to change anything.
- Store all configuration items in a single record.
  :::

## General

### SITE_NAME

Type: `String`<br>
Default: `null`<br>
Required: `false`<br>
Example: My Blog

Name of the blog or site.

### SITE_URL

Type: `String`<br>
Default: `null`<br>
Required: `false`<br>
Example: https://www.example.com

Address of the blog or site.

### BLOGGER_EMAIL

Type: `String`<br>
Default: `null`<br>
Required: `false`<br>
Example: 12345@qq.com

Email address of the blogger, used for mail notifications and for the blogger badge.

## Anti-spam

### AKISMET_KEY

Type: `String`<br>
Default: `null`<br>
Required: `false`<br>
Example: 8651783ed123

API key of the anti-spam comment service.

### HIDE_SPAM

Type: `String`<br>
Default: `false`<br>
Required: `false`<br>
Example: `true`

When set to `true`, comments marked as spam are hidden from everyone in the front-end comment area, including administrators and the comment author. They remain visible, reviewable and restorable in the admin panel.

## WeChat notification

### SC_SENDKEY

Type: `String`<br>
Default: `null`<br>
Required: `false`<br>
Example: SCT1364TKdsiGjGvyAZNYDVnuHW12345

`SCKEY` of the [ServerChan](https://sc.ftqq.com/3.version) WeChat push service.

## Mail notification

### SENDER_EMAIL

Type: `String`<br>
Default: `null`<br>
Required: `false`<br>
Example: blog@example.com

Sender address of mail notifications. For most mail providers `SENDER_EMAIL` must be identical to `SMTP_USER`, otherwise sending fails.

### SENDER_NAME

Type: `String`<br>
Default: `null`<br>
Required: `false`<br>
Example: My Blog comment notification

Subject/title of mail notifications.

### SMTP_SERVICE

Type: `String`<br>
Default: `null`<br>
Required: `false`<br>
Example: qiye.aliyun

Mail provider used for notifications.<br>
See the full list: [Supported services](https://nodemailer.com/smtp/well-known/#supported-services)

### SMTP_USER

Type: `String`<br>
Default: `null`<br>
Required: `false`<br>
Example: blog@example.com

Username of the mail account.

### SMTP_PASS

Type: `String`<br>
Default: `null`<br>
Required: `false`<br>
Example: password

Password of the mail account. For QQ Mail, use the authorization code.
