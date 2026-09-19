/**
 * CloudBase SDK 与云函数调用上下文的最小结构面。
 *
 * 只声明本适配器实际用到的成员（数据库、递归自调用、函数名），避免把
 * `@cloudbase/node-sdk` 的类型作为编译期硬依赖——与仓库既有的
 * `CloudBaseDatabaseLike` 同一思路。
 */
import type { CloudBaseDatabaseLike } from "@twikoojs/common";

/** `@cloudbase/node-sdk` 的 app 实例（`init()` 返回值） */
export interface TcbAppLike {
  /**
   * 取数据库实例。
   * @returns 数据库句柄
   */
  database(): CloudBaseDatabaseLike;
  /**
   * 调用另一个云函数（POST_SUBMIT 递归自调用用）。
   * @param options 目标函数名与事件数据
   * @param config 调用配置（timeout：毫秒）
   * @returns 调用结果
   */
  callFunction(
    options: { name: string; data?: unknown },
    config?: { timeout?: number },
  ): Promise<unknown>;
}

/** `@cloudbase/node-sdk` 静态形态（v2 具名导出 / v3 default 导出，形状一致） */
export interface TcbSdkStatic {
  /** 当前环境占位符（`init({ env })` 用） */
  SYMBOL_CURRENT_ENV: symbol;
  /**
   * 初始化 SDK。
   * @param options 初始化项（env：环境标识）
   * @returns app 实例
   */
  init(options: { env: symbol }): TcbAppLike;
}

/** 云函数调用上下文（`exports.main` 第二参数） */
export interface TcbContextLike {
  /** 当前云函数名（递归自调用时需要） */
  function_name?: string;
  /**
   * 平台注入的上下文环境变量（含 `TCB_SOURCE_IP`）。
   * 与 `@cloudbase/node-sdk` 的 `getCloudbaseContext()` 取值来源一致。
   */
  environment?: Record<string, string>;
  /** 同上（SDK 兼容的另一个字段名，`getCloudbaseContext` 会先看 environment 再看它） */
  environ?: Record<string, string>;
}
