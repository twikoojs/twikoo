<img src="./docs/static/logo.png" width="300" alt="Twikoo">

----

[![](https://img.shields.io/npm/v/twikoo)](https://www.npmjs.com/package/twikoo)
[![](https://img.shields.io/bundlephobia/minzip/twikoo)](https://bundlephobia.com/result?p=twikoo)
[![](https://img.shields.io/npm/dt/twikoo)](https://www.npmjs.com/package/twikoo)
[![](https://img.shields.io/npm/l/twikoo)](./LICENSE)

一个简洁、安全、免费的静态网站评论系统，基于[腾讯云开发](https://curl.qcloud.com/KnnJtUom)。<br>
A simple, safe, free comment system based on Tencent CloudBase (tcb).

## 特色 | Features

* 免费搭建（※1）
* 隐私安全（※2）
* 支持邮件与微信通知（※3）
* 支持反垃圾评论（※4）

注：<br>
※1 Twikoo 使用云开发作为评论后台，每个用户均长期享受1个免费的标准型基础版1资源套餐<br>
※2 Twikoo 通过云函数控制敏感字段（邮箱、IP、环境配置等）不会泄露<br>
※3 微信提醒基于 [Server酱](https://sc.ftqq.com/3.version)，需自行注册并获取API key<br>
※4 反垃圾基于 [akismet.com](https://akismet.com/)，需自行注册并获取API key

## 预览 | Preview

### 评论

![评论](./docs/static/readme-1.png)

### 评论管理

![评论管理](./docs/static/readme-2.png)

### 推送通知

![推送通知](./docs/static/readme-3.jpg)

## 快速上手 | Quick Start

请查看[快速上手](https://twikoo.js.org/quick-start.html)

> 如果你想获取更新动态、建言献策、参与内测，欢迎加入内测群：<br>
> <img height="300" alt="1080829142" src="https://www.imaegoo.com/gallery/2020/hello-twikoo.png" />

<!-- ## 贡献者 | Contributors -->

## 特别感谢 | Special Thanks

图标设计：[Maemo Lee](https://www.maemo.cc)

<!-- ## 捐赠 | Donate -->

## 更新日志 & 开发计划 | Release notes & plans

[更新日志](https://github.com/imaegoo/twikoo/releases) & [开发计划](https://github.com/imaegoo/twikoo/projects/1)

## 开发 | Development

如果您想在本地二次开发，可以参考以下命令：

``` sh
yarn dev # 开发 (http://localhost:9820/demo.html)
yarn lint # 代码检查
yarn build # 编译 (dist/twikoo.all.min.js)
```

如果您的改动能够帮助到更多人，欢迎提交 Pull Request！

## 国际化 | I18N

鉴于腾讯云云开发在中国以外地区的支持程度（文档只有中文版本，环境没有国际版本，在中国以外地区访问缓慢），本项目暂无国际化计划。有国际化需求的站长，推荐使用另一个安全的评论系统 [Waline](https://waline.js.org/)。<br>
There are no plans to internationalize this project.

## 许可 | License

[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fimaegoo%2Ftwikoo.svg?type=large)](https://app.fossa.com/projects/git%2Bgithub.com%2Fimaegoo%2Ftwikoo?ref=badge_large)
