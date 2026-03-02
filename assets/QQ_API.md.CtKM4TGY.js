import{_ as i,o as a,c as n,ah as l}from"./chunks/framework.DEuJ2jJS.js";const g=JSON.parse('{"title":"QQ私有化部署文档","description":"","frontmatter":{},"headers":[],"relativePath":"QQ_API.md","filePath":"QQ_API.md","lastUpdated":null}'),p={name:"QQ_API.md"};function h(k,s,t,e,r,d){return a(),n("div",null,[...s[0]||(s[0]=[l(`<h1 id="qq私有化部署文档" tabindex="-1">QQ私有化部署文档 <a class="header-anchor" href="#qq私有化部署文档" aria-label="Permalink to &quot;QQ私有化部署文档&quot;">​</a></h1><h2 id="_1-下载go-cq" tabindex="-1">1. 下载go-cq <a class="header-anchor" href="#_1-下载go-cq" aria-label="Permalink to &quot;1. 下载go-cq&quot;">​</a></h2><p>前往<a href="https://github.com/Mrs4s/go-cqhttp" target="_blank" rel="noreferrer">go-cqhttp release</a>下载对应系统版本。</p><h2 id="_2-配置服务" tabindex="-1">2. 配置服务 <a class="header-anchor" href="#_2-配置服务" aria-label="Permalink to &quot;2. 配置服务&quot;">​</a></h2><p>解压</p><blockquote><p>Windows下请使用自己熟悉的解压软件自行解压</p></blockquote><blockquote><p>Linux下在命令行中输入tar -xzvf [文件名] 使用</p></blockquote><p><strong>Windows 标准方法</strong></p><p>双击，根据提示生成运行脚本go-cqhttp_*.exe</p><p><code>[WARNING]: 尝试加载配置文件 config.yml 失败: 文件不存在 [INFO]: 默认配置文件已生成,请编辑 config.yml 后重启程序.</code></p><p>配置文件请参考下方config.yml</p><p>config.yml配置好后 再次双击运行脚本</p><p><code>[INFO]: 登录成功 欢迎使用: balabala</code></p><p>如出现需要认证的信息, 请自行认证设备。</p><p>此时, 基础配置完成</p><p><strong>Linux 标准方法</strong></p><p>通过 SSH 连接到服务器</p><p>cd到解压目录</p><p>输入 , 运行 <code>./go-cqhttp</code></p><p><code>[WARNING]: 尝试加载配置文件 config.yml 失败: 文件不存在 [INFO]: 默认配置文件已生成,请编辑 config.yml 后重启程序.</code></p><p><strong>配置config.yml</strong></p><div class="language-yaml vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">yaml</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;"># go-cqhttp 默认配置文件</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">account</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;"># 账号相关</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">  uin</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">:  </span><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;"># QQ账号</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">  password</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&#39;&#39;</span><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;"> # 密码为空时使用扫码登录</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">  encrypt</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">false</span><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  # 是否开启密码加密</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">  status</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">0</span><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">      # 在线状态 请参考 https://docs.go-cqhttp.org/guide/config.html#在线状态</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">  relogin</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;"># 重连设置</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">    delay</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">3</span><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">   # 首次重连延迟, 单位秒</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">    interval</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">3</span><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">   # 重连间隔</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">    max-times</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">0</span><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  # 最大重连次数, 0为无限制</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  # 是否使用服务器下发的新地址进行重连</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  # 注意, 此设置可能导致在海外服务器上连接情况更差</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">  use-sso-address</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">true</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">heartbeat</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">:</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  # 心跳频率, 单位秒</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  # -1 为关闭心跳</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">  interval</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">5</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">message</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">:</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  # 上报数据类型</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  # 可选: string,array</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">  post-format</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">string</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  # 是否忽略无效的CQ码, 如果为假将原样发送</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">  ignore-invalid-cqcode</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">false</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  # 是否强制分片发送消息</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  # 分片发送将会带来更快的速度</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  # 但是兼容性会有些问题</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">  force-fragment</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">false</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  # 是否将url分片发送</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">  fix-url</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">false</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  # 下载图片等请求网络代理</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">  proxy-rewrite</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&#39;&#39;</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  # 是否上报自身消息</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">  report-self-message</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">false</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  # 移除服务端的Reply附带的At</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">  remove-reply-at</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">false</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  # 为Reply附加更多信息</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">  extra-reply-data</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">false</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">output</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">:</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  # 日志等级 trace,debug,info,warn,error</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">  log-level</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">warn</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  # 是否启用 DEBUG</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">  debug</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">false</span><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;"> # 开启调试模式</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;"># 默认中间件锚点</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">default-middlewares</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">&amp;</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">default</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  # 访问密钥, 强烈推荐在公网的服务器设置</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">  access-token</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&#39;&#39;</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  # 事件过滤器文件目录</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">  filter</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&#39;&#39;</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  # API限速设置</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  # 该设置为全局生效</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  # 原 cqhttp 虽然启用了 rate_limit 后缀, 但是基本没插件适配</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  # 目前该限速设置为令牌桶算法, 请参考:</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  # https://baike.baidu.com/item/%E4%BB%A4%E7%89%8C%E6%A1%B6%E7%AE%97%E6%B3%95/6597000?fr=aladdin</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">  rate-limit</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">:</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">    enabled</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">true</span><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;"> # 是否启用限速</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">    frequency</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">1</span><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  # 令牌回复频率, 单位秒</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">    bucket</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">1</span><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">     # 令牌桶大小</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">database</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;"># 数据库相关设置</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">  leveldb</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">:</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">    # 是否启用内置leveldb数据库</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">    # 启用将会增加10-20MB的内存占用和一定的磁盘空间</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">    # 关闭将无法使用 撤回 回复 get_msg 等上下文相关功能</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">    enable</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">true</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;"># 连接服务列表</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">servers</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">:</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  # 添加方式，同一连接方式可添加多个，具体配置说明请查看文档</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  #- http: # http 通信</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  #- ws:   # 正向 Websocket</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  #- ws-reverse: # 反向 Websocket</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  #- pprof: #性能分析服务器</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  # HTTP 通信设置</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  - </span><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">http</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">:</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">      # 服务端监听地址</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">      host</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">127.0.0.1</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">      # 服务端监听端口</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">      port</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">5700</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">      # 反向HTTP超时时间, 单位秒</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">      # 最小值为5，小于5将会忽略本项设置</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">      timeout</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">5</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">      middlewares</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">:</span></span>
<span class="line"><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">        &lt;&lt;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">*</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">default </span><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;"># 引用默认中间件</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">      # 反向HTTP POST地址列表</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">      post</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">:</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">      #- url: &#39;&#39; # 地址</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">      #  secret: &#39;&#39;           # 密钥</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">      #- url: 127.0.0.1:5701 # 地址</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">      #  secret: &#39;&#39;          # 密钥</span></span></code></pre></div><p>再次运行<code>./go-cqhttp</code></p><p><code>[INFO]: 登录成功 欢迎使用: balabala</code></p><p>如出现需要认证的信息, 请自行认证设备。</p><p>此时, 基础配置完成</p><h2 id="注意-将你配置的端口号在防火墙里面放行或者使用反向代理将你设置的端口绑定到域名" tabindex="-1">注意:将你配置的端口号在防火墙里面放行或者使用反向代理将你设置的端口绑定到域名 <a class="header-anchor" href="#注意-将你配置的端口号在防火墙里面放行或者使用反向代理将你设置的端口绑定到域名" aria-label="Permalink to &quot;注意:将你配置的端口号在防火墙里面放行或者使用反向代理将你设置的端口绑定到域名&quot;">​</a></h2><h2 id="注意-公网使用一定要配置token" tabindex="-1">注意:公网使用一定要配置token <a class="header-anchor" href="#注意-公网使用一定要配置token" aria-label="Permalink to &quot;注意:公网使用一定要配置token&quot;">​</a></h2><h2 id="_3-twikoo配置" tabindex="-1">3. twikoo配置 <a class="header-anchor" href="#_3-twikoo配置" aria-label="Permalink to &quot;3. twikoo配置&quot;">​</a></h2><p>在twikoo中QQ私有化API配置项填写如下内容</p><p>QQ号 <code>http://你的IP地址：端口号（或者域名）/send_private_msg?user_id=QQ号?token=你配置的token</code></p><p>QQ群 <code>http://你的IP地址：端口号（或者域名）/send_group_msg?token=你配置的token?group_id=群号</code></p><p>配置完成</p>`,33)])])}const y=i(p,[["render",h]]);export{g as __pageData,y as default};
