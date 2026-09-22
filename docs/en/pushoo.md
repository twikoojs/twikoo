# pushoo

pushoo is the instant-messaging push library used by Twikoo. Push platforms are inconsistent — some take parameters in the URL, some as form data, some as JSON; some render Markdown, some only plain text; some support a title, some do not. pushoo wraps them all behind a single `notice()` call.

Typical uses: a blog getting a new comment, server alerts, fuel price changes, daily check-in results, the pigeons at home leaving and coming back, and so on.

Since **Twikoo 2.0** pushoo lives in the Twikoo repository (`packages/pushoo`). The package name is still `pushoo`, and it is released together with Twikoo.

> The public QQ bot push service is provided by [Tianli0](https://blog.tianli0.top/). Please do not abuse it.

## Supported platforms

Webhook, [Qmsg](https://qmsg.zendee.cn/), [ServerChan](https://sct.ftqq.com/r/13235), [Push Plus](https://www.pushplus.plus/), [DingTalk](https://open.dingtalk.com/document/group/custom-robot-access), [WeCom](https://guole.fun/posts/626/), [WeCom group bot](https://developer.work.weixin.qq.com/document/path/91770), [Bark](https://github.com/Finb/Bark), [go-cqhttp](https://docs.go-cqhttp.org/api/), [atri](https://blog.tianli0.top/), [PushDeer](https://www.pushdeer.com/), [iGot](https://push.hellyw.com/), [Telegram](https://core.telegram.org/bots), [Feishu](https://www.feishu.cn/hc/zh-CN/articles/360024984973), [IFTTT](https://ifttt.com/maker_webhooks), [Discord](https://discord.com/developers/docs/resources/webhook#execute-webhook), [WxPusher](https://wxpusher.zjiecode.com/docs/#/), [Join](https://joaoapps.com/join/).

> Step-by-step token setup guides are maintained in the Chinese documentation: [pushoo](/pushoo).

## Usage

If you use Twikoo itself, no setup is needed — just pick the platform and paste the token in the Twikoo admin panel.

For GitHub Actions there is [funnyzak/pushoo-action](https://github.com/funnyzak/pushoo-action), plus a CLI: [funnyzak/pushoo-cli](https://github.com/funnyzak/pushoo-cli).

```bash
npm install pushoo
```

Whatever platform you pick, you only have to learn pushoo's own call:

```js
const pushoo = require("pushoo").default;

const result = await pushoo("platform-name", {
  token: "platform credential",
  title: "message title",
  content: "Markdown content",
});

console.log(result);
```

| Parameter | Required | Default | Description |
| ---- | ---- | ---- | ---- |
| platform | ✅ | — | Platform abbreviation, one of: `webhook`, `qmsg`, `serverchan`, `pushplus`, `dingtalk`, `wecom`, `bark`, `gocqhttp`, `atri`, `pushdeer`, `igot`, `telegram`, `feishu`, `ifttt`, `wecombot`, `discord`, `wxpusher` |
| token | ✅ | — | Platform credential (usually a string of digits and letters); see the platform guides |
| title | | first line of content | Optional. Platforms without title support get it prepended to the body |
| content | ✅ | — | Markdown content; pushoo converts it to whatever the platform supports |
| options | ❌ | — | Extra per-platform options, typed `NoticeOptions` |

`NoticeOptions` covers `webhook` (`url`, `method`), `bark` (`url`), `ifttt` (`value1`–`value3`), `discord` (`userName`, `avatarUrl`), `wxpusher` (`uids`, `url`, `verifyPay`) and `dingtalk` (`msgtype`). The full interface is documented in the Chinese page: [pushoo](/pushoo).

## Version policy

- pushoo's version no longer moves independently: it jumps from `0.1.12` straight to **`2.0.0`** and then follows Twikoo's version.
- Dependencies were upgraded: `axios` 0.26 → 1.x, `marked` 4 → 18.
- The API is unchanged: `notice()` and `NoticeOptions` stay compatible.

If your `package.json` pins `"pushoo": "^0.1.x"` it will **not** move to 2.0.0 on its own (a major bump never crosses `^0.1`). Change it to `"pushoo": "^2.0.0"` and reinstall; no call-site changes are needed.
