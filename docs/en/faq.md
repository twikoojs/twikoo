# FAQ

## How do I change my avatar?

[https://gravatar.com](https://gravatar.com) Register and set your avatar by email and leave the same email when commenting.

Visitors can also comment by entering their digital QQ email address and using their QQ avatar.

## How do I change or reset the administrator password?

[云开发控制台](https://console.cloud.tencent.com/tcb/database/collection/config)Edit the configuration, delete the `config.ADMIN_PASS `configuration item, and then go to the Twikoo administration panel to reset the password.

## How to get the private key file of the admin panel?

1. [环境-登录授权](https://console.cloud.tencent.com/tcb/env/login)Click "Private Key Download" on the right of "Custom Login" to download the private key file
2. Open the private key file with a text editor and copy all the contents
3. Click the "pinion" (settings) icon in the comment window, paste the contents of the private key file, and set the administrator password

## How to turn on article visit statistics?

You can add where you need to show the number of article visits：

``` html
<span id="twikoo_visitors">0</span>
```

to display the number of visits. We do not support site-wide visit statistics at the moment.

## How can I test if the Akismet anti-spam configuration is in effect?

Please fill in `viagra-test-123` as a nickname, or `akismet-guaranteed-spam@example.com` as an email address to post a comment, which will definitely be considered as a spam comment.

Note that due to the slow response time of the Akismet service (about 6 seconds), which affects the user experience, Twikoo adopts a "release first, detect later" policy, and spam comments will be visible for a short time after they are posted.

## How are free resources calculated?

[环境总览](https://console.cloud.tencent.com/tcb/env/overview)See resource usage. twikoo consumes **database** and **cloud functions**, both with a free usage of -

* Database: 50,000 reads/day, 50,000 writes/day
* Cloud functions: 40,000 GBs/month

The memory consumption of Twikoo cloud functions is constant at 0.1GB, which means that Twikoo cloud functions have a running time of up to 400,000 seconds per month, and the bottleneck of free resources is mainly in the daily read limit of the database. It is recommended that webmasters pay attention to the usage of free resources.

## How do I enable Katex support?

Twikoo supports Katex formulas, but to limit the package size of Twikoo, Twikoo does not have the full Katex built-in, you need to [load katex.js additionally in the page](https://katex.org/docs/browser.html).

example

``` html
<head>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.12.0/dist/katex.min.css" integrity="sha384-AfEj0r4/OFrOo5t7NnNe46zW/tFgW6x/bCJG8FqQCEo3+Aro6EYUG4+cU+KJWu/X" crossorigin="anonymous">
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.12.0/dist/katex.min.js" integrity="sha384-g7c+Jr9ZivxKLnZTDUhnkOnsh30B4H0rpLUpJ4jAIKs4fnJI+sEnkvrMWph2EDg4" crossorigin="anonymous"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.12.0/dist/contrib/auto-render.min.js" integrity="sha384-mll67QQFJfxn0IYznZYonOWZ644AWYC+Pt2cHqMaRhXVrursRwvLnLaebdGIlYNa" crossorigin="anonymous"></script>
</head>
```

After loading, you can send `$$c = \pm\sqrt{a^2 + b^2}$$` to test the effect.

![katex](../static/katex.png)

You can also pass in a custom katex configuration during `twikoo.init`, see [Katex Auto-render Extension](https://katex.org/docs/autorender.html) for details.

``` js
twikoo.init({
  envId: 'Environment id',
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

## How to configure anti-spam?

### Using Tencent Cloud Content Security Service

Twikoo supports access to Tencent Cloud Text Content Detection, which uses deep learning technology to identify harmful content involving pornography, politics, terrorism, etc. It also supports user-configurable thesaurus to combat customized offending text.

Tencent Cloud text content detection is a paid service, offering a 1-month free trial, after which the price is 25 RMB per 10,000 entries. If you don't have high requirements for anti-spam comments, you can also use the free Akismet.

How to apply for Tencent Cloud Text Content Inspection?

1. Visit [Tencent Cloud Console - Text Content Security](https://console.cloud.tencent.com/cms/text/overview) to open the text content security service
2. Visit [Tencent Cloud Console - User List](https://console.cloud.tencent.com/cam), click New User, and click Quick Create.
3. Enter the user name, select "Programmatic Access" as the access method, cancel "AdministratorAccess" as the user privilege, and only check the box "QcloudTMSFullAccess". QcloudTMSFullAccess".
4. Click "Create User". 5.
5. Copy the "SecretId" and "SecretKey" from the "Successful New User" page to the Twikoo administration panel Configure them in the "Anti-Spam" module
6. Test the anti-spam effect

After success, webmasters can configure custom text content filtering in [Tencent Cloud Console - Custom Library Management](https://console.cloud.tencent.com/cms/text/lib).

### Using Akismet Anti-Spam Service

Akismet (Automattic Kismet) is a widely used spam filtering system by Matt Mullenweg, the founder of WordPress, Akismet is also the default plugin installed in WordPress and is very widely used. The goal of the design is to help blog sites to filter spam messages.

1. Register [akismet.com](https://akismet.com)
2. Select Akismet Personal subscription, copy the Akismet API Key and configure it in the Twikoo admin panel "Anti-Spam" module

## Error encountered in login administration panel AUTH_INVALID_CUSTOM_LOGIN_TICKET

Generally, after configuring the login private key, the login private key is downloaded again, which causes the previously configured login private key to be invalid.<br>
Solution: Go to [Cloud Development Console](https://console.cloud.tencent.com/tcb/database/collection/config), database, delete the config, and then reconfigure the private key.

## Can't receive emails?

If it is a cloud function deployed by Vercel, please configure foreign mail service providers to avoid being judged as spam behavior by mail service providers. If it is other reasons, please go to Twikoo management panel, find mail test function, enter your personal mailbox and troubleshoot the reasons according to the test results.

In order to avoid performance problems caused by frequent mailbox checking, the mail configuration has a cache of about 10 minutes, if you are sure the configuration is fine but the test fails, you can wait for 10 minutes and then test again.

## Vercel can't upload images?

The Tencent Cloud environment comes with cloud storage, so you can upload images directly in the Tencent Cloud environment, and the images are saved in the cloud storage. However, Vercel environment does not, the upload image function relies on third party image bed, please configure the image bed in the admin panel, Twikoo supports the following image bed:

| Bed | Address | Features |
| ---- | ---- | ---- |
| qcloud | None | Tencent Cloud environment comes with it, can be viewed in Cloud Development - Cloud Storage |
| 7bu | https://7bu.top | Go to No Bed, powered by 杜老师, no free packages |
| smms | https://sm.ms | SMMS image bed, there is a free package, please register your account, `IMAGE_CDN_TOKEN` can be obtained in [Dashboard](https://sm.ms/home/apitoken) |
| [lsky-pro](https://www.lsky.pro) | Private Deployment | LankenGraphics 2.0 version, `IMAGE_CDN` please configure the URL address of the home page of the graph bed (such as `https://7bu.top`), `IMAGE_CDN_TOKEN` get way please refer to the tutorial [杜老师 said the graph bed: new version Go not to the bed Token acquisition and emptying](https://dusays.com/454/), the format of the obtained token should be `1\|1bJbwlqBfnggmOMEZqXT5XusaIwqiZjCDs7r1Ob5`) |

## Can it be deployed privately?

Yes.
