#  QQ私有化部署文档
## 1. 下载go-cq
前往[go-cqhttp release](https://github.com/Mrs4s/go-cqhttp)下载对应系统版本。
## 2. 配置服务
解压

> Windows下请使用自己熟悉的解压软件自行解压

> Linux下在命令行中输入tar -xzvf [文件名]
使用

**Windows 标准方法**

双击，根据提示生成运行脚本go-cqhttp_*.exe

`[WARNING]: 尝试加载配置文件 config.yml 失败: 文件不存在
[INFO]: 默认配置文件已生成,请编辑 config.yml 后重启程序.`

配置文件请参考下方config.yml


config.yml配置好后 再次双击运行脚本

`[INFO]: 登录成功 欢迎使用: balabala`

如出现需要认证的信息, 请自行认证设备。

此时, 基础配置完成

**Linux 标准方法**


通过 SSH 连接到服务器

cd到解压目录

输入 , 运行 `./go-cqhttp`


`[WARNING]: 尝试加载配置文件 config.yml 失败: 文件不存在
[INFO]: 默认配置文件已生成,请编辑 config.yml 后重启程序.`


**配置config.yml**

```yaml

# go-cqhttp 默认配置文件

account: # 账号相关
  uin:  # QQ账号
  password: '' # 密码为空时使用扫码登录
  encrypt: false  # 是否开启密码加密
  status: 0      # 在线状态 请参考 https://docs.go-cqhttp.org/guide/config.html#在线状态
  relogin: # 重连设置
    delay: 3   # 首次重连延迟, 单位秒
    interval: 3   # 重连间隔
    max-times: 0  # 最大重连次数, 0为无限制

  # 是否使用服务器下发的新地址进行重连
  # 注意, 此设置可能导致在海外服务器上连接情况更差
  use-sso-address: true

heartbeat:
  # 心跳频率, 单位秒
  # -1 为关闭心跳
  interval: 5

message:
  # 上报数据类型
  # 可选: string,array
  post-format: string
  # 是否忽略无效的CQ码, 如果为假将原样发送
  ignore-invalid-cqcode: false
  # 是否强制分片发送消息
  # 分片发送将会带来更快的速度
  # 但是兼容性会有些问题
  force-fragment: false
  # 是否将url分片发送
  fix-url: false
  # 下载图片等请求网络代理
  proxy-rewrite: ''
  # 是否上报自身消息
  report-self-message: false
  # 移除服务端的Reply附带的At
  remove-reply-at: false
  # 为Reply附加更多信息
  extra-reply-data: false

output:
  # 日志等级 trace,debug,info,warn,error
  log-level: warn
  # 是否启用 DEBUG
  debug: false # 开启调试模式

# 默认中间件锚点
default-middlewares: &default
  # 访问密钥, 强烈推荐在公网的服务器设置
  access-token: ''
  # 事件过滤器文件目录
  filter: ''
  # API限速设置
  # 该设置为全局生效
  # 原 cqhttp 虽然启用了 rate_limit 后缀, 但是基本没插件适配
  # 目前该限速设置为令牌桶算法, 请参考:
  # https://baike.baidu.com/item/%E4%BB%A4%E7%89%8C%E6%A1%B6%E7%AE%97%E6%B3%95/6597000?fr=aladdin
  rate-limit:
    enabled: true # 是否启用限速
    frequency: 1  # 令牌回复频率, 单位秒
    bucket: 1     # 令牌桶大小

database: # 数据库相关设置
  leveldb:
    # 是否启用内置leveldb数据库
    # 启用将会增加10-20MB的内存占用和一定的磁盘空间
    # 关闭将无法使用 撤回 回复 get_msg 等上下文相关功能
    enable: true

# 连接服务列表
servers:
  # 添加方式，同一连接方式可添加多个，具体配置说明请查看文档
  #- http: # http 通信
  #- ws:   # 正向 Websocket
  #- ws-reverse: # 反向 Websocket
  #- pprof: #性能分析服务器
  # HTTP 通信设置
  - http:
      # 服务端监听地址
      host: 127.0.0.1
      # 服务端监听端口
      port: 5700
      # 反向HTTP超时时间, 单位秒
      # 最小值为5，小于5将会忽略本项设置
      timeout: 5
      middlewares:
        <<: *default # 引用默认中间件
      # 反向HTTP POST地址列表
      post:
      #- url: '' # 地址
      #  secret: ''           # 密钥
      #- url: 127.0.0.1:5701 # 地址
      #  secret: ''          # 密钥
 
      



```


再次运行`./go-cqhttp`


`[INFO]: 登录成功 欢迎使用: balabala`

如出现需要认证的信息, 请自行认证设备。

此时, 基础配置完成

## 注意:将你配置的端口号在防火墙里面放行或者使用反向代理将你设置的端口绑定到域名
## 注意:公网使用一定要配置token

## 3. twikoo配置
在twikoo中QQ私有化API配置项填写如下内容

QQ号
`http://你的IP地址：端口号（或者域名）/send_private_msg?user_id=QQ号?token=你配置的token`

QQ群
`http://你的IP地址：端口号（或者域名）/send_group_msg?token=你配置的token?group_id=群号`

配置完成
