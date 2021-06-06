# 常见问题

## 如何修改头像？

请前往 [https://cn.gravatar.com](https://cn.gravatar.com) 通过邮箱注册并设定头像，评论时，请留下相同的邮箱。

访客还可以通过输入数字 QQ 邮箱地址，使用 QQ 头像发表评论。

## 如何修改、重置管理员密码？

请前往[云开发控制台](https://console.cloud.tencent.com/tcb/database/collection/config)编辑配置，删除 config.ADMIN_PASS 配置项，然后前往 Twikoo 管理面板重新设置密码。

## 如何获得管理面板的私钥文件？

1. 进入[环境-登录授权](https://console.cloud.tencent.com/tcb/env/login)，点击“自定义登录”右边的“私钥下载”，下载私钥文件
2. 用文本编辑器打开私钥文件，复制全部内容
3. 点击评论窗口的“小齿轮”图标，粘贴私钥文件内容，并设置管理员密码

## 如何开启文章访问量统计？

您可以在需要展示文章访问量的地方添加：

``` html
<span id="twikoo_visitors">0</span>
```

来展示访问量。暂不支持全站访问量统计。

## 如何测试 Akismet 反垃圾配置是否生效？

请填写 `viagra-test-123` 作为昵称，或填写 `akismet-guaranteed-spam@example.com` 作为邮箱，发表评论，这条评论将一定会被视为垃圾评论。

需要注意的是，由于 Akismet 服务响应速度较慢（大约 6 秒），影响用户体验，Twikoo 采取 “先放行，后检测” 的策略，垃圾评论会在发表后短暂可见。

## 免费资源如何计算？

您可以在云开发[环境总览](https://console.cloud.tencent.com/tcb/env/overview)看到资源使用情况。Twikoo 会消耗**数据库**和**云函数**两种资源，两种资源的免费用量为——

* 数据库：读 50,000 次/日，写 50,000 次/日
* 云函数：40,000 GBs/月

Twikoo 云函数的内存消耗恒定为 0.1GB，由此可计算出 Twikoo 云函数每月有长达 400,000 秒的运行时长，而免费资源的瓶颈主要在数据库日读取次数限制。建议站长关注免费资源的使用情况。

## 如何启用 Katex 支持？

Twikoo 支持 Katex 公式，但为了限制 Twikoo 的包大小，Twikoo 没有内置完整的 Katex，您需要[在页面中额外加载 katex.js](https://katex.org/docs/browser.html)。

``` html
<head>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.12.0/dist/katex.min.css" integrity="sha384-AfEj0r4/OFrOo5t7NnNe46zW/tFgW6x/bCJG8FqQCEo3+Aro6EYUG4+cU+KJWu/X" crossorigin="anonymous">
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.12.0/dist/katex.min.js" integrity="sha384-g7c+Jr9ZivxKLnZTDUhnkOnsh30B4H0rpLUpJ4jAIKs4fnJI+sEnkvrMWph2EDg4" crossorigin="anonymous"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.12.0/dist/contrib/auto-render.min.js" integrity="sha384-mll67QQFJfxn0IYznZYonOWZ644AWYC+Pt2cHqMaRhXVrursRwvLnLaebdGIlYNa" crossorigin="anonymous"></script>
</head>
```

载入后，您可以发送 `$$c = \pm\sqrt{a^2 + b^2}$$` 测试效果。

![katex](./static/katex.png)

您还可以在 `twikoo.init` 时传入自定义 katex 配置，详细配置请查看 [Katex Auto-render Extension](https://katex.org/docs/autorender.html)。

``` js
twikoo.init({
  envId: '您的环境id',
  el: '#tcomment',
  katex: {
    delimiters: [
      { left: '$$', right: '$$', display: true },
      { left: '$', right: '$', display: false },
      { left: '\\(', right: '\\)', display: false },
      { left: '\\[', right: '\\]', display: true }
    ],
    throwOnError: false
  }
});
```

## 如何配置反垃圾？

### 使用腾讯云内容安全服务

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

### 使用 Akismet 反垃圾服务

Akismet (Automattic Kismet) 是应用广泛的一个垃圾留言过滤系统，其作者是大名鼎鼎的 WordPress 创始人 Matt Mullenweg，Akismet 也是 WordPress 默认安装的插件，其使用非常广泛，设计目标便是帮助博客网站来过滤垃圾留言。

1. 注册 [akismet.com](https://akismet.com)
2. 选择 Akismet Personal 订阅，复制得到的 Akismet API Key，到 Twikoo 管理面板“反垃圾”模块中配置

## 登录管理面板遇到错误 AUTH_INVALID_CUSTOM_LOGIN_TICKET

一般是配置好登录私钥之后，又重新下载了登录私钥，导致之前配置的登录私钥失效了。<br>
解决方法：到[云开发控制台](https://console.cloud.tencent.com/tcb/database/collection/config)，数据库，删掉 config，然后重新配置私钥。
