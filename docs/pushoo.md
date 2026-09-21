# pushoo

pushoo 是 Twikoo 使用的即时消息推送库。

消息推送平台多用于在特定的场合提醒使用者，例如：博客收到评论、服务器告警、油价上涨、每日签到结果推送、家中饲养的鸽子外出、飞回，等等……自从方糖气球推出 Server 酱以来，消息推送平台逐渐多样化，他们遵循的 API 格式却很混乱：

- 有的是 URL 地址传参，有的是 form 表单传参，有的是 JSON 传参，暂时还没看到 XML 传参的；
- 有的正文支持 Markdown，有的正文支持 HTML，有的正文支持纯文本；
- 有的支持标题，有的不支持标题。

Twikoo 评论系统对不同的消息推送平台做了大量的适配工作，云函数越来越大。为了降低云函数复杂度，遂诞生了 pushoo，旨在整合各大消息推送平台服务，获得统一的调用体验。

自 **Twikoo 2.0** 起 pushoo 已并入 Twikoo 仓库（`packages/pushoo`），**包名 `pushoo` 不变**，版本随 Twikoo 一并发布。API 与旧版本兼容，详见 [版本策略](#版本策略)。

> 本项目由 [Tianli0](https://blog.tianli0.top/) 提供公益 QQ 机器人推送服务，请勿用于非法用途！（机器人 QQ 将不定期更换）

## 支持的消息推送平台

- Webhook
- [Qmsg](https://qmsg.zendee.cn/)
- [Server 酱](https://sct.ftqq.com/r/13235)
- [Push Plus](https://www.pushplus.plus/)
- [Push Plus Hxtrip](https://pushplus.hxtrip.com/)
- [钉钉](https://open.dingtalk.com/document/group/custom-robot-access)
- [企业微信](https://guole.fun/posts/626/)
- [企业微信群机器人](https://developer.work.weixin.qq.com/document/path/91770)
- [Bark](https://github.com/Finb/Bark)
- [go-cqhttp](https://docs.go-cqhttp.org/api/)
- [atri](https://blog.tianli0.top/)
- [PushDeer](https://www.pushdeer.com/)
- [iGot](https://push.hellyw.com/)
- [Telegram](https://core.telegram.org/bots)
- [飞书](https://www.feishu.cn/hc/zh-CN/articles/360024984973)
- [IFTTT](https://ifttt.com/maker_webhooks)
- [Discord](https://discord.com/developers/docs/resources/webhook#execute-webhook)
- [WxPusher](https://wxpusher.zjiecode.com/docs/#/)
- [Join](https://joaoapps.com/join/)

## 使用方法

注：如果您是在 Twikoo 评论系统中使用，则无需搭建，直接在 Twikoo 管理面板中配置平台名称和 token 即可。

如果您是在 GitHub Actions 中使用，可以使用 [funnyzak/pushoo-action](https://github.com/funnyzak/pushoo-action)，该作者还提供了基于 pushoo 的命令行工具：[funnyzak/pushoo-cli](https://github.com/funnyzak/pushoo-cli)。

安装

```bash
npm install pushoo
```

现在，不论您使用什么推送平台，都无需关心他们的调用方式，只需要学习 pushoo 的调用方式即可开始发送您的第一条推送！

```js
const pushoo = require("pushoo").default;

const result = await pushoo("平台名称", {
  token: "平台用户身份标识",
  title: "消息标题",
  content: "Markdown 格式的推送内容",
});

console.log(result);
```

是的，调用 pushoo 最简单只需要传递 4 个参数！

| 参数     | 必填 | 默认       | 说明                                                                                                                                                                                                                               |
| -------- | ---- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 平台名称 | ✅   | 无         | 字符串，平台名称的缩写，支持：`webhook`、`qmsg`、`serverchan`、`pushplus`、`pushplushxtrip`、`dingtalk`、`wecom`、`bark`、`gocqhttp`、`onebot`、`atri`、`pushdeer`、`igot`、`telegram`、`feishu`、`lark`、`ifttt`、`wecombot`、`discord`、`wxpusher` |
| token    | ✅   | 无         | 平台用户身份标识，通常情况下是一串数字和字母组合，详情和示例见下方详细说明                                                                                                                                                         |
| title    |      | 内容第一行 | 可选，消息标题，如果推送平台不支持消息标题，则会拼接在正文首行                                                                                                                                                                     |
| content  | ✅   | 无         | Markdown 格式的推送内容，如果推送平台不支持 Markdown，pushoo 会自动转换成支持的格式                                                                                                                                                |
| options  | ❌   | 无         | 用于推送时的一些额外配置。类型`NoticeOptions`                                                                                                                                                                                      |

```typescript
interface NoticeOptions {
  /**
   * webhook 通知方式的参数配置
   */
  webhook?: {
    /**
     * url 发送通知的地址
     */
    url: string;
    /**
     * method 请求方法，默认为 POST
     */
    method?: "GET" | "POST";
  };
  /**
   * bark 通知方式的参数配置
   */
  bark?: {
    /**
     * url 用于点击通知后跳转的地址
     */
    url?: string;
  };
  /**
   * IFTTT 通知方式的参数配置
   */
  ifttt?: {
    value1?: string;
    value2?: string;
    value3?: string;
  };
  /**
   * Discord 通知方式的参数配置
   */
  discord?: {
    userName?: string;
    avatarUrl?: string;
  };
  /**
   * WxPusher 通知方式的参数配置
   */
  wxpusher?: {
    uids?: string[];
    url?: string;
    verifyPay?: boolean;
  };
  dingtalk?: {
    /**
     * 消息类型，目前支持 text、markdown。不设置，默认为 text。
     */
    msgtype?: string;
  };
}
```

## 各平台详细说明

### 💬 Webhook <sub>缩写：`webhook`</sub>

Webhook 是一种用户定义的 HTTP 回调，通常用于将实时数据推送到指定的 URL。pushoo 可以通过 Webhook 方式将消息推送到你自定义的后端。

示例调用：

```js
let respond = await pushoo("webhook", {
  token: "", // 可选，暂不支持签名
  title: "", // 可选
  content: "推送内容",
  options: {
    webhook: {
      url: "https://example.com/webhook-endpoint",
      method: "POST", // 可选，默认为 POST，也可以设置为 GET
    },
  },
});
```

特别地，为兼容 Twikoo 中现有的使用方式，可以直接把平台名称设置为 Webhook 的 URL 地址（以 `http://` 或 `https://` 开头），无需传入 `options`。

```js
let respond = await pushoo("https://example.com/webhook-endpoint", {
  token: "", // 可选
  title: "", // 可选
  content: "推送内容",
});
```

此时如果 URL 的末尾为 `:GET` 则使用 GET 方法发送请求（实际 URL 自动去掉 `:GET`），否则默认使用 POST 方法发送请求。

### 💬 [Qmsg](https://qmsg.zendee.cn/) <sub>缩写：`qmsg`</sub>

Qmsg 酱是 Zendee 提供的第三方 QQ 消息推送服务，免费，消息以 QQ 消息的形式推送，支持私聊推送和群推送。请注意，为避免 Qmsg 酱被 Tencent 冻结，pushoo 会自动删除消息中的网址和 IP 地址。

1. 前往 [https://qmsg.zendee.cn/](https://qmsg.zendee.cn/) 并使用 QQ 登录
2. 点击“管理台”，选择一个 Qmsg 酱，并添加 TA 为好友
3. 在“我的 QQ 列表”中添加自己的 QQ 号
4. 复制“我的 KEY”下方的 key，填入 pushoo 的 token 中

示例 token：`d3e96b6c50adf28cc6d1bb*****a4613`

### 💬 [Server 酱](https://sct.ftqq.com/r/13235) <sub>缩写：`serverchan`</sub>

Server 酱是方糖提供的第三方多渠道推送服务，以服务号推送起家，稳定运行多年，免费收费并存，特色功能较多。

1. 前往 [https://sct.ftqq.com/r/13235](https://sct.ftqq.com/r/13235) 并使用微信登录
2. 点击“消息通道”，设置合适的消息通道并保存
3. 点击“SendKey”，复制“SendKey”下方的 key，填入 pushoo 的 token 中

示例 token：`SCT1364TKdsiGjGvyAZNYD*****VAK0k`

### 💬 [Push Plus](https://www.pushplus.plus/) <sub>缩写：`pushplus`</sub>

Push Plus 是苏州破壳网络科技有限公司提供的第三方微信服务号推送服务，免费版存在不影响使用的广告，会员版特权如下：[https://www.pushplus.plus/vip.html](https://www.pushplus.plus/vip.html)。

1. 前往 [https://www.pushplus.plus/](https://www.pushplus.plus/) 并使用微信登录
2. 点击“一对一推送”，复制“你的 token”下方的 token，填入 pushoo 的 token 中

示例 token：`2832134a66df4da69ef941*****72317`

### 💬 [Push Plus Hxtrip](https://pushplus.hxtrip.com/) <sub>缩写：`pushplushxtrip`</sub>

Push Plus Hxtrip 是中道（苏州）旅游网络科技有限公司提供的第三方微信服务号推送服务，免费无广告

1. 前往 [https://pushplus.hxtrip.com/message](https://pushplus.hxtrip.com/message) 并使用微信登录
2. 复制“您的 Token”下方的 Token，填入 pushoo 的 token 中

示例 token：`2a00acb27e414ea4bf9d19*****08986`

### 💬 [钉钉](https://open.dingtalk.com/document/group/custom-robot-access) <sub>缩写：`dingtalk`</sub>

钉钉是阿里推出的办公即时消息软件，官方提供了机器人 API，可实现消息推送，免费。推送的消息必须包含配置的关键字，否则推送不成功。只能在群聊中创建机器人，可选择 2 名好友组建群聊，然后移除 2 名好友（好友会收到提醒，请谨慎操作），再添加机器人。

1. 根据 [https://open.dingtalk.com/document/group/custom-robot-access](https://open.dingtalk.com/document/group/custom-robot-access) 的说明，创建一个机器人。如果是在 Twikoo 评论系统中使用，请配置关键字为“评论”
2. 复制机器人的 Webhook，填入 pushoo 的 token 中

示例 token：`https://oapi.dingtalk.com/robot/send?access_token=06ff1823a060af772677680d9522b547bc2685251d47bed17ddada*****41d97`（完整的 Webhook）或者 `06ff1823a060af772677680d9522b547bc2685251d47bed17ddada*****41d97`（只保留 access token）

### 💬 [企业微信](https://guole.fun/posts/626/) <sub>缩写：`wecom`</sub>

企业微信应用消息推送，免费，限制较少。

1. 用电脑打开 [https://work.weixin.qq.com/](https://work.weixin.qq.com/)，注册一个企业
2. 注册成功后，点「管理企业」进入管理界面，选择「应用管理」 → 「自建」 → 「创建应用」
3. 应用名称填入机器人的名称，应用 logo 选择机器人的头像，可见范围选择公司名
4. 创建完成后进入应用详情页，可以得到应用 ID( `agentid` )，应用 Secret( `secret` )，复制<br>
   PS：获取应用 Secret 时，可能会将其推送到企业微信客户端，这时候微信里边是看不到的，需要在企业微信客户端里边才能看到
5. 自 2022 年 6 月 20 日起，企业微信要求[自建应用配置可信 IP](https://work.weixin.qq.com/nl/act/p/32d807ad4c554975)，且可信 IP 不可公用。在企业微信管理后台进入第 4 步创建的应用详情页，找到「企业可信 IP」配置项，添加调用接口的服务器公网 IP。私有部署填服务器公网 IP 即可；Serverless 等出口 IP 不固定的部署方式可能无法通过校验<br>
   PS：若推送失败，日志出现「不安全的访问 IP」或错误码 `60020`，表示当前出口 IP 不在可信 IP 列表中，原因可能是未配置、配置错误或配置已过期。详见[官方错误码说明](https://developer.work.weixin.qq.com/document/path/90475#%E9%94%99%E8%AF%AF%E7%A0%81%EF%BC%9A60020)
6. 进入「[我的企业](https://work.weixin.qq.com/wework_admin/frame#profile)」页面，拉到最下边，可以看到企业 ID，复制
7. 进入「我的企业」 → 「[微信插件](https://work.weixin.qq.com/wework_admin/frame#profile/wxPlugin)」，拉到下边扫描二维码，关注以后即可收到推送的消息
8. 将第 4 步和第 6 步取得的 `企业ID#应用Secret#应用ID` 拼到一起，中间用“`#`”号分隔，填入 pushoo 的 token 中

示例 token：`ww97a01a*****1e5f1#xHapDXmgZtlBgRQQXMb4kfh3y75Ynoubl*****l9ytE#1000005`

PS：如果出现接口请求正常，企业微信接受消息正常，个人微信无法收到消息的情况，请确认如下配置：

- 进入「我的企业」 → 「微信插件」，拉到最下方，勾选「允许成员在微信插件中接收和回复聊天消息」
- 在企业微信客户端「我」 → 「设置」 → 「新消息通知」中关闭「仅在企业微信中接受消息」限制条件

PS：如果推送失败，日志中出现错误码 60020（not allow to access from your ip），说明企业微信对调用方 IP 有限制，需将部署 Twikoo 的服务器出口 IP 加入可信 IP 名单：

- 进入「应用管理」 → 选择对应自建应用 → 「企业可信 IP」，填入服务器 IP
- 排查入口：[接口调试工具](https://open.work.weixin.qq.com/devtool/query?e=60020)、[错误码 60020 说明](https://developer.work.weixin.qq.com/document/path/90475#错误码：60020)
- 只有具备稳定出口 IP 的部署才能直接配置可信 IP；其他平台需要配置固定出口（例如 NAT）或持续同步平台公布的完整 IP 网段，本机部署则为公网出口 IP

### 💬 [Bark](https://github.com/Finb/Bark) <sub>缩写：`bark`</sub>

Bark 是 iOS 通知中心推送工具，可以推送消息到苹果手机上，免费。

1. 下载 [Bark APP](https://apps.apple.com/cn/app/bark-%E7%BB%99%E4%BD%A0%E7%9A%84%E6%89%8B%E6%9C%BA%E5%8F%91%E6%8E%A8%E9%80%81/id1403753865)
2. 轻触下方“服务器”，复制第一个服务器地址，删除“这里改成你自己的推送内容”字样，填入 pushoo 的 token 中

示例 token：`https://api.day.app/q2S4vQqpNyaS*****9neeJ/`（完整的 URL）或者 `q2S4vQqpNyaS*****9neeJ`（只保留 token）

### 💬 [go-cqhttp](https://docs.go-cqhttp.org/api/) <sub>缩写：`gocqhttp`</sub>

go-cqhttp 是开源 QQ 机器人程序，免费，需自行搭建，插件十分丰富，但“野生”机器人并没有得到 Tencent 官方的支持，有账号被冻结的风险。

PS：go-cqhttp 已停止维护（[仓库](https://github.com/Mrs4s/go-cqhttp) 最后一次提交为 2024-05，最新版本仍是 2023-10 发布的 v1.2.0），新部署建议改用 OneBot 协议的实现（NapCat、Lagrange.OneBot 等），配置方式见下方 OneBot 章节；已配置好的 go-cqhttp 可继续使用，接口本身没有变化。

1. 前往 [go-cqhttp release](https://github.com/Mrs4s/go-cqhttp) 下载对应系统版本
2. 此处省略安装过程，可参考 [https://docs.go-cqhttp.org/guide/quick_start.html](https://docs.go-cqhttp.org/guide/quick_start.html)
3. 修改配置文件，配置 `default-middlewares` 下面的 `access-token`，启动 go-cqhttp
4. 按照示例所示的 API 调用地址，填入 pushoo 的 token 中

示例 token：`http://你的IP或域名:端口号/send_private_msg?user_id=QQ号&access_token=你配置的token`（QQ 号）或 `http://你的IP或域名:端口号/send_group_msg?group_id=群号&access_token=你配置的token`（QQ 群）

### 💬 [OneBot](https://11.onebot.dev/) <sub>缩写：`onebot`</sub>

OneBot 是 QQ 机器人应用层协议标准，NapCat、Lagrange、LLOneBot 等实现均支持，免费，需自行搭建。Twikoo 仅使用其正向 HTTP 通信，不做长连接。

1. 部署一个 OneBot 11 实现（如 [NapCat](https://github.com/NapNeko/NapCatQQ)、[Lagrange.OneBot](https://github.com/LagrangeDev/Lagrange.Core)），启用 HTTP 服务端
2. 按示例所示的 API 调用地址，填入 pushoo 的 token 中

示例 token：`http://你的IP或域名:端口号/send_private_msg?user_id=QQ号`（QQ 号，鉴权 token 追加 `&access_token=你配置的token`）或 `http://你的IP或域名:端口号/send_group_msg?group_id=群号&access_token=你配置的token`（QQ 群）

PS：`onebot` 与 `gocqhttp` 的 API 路径相同，但请求形态不同——本通道会把 token 里的 `user_id`、`group_id` 从 URL 移到 JSON 请求体中（`access_token` 仍留在 URL 上），而 `gocqhttp` 用表单编码的 `message` 体。若从 go-cqhttp 迁移，按上述格式重填 token 即可，接口文档见 [https://11.onebot.dev/](https://11.onebot.dev/)

### 💬 [atri](https://github.com/TIANLI0/push-bot-api/) <sub>缩写：`atri`</sub>

go-cqhttp 是开源 QQ 机器人程序，由[Tianli](https://blog.tianli0.top/)提供的 pushoo 推送服务。

使用前请加机器人好友（QQ：2102916311）

示例 token：`1627236613`（QQ 号）

### 💬 [PushDeer](https://www.pushdeer.com/) <sub>缩写：`pushdeer`</sub>

PushDeer 是方糖一个开源的无 APP 推送解决方案，支持 iOS 14+ 轻应用、MacOS 11+ 客户端、Android 快应用，免费。

1. 前往 [https://www.pushdeer.com/product.html](https://www.pushdeer.com/product.html) 扫码打开轻应用并登录
2. 轻触下方“Key”，轻触右上角“+”号创建第一个 Key，复制，填入 pushoo 的 token 中

示例 token：`PDU431TfFHZICvR6lJrFBswSRN1cJ*****zzFvR`

### 💬 [iGot](https://push.hellyw.com/) <sub>缩写：`igot`</sub>

iGot 是一款聚合 APP、邮箱、微信等多种推送方式的第三方推送平台，免费，存在影响体验的广告。

1. 根据 [https://push.hellyw.com/doc/](https://push.hellyw.com/doc/) 的说明，获取推送 key，填入 pushoo 的 token 中

示例 token：`621f3b1dd2eba1*****101d9`

### 💬 [Telegram](https://core.telegram.org/bots) <sub>缩写：`telegram`</sub>

Telegram 是自由的聊天工具，支持机器人 API，免费，中国大陆服务器无法使用这种推送方式。

1. 通过 [@BotFather](https://t.me/BotFather) 创建机器人，并获取 `api_token`
2. 通过 [@userinfobot](https://t.me/userinfobot) 获取接受消息对象的 `chat_id`。接受消息的对象可以是用户，频道，或群组
3. 将第 1 步和第 2 步取得的 `api_token#chat_id` 拼到一起，中间用“`#`”号分隔，填入 pushoo 的 token 中

示例 token：`5262***170:AAEzkaMjOayU13fFzcg9PI7_7*****p1iAs#958***732`

### 💬 [飞书](https://www.feishu.cn/hc/zh-CN/articles/360024984973) <sub>缩写：`feishu`</sub>

飞书是字节跳动旗下的办公即时消息软件，官方提供了机器人 API，可实现消息推送，免费。推送的消息必须包含配置的关键字，否则推送不成功。只能在群聊中创建机器人。

1. 进入群组，打开会话设置，找到群机器人，并点击添加机器人，选择自定义机器人并添加。如果是在 Twikoo 评论系统中使用，请配置关键字为“评论”
2. 复制机器人的 Webhook，填入 pushoo 的 token 中

示例 token：`https://open.feishu.cn/open-apis/bot/v2/hook/393df85f-7b2c-4ff6-bd4f-*******3ed54`（完整的 Webhook）或者 `393df85f-7b2c-4ff6-bd4f-*******3ed54`（只保留 access token）

### 💬 [Lark](https://open.larksuite.com/) <sub>缩写：`lark`</sub>

Lark 是飞书的国际版，机器人配置方式与飞书相同，`lark` 通道会把 Webhook 指向 `open.larksuite.com`。

1. 在 Lark 群组中添加自定义机器人，复制机器人的 Webhook
2. 将 Webhook 或其中的 access token 填入 pushoo 的 token 中

示例 token：`https://open.larksuite.com/open-apis/bot/v2/hook/393df85f-7b2c-4ff6-bd4f-*******3ed54`（完整的 Webhook）或者 `393df85f-7b2c-4ff6-bd4f-*******3ed54`（只保留 access token）

PS：两个开放平台的 API 是互通的，已经填了完整 Webhook 的场景用 `feishu` 也能发出，`lark` 主要用于只持有 access token、需要拼接国际版域名的情况

### 💬 [IFTTT](https://ifttt.com/maker_webhooks) <sub>缩写：`ifttt`</sub>

IFTTT Webhooks 推送，免费。

1. 首先打开 [http://ifttt.com/maker](http://ifttt.com/maker)，确保你的 WebHooks 服务是可以用；
2. 点击 `Document` 获取你的 **Key**, 点击 `Create` 开始创建一个 Applet；
3. If this Then that, this 选择 WebHooks，Trigger 选择 Receive a web request，Event Name 填一个有意义的，如 `push`；
4. if this then that, that 选择 Notification，参数填 Value1、Value2、Value3;
5. 将 2 步获取的 **key** 和 第 3 步设置的 **Event Name** 拼接到一起，中间用“`#`”号分隔，填入 pushoo 的 token 中。

示例 token：`d-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx#push`

PS: title 和 content 会分别对应 Value1 和 Value2，如果要设置 Value3 请在 options 设置

### 💬 [WECOMBOT](https://developer.work.weixin.qq.com/document/path/91770) <sub>缩写：`wecombot`</sub>

企业微信群机器人推送，免费。

1. 使用企业微信，作为群管理员，创建一个群机器人，复制出机器人的 Webhook；
2. 然后在 Webhook 中提取出 `key` 值，填入 pushoo 的 token 中。

示例 token: `https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxxxxxxx-xxxx-xx` Webhook 中提取 Token 为 `xxxxxxxx-xxxx-xx`;

### 💬 [Discord](https://discord.com/developers/docs/resources/webhook#execute-webhook) <sub>缩写：`discord`</sub>

Discord Webhooks 推送，免费。

1. 打开 Discord，进入频道设置，找到 webhook，点击创建`webhook`；
2. 复制 webhook 的 url，将整个 URL 填入 pushoo 的`token`中。
3. 如果需要设置用户名和头像，可以在`options`中设置。
4. token 设置也可以通过提取 `webhook` url 中的 `id` 和 `token` 来设置，格式为 `id#token`。如：`https://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz`，则 token 设置为 `123456789012345678#abcdefghijklmnopqrstuvwxyz`。

示例 token：

- `https://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz`
- `123456789012345678#abcdefghijklmnopqrstuvwxyz`

### 💬 [WxPusher](https://wxpusher.zjiecode.com/docs/) <sub>缩写：`wxpusher`</sub>

WxPusher 是一款微信推送平台，免费。

1. 打开 [https://wxpusher.zjiecode.com/docs/](https://wxpusher.zjiecode.com/admin/)，注册账号，创建应用，获取 `appToken`;
2. 创建主题，获取主题 ID。如：`1234`；
3. 使用微信关注创建的主题，完成主题订阅；
4. 如果需要设置特定推送用户，可以在 `options` 中设置 `uids`; 如果要设置消息跳转链接，可以在 `options` 中设置 `url`；如果需要设置验证支付，可以在 `options` 中设置 `verifyPay`；
5. 最后获取的 `appToken` 和 `topicId` 拼接到一起，中间用“`#`”号分隔，填入 pushoo 的 token 中（如果有多个主题 ID，可用半角逗号分隔）。

示例 token:

- 单个主题 ID：`AT_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX#1234`
- 多个主题 ID：`AT_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX#1234,5678`

### 💬 [Join](https://joaoapps.com/join/) <sub>缩写：`join`</sub>

<!-- TODO -->

示例 token: `apiKey#deviceId`

## 计划支持的推送平台

- 阿里云短信
- 腾讯云短信

## 版本策略

- **版本号不再独立演进**：由 `0.1.12` 直接跳到 **`2.0.0`**，此后跟随 Twikoo 统一版本；
- **HTTP 层改用原生 `fetch`**：不再依赖 `axios`（axios 依赖 Node 的 `http` 模块，在 Cloudflare Workers 等运行时不可用），`marked` 4 → 18；
- **API 不变**：`notice()` 与 `NoticeOptions` 的签名与行为保持兼容。

对使用方的影响：如果您在 `package.json` 里写的是 `"pushoo": "^0.1.x"`，**不会**自动升到 2.0.0（major 变更本就跨不过 `^0.1`）——需要手动改成 `"pushoo": "^2.0.0"` 后再安装。升级后原有 `notice()` 调用无需改动。
