# API 文档

通过 Twikoo API，主题开发者可以实现一些特殊的功能，例如：在文章列表显示文章评论数，在首页显示最新评论，等。

调用 Twikoo API 前，**不需要** 执行 `twikoo.init()`。

## Get comments count

批量获取文章评论数。

### Version

`>= 0.2.7`

### Example

```js
twikoo
  .getCommentsCount({
    envId: "您的环境id", // 环境 ID
    // region: 'ap-guangzhou', // 环境地域，默认为 ap-shanghai，如果您的环境地域不是上海，需传此参数
    urls: [
      // 不包含协议、域名、参数的文章路径列表，必传参数
      "/2020/10/post-1.html",
      "/2020/11/post-2.html",
      "/2020/12/post-3.html",
    ],
    includeReply: false, // 评论数是否包括回复，默认：false
  })
  .then(function (res) {
    console.log(res);
    // 返回示例: [
    //   { url: '/2020/10/post-1.html', count: 10 },
    //   { url: '/2020/11/post-2.html', count: 0 },
    //   { url: '/2020/12/post-3.html', count: 20 }
    // ]
  })
  .catch(function (err) {
    // 发生错误
    console.error(err);
  });
```

## Get recent comments

获取最新评论。

### Version

`>= 0.2.7`

### Example

```js
twikoo
  .getRecentComments({
    envId: "您的环境id", // 环境 ID
    // region: 'ap-guangzhou', // 环境地域，默认为 ap-shanghai，如果您的环境地域不是上海，需传此参数
    urls: [
      // 要求云函数版本 >= 1.6.27。不包含协议、域名、参数的文章路径列表，不传默认获取所有最新评论
      "/2020/10/post-1.html",
      "/2020/11/post-2.html",
      "/2020/12/post-3.html",
    ],
    pageSize: 10, // 获取多少条，默认：10，最大：100
    includeReply: false, // 是否包括最新回复，默认：false
  })
  .then(function (res) {
    console.log(res);
    // 返回 Array，包含最新评论的
    //   * id:           评论 ID
    //   * url:          评论地址
    //   * nick:         昵称
    //   * mailMd5:      邮箱的 MD5 值，可用于展示头像
    //   * link:         网址
    //   * comment:      HTML 格式的评论内容
    //   * commentText:  纯文本格式的评论内容
    //   * created:      评论时间，格式为毫秒级时间戳
    //   * avatar:       头像地址（0.2.9 新增）
    //   * relativeTime: 相对评论时间，如 “1 小时前”（0.2.9 新增）
    // 返回示例: [ // 从新到旧顺序
    //   { id: '', url: '', nick: '', mailMd5: '', link: '', comment: '', commentText: '', created: 0 },
    //   { id: '', url: '', nick: '', mailMd5: '', link: '', comment: '', commentText: '', created: 0 },
    //   { id: '', url: '', nick: '', mailMd5: '', link: '', comment: '', commentText: '', created: 0 }
    // ]
  })
  .catch(function (err) {
    // 发生错误
    console.error(err);
  });
```

## On Twikoo loaded

Twikoo 成功挂载后的回调函数。<br>
环境 ID 错误、网络异常、挂载失败等情况时不会触发。

### Version

`>= 0.5.2`

### Example

```js
twikoo.init({
  ......
}).then(function () {
  console.log('Twikoo 加载完成');
});
```

## On comment loaded

评论加载成功后的回调函数。<br>
发表评论后自动刷新评论时、加载下一页评论时，也会触发。<br>
评论加载失败时不会触发。

### Version

`>= 0.5.2`

### Example

```js
twikoo.init({
  ......,
  onCommentLoaded: function () {
    console.log('评论加载完成');
  }
});
```

## 服务端事件

除上面的前端 API 之外，Twikoo 的云函数（HTTP 接口）以「事件」为请求单位：

```json
// 请求
{ "event": "COMMENT_GET", "url": "/post/1", "page": 1, "per": 8 }
// 响应（code 为 0 表示成功，非 0 为业务错误）
{ "code": 0, "data": [], "more": false, "count": 0 }
```

2.0 保持 1.x 的事件名不变（`COMMENT_GET` / `COMMENT_SUBMIT` / `COMMENT_LIKE` / `COUNTER_GET` / `GET_CONFIG` / `SET_CONFIG` / `LOGIN` / `COMMENT_IMPORT_FOR_ADMIN` 等），共 **24 个客户端事件**，另有 1 个服务端内部事件 `POST_SUBMIT`（见下）。

> **关于 `HIDDEN` / `VISIBLE`**：它们**不是事件名**。管理端按「垃圾 / 已通过」筛选时，是把 `HIDDEN` / `VISIBLE` 作为 `COMMENT_GET_FOR_ADMIN` 请求体的 **`type` 参数**传入：
>
> ```json
> { "event": "COMMENT_GET_FOR_ADMIN", "type": "HIDDEN", "per": 10, "page": 1 }
> ```
>
> 1.x 与 2.0 都是这个机制（1.x 的 `getCommentSearchCondition` 按 `event.type` 过滤）。

### `POST_SUBMIT`（服务端内部事件，非兼容分支）

`POST_SUBMIT` **不是** `COMMENT_SUBMIT` 的旧名，**也不会在 2.2.0 移除**。它是服务端的
**后置副作用事件**：`COMMENT_SUBMIT` 保存评论后，由各平台自己的机制把本事件送到一个
独立执行单元，在那里执行耗时的垃圾检测与邮件 / 即时消息通知。

这样做是因为这些操作依赖外部网络、耗时不可控。如果内联在提交请求里：一是用户要等
很久，二是超出云函数执行时间上限时**整个提交都会失败**——而评论其实已经入库，客户端
却收到错误，用户重试还会产生重复评论。

| 平台                           | 派发机制                                   |
| ------------------------------ | ------------------------------------------ |
| 自托管 / Deta / EdgeOne Makers | 进程内直接调用，不等待                     |
| 腾讯云 CloudBase               | `callFunction` 递归自调用                  |
| Vercel / Netlify               | HTTP 递归自调用                            |
| AWS Lambda                     | 原生异步 Invoke（`InvocationType: Event`） |

> 本事件带内部派发令牌校验（`x-twikoo-recursion` 请求头）：外部直接调用会被拒绝
> （`code` 1403）。因此**不要在自定义客户端里调用它**。
