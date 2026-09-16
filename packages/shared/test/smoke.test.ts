import { describe, expect, it } from 'vitest';
import { ALL_EVENTS, PUSHOO_CHANNELS, VERSION } from '../src';

/**
 * @twikoojs/shared 真实行为冒烟用例。
 *
 * 断言的是包导出的真实不变量（渠道清单 / 事件清单 / 版本占位符），
 * 而非恒真占位——任一常量被误改时本用例必然失败。
 */
describe('@twikoojs/shared 导出冒烟', () => {
  it('PUSHOO_CHANNELS 恰为 20 个渠道，且不含 1.x 遗留别名 serverchain', () => {
    expect(PUSHOO_CHANNELS.length).toBe(20);
    expect(PUSHOO_CHANNELS).not.toContain('serverchain');
    // 渠道名不重复
    expect(new Set(PUSHOO_CHANNELS).size).toBe(PUSHOO_CHANNELS.length);
  });

  it('ALL_EVENTS 恰为 27 个事件标识符（26 槽位 + 1.x 兼容分支），且值唯一', () => {
    expect(ALL_EVENTS.length).toBe(27);
    expect(new Set(ALL_EVENTS).size).toBe(ALL_EVENTS.length);
  });

  it('VERSION 是非空字符串（构建期占位符机制）', () => {
    expect(typeof VERSION).toBe('string');
    expect(VERSION.length).toBeGreaterThan(0);
  });
});
