# 常见问题

## 我忘记了管理员密码，如何重置？

如忘记密码，请前往[云开发控制台](https://console.cloud.tencent.com/tcb/database/collection/config)删除 config.ADMIN_PASS 配置项，然后前往 Twikoo 管理面板重新设置密码。

## 如何获得管理面板的私钥文件？

1. 进入[环境-登录授权](https://console.cloud.tencent.com/tcb/env/login)，点击“自定义登录”右边的“私钥下载”，下载私钥文件
2. 用文本编辑器打开私钥文件，复制全部内容
3. 点击评论窗口的“小齿轮”图标，粘贴私钥文件内容，并设置管理员密码

## 如何开启文章访问量统计？

文章访问量统计功能正在测试中，您可以在需要展示文章访问量的地方添加：

``` html
<span id="twikoo_visitors">0</span>
```

来展示访问量。暂不支持全站访问量统计。

## 如何测试 Akismet 反垃圾配置是否生效？

请填写 `viagra-test-123` 作为昵称，或填写 `akismet-guaranteed-spam@example.com` 作为邮箱，发表评论，这条评论将一定会被视为垃圾评论。

需要注意的是，由于 Akismet 服务响应速度较慢（大约 6 秒），影响用户体验，Twikoo 采取 “先放行，后检测” 的策略，垃圾评论会在发表后短暂可见。
