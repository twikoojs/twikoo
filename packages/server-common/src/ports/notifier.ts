/**
 * 通知端口（规范 §6.2 ports/notifier.ts「通知发送（pushoo / webhook）」）。
 *
 * pushoo 及其通道依赖由声明通知能力的适配器自行安装（D-2 依赖外部化）；
 * 本端口把 1.x noticePushoo 的推送内容归一化为单一载荷，通道差异由适配器消化。
 */

/** 通知载荷（1.x getIMPushContent 归一化形态） */
export interface NotifyPayload {
  /** 通知标题（如「xx站点有新评论了」，来自 MAIL_SUBJECT_ADMIN 配置或默认模板） */
  title: string;
  /** 通知正文（Markdown 文本：评论人 / IP / 内容 / 原文链接） */
  content: string;
  /** 原文链接（bark 等通道的跳转 URL，可选） */
  url?: string;
}

/**
 * 通知发送端口。
 * 发送失败以异常上抛，由业务层捕获记录（通知失败不阻断评论主流程）；
 * 未声明通知能力的适配器提供空实现即可。
 */
export interface Notifier {
  /** 发送一条即时通知 */
  notify(payload: NotifyPayload): Promise<void>;
}
