# API reference

Through Twikoo API, theme developers can implement some special features, such as displaying the number of article comments in the article list, displaying the latest comments on the home page, etc.

It is **not necessary** to execute `twikoo.init()` before calling the Twikoo API.

## Get comments count

Get the number of article comments in batch.

### Version

`>= 0.2.7`

### Example

```js
twikoo
  .getCommentsCount({
    envId: "Environment ID", // Tencent CloudBase Environment ID
    // region: 'ap-guangzhou', // Environment locale, default is ap-shanghai, if your environment locale is not Shanghai, you need to pass this parameter
    urls: [
      // List of article paths without protocols, domains and parameters. It is a mandatory parameter
      "/2020/10/post-1.html",
      "/2020/11/post-2.html",
      "/2020/12/post-3.html",
    ],
    includeReply: false, // Whether the number of comments includes replies, the default parameter is false
  })
  .then(function (res) {
    console.log(res);
    // example: [
    //   { url: '/2020/10/post-1.html', count: 10 },
    //   { url: '/2020/11/post-2.html', count: 0 },
    //   { url: '/2020/12/post-3.html', count: 20 }
    // ]
  })
  .catch(function (err) {
    // If an error occurs
    console.error(err);
  });
```

## Get recent comments

Get the latest comments.

### Version

`>= 0.2.7`

### Example

```js
twikoo
  .getRecentComments({
    envId: "您的环境id", // Tencent CloudBase Environment ID
    // region: 'ap-guangzhou', // Environment locale, default is ap-shanghai, if your environment locale is not Shanghai, you need to pass this parameter
    pageSize: 10, // Get how many bars, the default parameter is 10, the maximum parameter is 100
    includeReply: false, // Whether to include the latest reply, the default parameter is false
  })
  .then(function (res) {
    console.log(res);
    // Returns Array with the latest comments
    // * id: comment ID
    // * url: address of the comment
    // * nick: nickname
    // * mailMd5: The MD5 value of the mailbox, which can be used to display the avatar
    // * link: URL
    // * comment: the content of the comment in HTML format
    // * commentText: comment content in plain text format
    // * created: comment time, in millisecond timestamp format
    // * avatar: the address of the avatar (new in 0.2.9)
    // * relativeTime: relative comment time, e.g. "1 hour ago" (new in 0.2.9)
    // Return example: [ // order from new to old
    // { id: '', url: '', nick: '', mailMd5: '', link: '', comment: '', commentText: '', created: 0 }
    // { id: '', url: '', nick: '', mailMd5: '', link: '', comment: '', commentText: '', created: 0 },
    // { id: '', url: '', nick: '', mailMd5: '', link: '', comment: '', commentText: '', created: 0 }
    // ]
  })
  .catch(function (err) {
    // If an error occurs
    console.error(err);
  });
```

## On Twikoo loaded

Callback function after Twikoo is successfully mounted. <br> It will not be triggered in case of environment ID error, network exception, mount failure, etc.

### Version

`>= 0.5.2`

### Example

```js
twikoo.init({
  ......
}).then(function () {
  console.log('Twikoo is ready to go!');
});
```

## On comment loaded

Callback function after comments are loaded successfully.<br>
It will also be triggered when the comment is automatically refreshed after posting and when the next page of comments is loaded.<br>
It will not be triggered when the comment fails to load.

### Version

`>= 0.5.2`

### Example

```js
twikoo.init({
  ......,
  onCommentLoaded: function () {
    console.log('Comment loading complete');
  }
});
```

## Server events

Besides the frontend API above, the Twikoo cloud function (HTTP endpoint) works with **events**:

```json
// request
{ "event": "COMMENT_GET", "url": "/post/1", "page": 1, "per": 8 }
// response (code 0 means success; a non-zero code is a business error)
{ "code": 0, "data": [], "more": false, "count": 0 }
```

2.0 keeps all 26 event names from 1.x unchanged (`COMMENT_GET`, `COMMENT_SUBMIT`, `COMMENT_LIKE`, `COUNTER_GET`, `GET_CONFIG`, `SET_CONFIG`, `LOGIN`, `COMMENT_IMPORT_FOR_ADMIN`, …).

### Compatibility events (scheduled for removal in 2.2.0)

For compatibility with older clients, 2.0 accepts the following legacy event names **in addition to** the new ones, and will remove them in 2.2.0:

| Legacy event  | Equivalent                                     | Notes                             |
| ------------- | ---------------------------------------------- | --------------------------------- |
| `POST_SUBMIT` | `COMMENT_SUBMIT`                               | Submit a comment (the 0.1.x name) |
| `HIDDEN`      | `COMMENT_GET_FOR_ADMIN` with `type: "HIDDEN"`  | Admin: list spam comments         |
| `VISIBLE`     | `COMMENT_GET_FOR_ADMIN` with `type: "VISIBLE"` | Admin: list approved comments     |

> If you call the function directly or maintain automation scripts, replace these three legacy names before upgrading to 2.2.0. Users of the Twikoo frontend and themes do not need to change anything.
