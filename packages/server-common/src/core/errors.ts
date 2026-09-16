/**
 * pipeline 层错误类型（规范 §6.2 / §8.3）。
 *
 * pipeline catch 按错误类型决定 HTTP 状态与错误体；业务 handler 抛出的普通
 * Error 统一转为 `{ code: FAIL, message }`（1.x 语义：业务错误不改变 HTTP 200）。
 */

/**
 * 限流超限错误（1.x protect 的 'Too Many Requests' 升级为类型化错误）。
 * pipeline 捕获后返回 HTTP 429（2.0 改进：客户端 TwikooError 按 429
 * 映射「请求过于频繁」提示，§8.2 场景表）。
 */
export class RateLimitError extends Error {
  /** @param ip 被限流的客户端 IP */
  constructor(ip: string) {
    super("Too Many Requests");
    this.name = "RateLimitError";
    /** 被限流的客户端 IP（日志排障用） */
    this.ip = ip;
  }

  /** 被限流的客户端 IP */
  ip: string;
}

/**
 * 事件处理器未注册错误（过渡期守卫：T18 迁移完成前，dispatcher 对已枚举但
 * 尚无实现的 24 个常规事件抛出；pipeline catch 转为 FAIL 错误体，绝不静默）。
 */
export class HandlerNotRegisteredError extends Error {
  /** @param event 未注册处理器的事件名 */
  constructor(event: string) {
    super(`事件 ${event} 的处理器尚未注册（T18 迁移中）`);
    this.name = "HandlerNotRegisteredError";
  }
}
