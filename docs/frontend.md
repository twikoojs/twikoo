# 前端部署

## 在 Hexo 中使用

### 在 [Hexo Butterfly](https://github.com/jerryc127/hexo-theme-butterfly) 主题使用

请参考 [Butterfly 安裝文檔(四) 主題配置-2](https://butterfly.js.org/posts/ceeb73f/#%E8%A9%95%E8%AB%96) 进行配置

### 在 [Hexo Keep](https://github.com/XPoet/hexo-theme-keep) 主题使用

请参考 [hexo-theme-keep/_config.yml](https://github.com/XPoet/hexo-theme-keep/blob/master/_config.yml) 进行配置

### 在 [Hexo Volantis](https://github.com/volantis-x/hexo-theme-volantis) 主题使用

请参考 [hexo-theme-volantis/_config.yml](https://github.com/volantis-x/hexo-theme-volantis/blob/master/_config.yml) 进行配置

### 在 [Hexo Ayer](https://github.com/Shen-Yu/hexo-theme-ayer) 主题使用

请参考 [hexo-theme-ayer/_config.yml](https://github.com/Shen-Yu/hexo-theme-ayer/blob/master/_config.yml) 进行配置

### 在 [Hexo NexT](https://github.com/next-theme/hexo-theme-next) 主题使用

**暂不支持 NexT 8 以下的版本**，请先升级到 NexT 8。然后在 Hexo 项目根目录执行

``` sh
# For NexT version >= 8.0.0 && < 8.4.0
npm install hexo-next-twikoo@1.0.0
# For NexT version >= 8.4.0
npm install hexo-next-twikoo@1.0.3
```

然后在配置中添加

``` yml
twikoo:
  enable: true
  visitor: true
  envId: xxxxxxxxxxxxxxx # 腾讯云环境填 envId；Vercel 环境填地址（https://xxx.vercel.app）
  # region: ap-guangzhou # 环境地域，默认为 ap-shanghai，腾讯云环境填 ap-shanghai 或 ap-guangzhou；Vercel 环境不填
```

### 在 [Hexo Matery](https://github.com/blinkfox/hexo-theme-matery) 主题使用

请参考 [hexo-theme-matery/_config.yml](https://github.com/blinkfox/hexo-theme-matery/blob/develop/_config.yml) 进行配置

### 在 [Hexo Icarus](https://github.com/ppoffice/hexo-theme-icarus) 主题使用

请参考 [基于腾讯云，给你的 Icarus 博客配上 Twikoo 评论系统](https://www.anzifan.com/post/icarus_to_candy_2/) by 异次元de机智君💯

### 在 [Hexo MengD(萌典)](https://github.com/lete114/hexo-theme-MengD) 主题使用

请参考 [hexo-theme-MengD/_config.yml](https://github.com/lete114/hexo-theme-MengD/blob/master/_config.yml) 进行配置

### 在 [hexo-theme-fluid](https://github.com/fluid-dev/hexo-theme-fluid) 主题使用

请参考 [配置指南-评论](https://hexo.fluid-dev.com/docs/guide/#%E8%AF%84%E8%AE%BA) 进行配置

### 在 [hexo-theme-cards](https://github.com/ChrAlpha/hexo-theme-cards) 主题使用

请参考 [hexo-theme-cards/_config.yml](https://github.com/ChrAlpha/hexo-theme-cards/blob/master/_config.yml) 进行配置

### 在 [maupassant-hexo](https://github.com/tufu9441/maupassant-hexo) 主题使用

请参考 [maupassant-hexo/_config.yml](https://github.com/tufu9441/maupassant-hexo/blob/master/_config.yml) 进行配置

### 在 [hexo-theme-redefine](https://github.com/EvanNotFound/hexo-theme-redefine) 主题使用

请参考 [Redefine 官方文档 #comment](https://redefine-docs.ohevan.com/docs/configuration-guide/comment#twikoo) 进行配置

### 在 [Hexo-Theme-Solitude](https://github.com/valor-x/hexo-theme-solitude) 主题使用

请参考 [Solitude 文档](https://solitude-docs.efu.me/comments/twikoo) 进行配置

## 在 Hugo 中使用

### 在 [hugo-theme-stack](https://github.com/CaiJimmy/hugo-theme-stack) 主题使用

请参考 [Comments | Stack](https://stack.jimmycai.com/config/comments) 和 [hugo-theme-stack/config.yaml#L83](https://github.com/CaiJimmy/hugo-theme-stack/blob/master/config.yaml#L83) 进行配置

### 在 [FixIt](https://github.com/hugo-fixit/FixIt) 主题使用

请参考 [入门篇 - FixIt #主题配置](https://fixit.lruihao.cn/zh-cn/documentation/basics/#theme-configuration) 和 [hugo-fixit/FixIt/config.toml#L613-L624](https://github.com/hugo-fixit/FixIt/blob/8bb2a35dcc4c54fc3e0fb968df063d6be1daabf3/config.toml#L613-L624) 进行配置

## 在 VitePress 中使用

请参考 [VitePress 集成 twikoo 参考解决方案](https://github.com/twikoojs/twikoo/issues/715) 进行配置。

## 通过 CDN 引入

::: tip 提示
如果您使用的博客主题不支持 Twikoo，并且您不知道如何引入 Twikoo，您可以向博客主题开发者提交适配请求
:::

``` html
<div id="tcomment"></div>
<script src="https://cdn.jsdelivr.net/npm/twikoo@1.7.4/dist/twikoo.min.js"></script>
<script>
twikoo.init({
  envId: '您的环境id', // 腾讯云环境填 envId；Vercel 环境填地址（https://xxx.vercel.app）
  el: '#tcomment', // 容器元素
  // region: 'ap-guangzhou', // 环境地域，默认为 ap-shanghai，腾讯云环境填 ap-shanghai 或 ap-guangzhou；Vercel 环境不填
  // path: location.pathname, // 用于区分不同文章的自定义 js 路径，如果您的文章路径不是 location.pathname，需传此参数
  // lang: 'zh-CN', // 用于手动设定评论区语言，支持的语言列表 https://github.com/twikoojs/twikoo/blob/main/src/client/utils/i18n/index.js
})
</script>
```

### 不同版本之间的区别

* `twikoo.all.min.js`: 包含腾讯云云开发（tcb）的完整版本，如果您使用腾讯云云开发部署，请选择此版本
* `twikoo.min.js`: 去除了腾讯云云开发（tcb）的精简版本，体积更小，适合所有非腾讯云云开发部署的用户
* `twikoo.nocss.js`: 在完整版本的基础上剥离了样式，需要同时引入 `twikoo.css` 才能正常显示，适合想要魔改评论区样式的用户

### 更换 CDN 镜像

如果遇到默认 CDN 加载速度缓慢，可更换其他 CDN 镜像。以下为可供选择的公共 CDN，其中一些 CDN 可能需要数天时间同步最新版本：

#### 推荐在中国使用

* `https://registry.npmmirror.com/twikoo/1.7.4/files/dist/twikoo.min.js`
* `https://s4.zstatic.net/npm/twikoo@1.7.4/dist/twikoo.min.js`

#### 推荐在全球使用

* `https://cdn.jsdelivr.net/npm/twikoo@1.7.4/dist/twikoo.min.js`

#### 备用选项

* `https://s4.zstatic.net/ajax/libs/twikoo/1.6.41/twikoo.min.js`
* `https://lib.baomitu.com/twikoo/1.6.39/twikoo.min.js`

::: warning 注意
建议使用 CDN 引入 Twikoo 的用户在链接地址上锁定版本，以免将来 Twikoo 升级时受到非兼容性更新的影响。
:::

::: warning 注意
建议使用 CDN 引入 Twikoo 的用户在代码中加入 [SRI](https://developer.mozilla.org/zh-CN/docs/Web/Security/Subresource_Integrity) 以确保完整性，例：
```html
<script
  src="https://cdn.jsdelivr.net/npm/twikoo@1.6.36/dist/twikoo.all.min.js"
  integrity="sha384-4KfOjEinLSkv1i1J8TzlkC/RTnuiLoR1OLerVgjEKoH5djYtbf7mzEFsz9p3nfuA"
  crossorigin="anonymous"></script>
```
其中 `integrity` 的值可以在 [SRI Hash Generator](https://www.srihash.org/) 查询。
:::

## 开启管理面板（腾讯云环境）

1. 进入[环境-登录授权](https://console.cloud.tencent.com/tcb/env/login)，点击“自定义登录”右边的“私钥下载”，下载私钥文件
2. 用文本编辑器打开私钥文件，复制全部内容
3. 点击评论窗口的“小齿轮”图标，粘贴私钥文件内容，并设置管理员密码

配置好登录私钥之后无需留存私钥文件，请勿再次下载登录私钥，否则会导致之前配置的登录私钥失效。

## 开启管理面板（非腾讯云环境）

点击评论窗口的“小齿轮”图标，设置管理员密码
