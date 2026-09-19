/**
 * UPLOAD_IMAGE 事件处理器（1.x uploadImage 语义对齐）。
 */
import type { EventHandler } from "../core/types";
import { uploadImage } from "../services/upload";

/**
 * 上传图片到配置的图床（IMAGE_CDN 分发；NSFW 检测可选拦截）。
 * @param ctx 请求上下文
 * @returns 上传响应
 */
export const uploadImageEvent: EventHandler = (ctx) =>
  uploadImage({
    photo: ctx.request.body.photo,
    config: ctx.config,
    caps: ctx.adapters.capabilities,
  });
