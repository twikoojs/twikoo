/**
 * 图片上传服务（1.x utils/image.js 移植）。
 *
 * 图床矩阵：7bu / S.EE / 兰空（URL 或 lskypro）/ PicList / EasyImage /
 * Chevereto / S3（原生 SigV4，零 SDK）。NSFW 检测（NSFW_API_URL）可选拦截。
 */
import { createHash, createHmac, randomBytes } from "node:crypto";
import type { Capabilities } from "../ports/capabilities";
import type { ConfigData } from "../ports/database";
import type { TkResponseBody } from "../ports/response";
import { RES_CODE } from "../utils/constants";
import { getAxios, getFormData, type FormDataLike } from "../utils/lib-loader";
import { isUrl } from "./comment-dto";

/** 最大图片体积（10 MB） */
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

/** 解析后的图片载荷 */
interface ParsedImage {
  /** 图片字节 */
  body: Buffer;
  /** MIME 类型 */
  mimeType: string;
  /** 随机文件名 */
  fileName: string;
}

/** 图片魔数识别表（JPEG/PNG/GIF/WebP，1.x IMAGE_TYPES 对齐） */
const IMAGE_TYPES: Array<{
  mimeType: string;
  extension: string;
  matches: (body: Buffer) => boolean;
}> = [
  {
    mimeType: "image/jpeg",
    extension: "jpg",
    /**
     *
     */
    matches: (body) => body.length >= 3 && body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff,
  },
  {
    mimeType: "image/png",
    extension: "png",
    /**
     *
     */
    matches: (body) =>
      body.length >= 8 &&
      body.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    mimeType: "image/gif",
    extension: "gif",
    /**
     *
     */
    matches: (body) =>
      body.length >= 6 &&
      (body.subarray(0, 6).equals(Buffer.from("GIF87a")) ||
        body.subarray(0, 6).equals(Buffer.from("GIF89a"))),
  },
  {
    mimeType: "image/webp",
    extension: "webp",
    /**
     *
     */
    matches: (body) =>
      body.length >= 12 &&
      body.subarray(0, 4).equals(Buffer.from("RIFF")) &&
      body.subarray(8, 12).equals(Buffer.from("WEBP")),
  },
];

/**
 * 解析 base64 图片载荷（1.x parseImage 对齐：体积、data URL 头、
 * base64 合法性、魔数与 MIME 一致性四重校验）。
 * @param photo data URL 形态的 base64 图片
 * @returns 解析结果
 */
export function parseImage(photo: unknown): ParsedImage {
  if (typeof photo !== "string" || photo.length > Math.ceil(MAX_IMAGE_SIZE / 3) * 4 + 64) {
    throw new Error("图片大小不能超过 10 MB");
  }
  const header = /^data:([a-z0-9.+-]+\/[a-z0-9.+-]+);base64,/i.exec(photo);
  if (!header) {
    throw new Error("图片数据格式不合法");
  }
  const declaredMimeType = header[1].toLowerCase();
  const base64 = photo.slice(header[0].length);
  if (!base64 || base64.length % 4 !== 0 || !/^[a-z0-9+/]*={0,2}$/i.test(base64)) {
    throw new Error("图片数据格式不合法");
  }
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  const decodedSize = (base64.length * 3) / 4 - padding;
  if (decodedSize > MAX_IMAGE_SIZE) {
    throw new Error("图片大小不能超过 10 MB");
  }
  const body = Buffer.from(base64, "base64");
  const imageType = IMAGE_TYPES.find((type) => type.matches(body));
  if (!imageType) {
    throw new Error("仅支持 JPEG、PNG、GIF 和 WebP 图片");
  }
  if (declaredMimeType !== imageType.mimeType) {
    throw new Error("图片 MIME 类型与文件内容不匹配");
  }
  return {
    body,
    mimeType: imageType.mimeType,
    fileName: `${randomBytes(16).toString("hex")}.${imageType.extension}`,
  };
}

/**
 * FormData 附加图片（1.x appendImage 对齐）。
 * @param formData FormData 实例
 * @param fieldName 字段名
 * @param image 解析后的图片
 */
function appendImage(
  formData: InstanceType<FormDataLike>,
  fieldName: string,
  image: ParsedImage,
): void {
  formData.append(fieldName, image.body, {
    filename: image.fileName,
    contentType: image.mimeType,
    knownLength: image.body.length,
  });
}

/**
 * UPLOAD_IMAGE 事件处理（1.x uploadImage 链路对齐：配置校验 → NSFW → 分发）。
 * @param options 上传入参
 * @returns 上传响应（res.data 含各图床返回）
 */
export async function uploadImage(options: {
  photo: unknown;
  config: ConfigData;
  caps: Capabilities;
}): Promise<TkResponseBody> {
  const { config, caps } = options;
  const photo = options.photo;
  /** 响应体 */
  const res: TkResponseBody = {};
  const imageService = config.IMAGE_CDN;
  try {
    if (imageService === "s3") {
      // S3 图床只需要配置相关 S3 参数，不需要 IMAGE_CDN_TOKEN
      if (!config.S3_BUCKET || !config.S3_ACCESS_KEY_ID || !config.S3_SECRET_ACCESS_KEY) {
        throw new Error("未配置 S3 图床参数（S3_BUCKET、S3_ACCESS_KEY_ID、S3_SECRET_ACCESS_KEY）");
      }
    } else if (!imageService || !config.IMAGE_CDN_TOKEN) {
      throw new Error("未配置图片上传服务");
    }
    // 已知服务名先行校验（未知名直接报错，避免多余的动态依赖加载）
    const knownServices = ["7bu", "see", "lskypro", "piclist", "easyimage", "chevereto", "s3"];
    if (
      typeof imageService === "string" &&
      !knownServices.includes(imageService) &&
      !isUrl(imageService)
    ) {
      throw new Error("不支持的图片上传服务");
    }
    const axios = await getAxios();
    const image = parseImage(photo);
    if (config.NSFW_API_URL) {
      const nsfwResult = await checkNsfw({ image, config, caps });
      if (nsfwResult.rejected) {
        res.code = RES_CODE.NSFW_REJECTED;
        res.err = nsfwResult.message;
        return res;
      }
    }
    const FormData = await getFormData(caps);
    /** 上传辅助（各图床共享的上下文） */
    const ctx = { image, config, res, axios, FormData: FormData as never };
    // tip: qcloud 图床走前端上传，其他图床走后端上传
    if (imageService === "7bu") {
      await uploadImageToLskyPro({ ...ctx, imageCdn: "https://7bu.top" });
    } else if (imageService === "see") {
      await uploadImageToSee({ ...ctx, imageCdn: "https://s.ee/api/v1/file/upload" });
    } else if (typeof imageService === "string" && isUrl(imageService)) {
      await uploadImageToLskyPro({ ...ctx, imageCdn: imageService });
    } else if (imageService === "lskypro") {
      await uploadImageToLskyPro({ ...ctx, imageCdn: config.IMAGE_CDN_URL as string });
    } else if (imageService === "piclist") {
      await uploadImageToPicList({ ...ctx, imageCdn: config.IMAGE_CDN_URL as string });
    } else if (imageService === "easyimage") {
      await uploadImageToEasyImage(ctx);
    } else if (imageService === "chevereto") {
      await uploadImageToChevereto(ctx);
    } else if (imageService === "s3") {
      await uploadImageToS3(ctx);
    } else {
      throw new Error("不支持的图片上传服务");
    }
  } catch (e) {
    res.code = RES_CODE.UPLOAD_FAILED;
    res.err = e instanceof Error ? e.message : String(e);
  }
  return res;
}

/**
 * NSFW 检测（1.x checkNsfw 对齐：分数超阈值拒绝；检测失败不拦截）。
 * @param params 检测入参
 * @returns 拒绝判定
 */
async function checkNsfw(params: {
  image: ParsedImage;
  config: ConfigData;
  caps: Capabilities;
}): Promise<{ rejected: boolean; message: string }> {
  const { image, config, caps } = params;
  const result = { rejected: false, message: "" };
  try {
    const threshold = parseFloat(String(config.NSFW_THRESHOLD)) || 0.5;
    const apiUrl = String(config.NSFW_API_URL).replace(/\/$/, "");
    const FormData = await getFormData(caps);
    const formData = new FormData();
    appendImage(formData, "image", image);
    const axios = await getAxios();
    const response = await axios.post(`${apiUrl}/classify`, formData, {
      headers: (formData as unknown as { getHeaders(): Record<string, string> }).getHeaders(),
      timeout: 30000,
    });
    const scores = response.data as Record<string, number>;
    if (scores && typeof scores === "object") {
      const nsfwScore = (scores.porn || 0) + (scores.hentai || 0) + (scores.sexy || 0);
      if (nsfwScore > threshold) {
        result.rejected = true;
        result.message = `图片包含不当内容，检测分数 ${nsfwScore.toFixed(3)} 超过阈值 ${threshold}`;
      }
    }
  } catch {
    // NSFW 检测失败不拦截上传（1.x 语义）
  }
  return result;
}

/**
 * S.EE 图床上传（1.x uploadImageToSee 对齐）。
 */
async function uploadImageToSee(ctx: {
  image: ParsedImage;
  config: ConfigData;
  res: TkResponseBody;
  axios: Awaited<ReturnType<typeof getAxios>>;
  FormData: never;
  imageCdn: string;
}): Promise<void> {
  const FormData = ctx.FormData as FormDataLike;
  const formData = new FormData();
  appendImage(formData, "smfile", ctx.image);
  const uploadResult = await ctx.axios.post(ctx.imageCdn, formData, {
    headers: {
      ...(formData as unknown as { getHeaders(): Record<string, string> }).getHeaders(),
      Authorization: ctx.config.IMAGE_CDN_TOKEN as string,
    },
  });
  const data = uploadResult.data as {
    success?: boolean;
    message?: string;
    data?: unknown;
  };
  if (data.success) {
    ctx.res.data = data.data;
  } else {
    throw new Error(data.message ?? "上传失败");
  }
}

/**
 * 兰空图床 v2 上传（1.x uploadImageToLskyPro 对齐；7bu/自定义 URL 同协议）。
 */
async function uploadImageToLskyPro(ctx: {
  image: ParsedImage;
  config: ConfigData;
  res: TkResponseBody;
  axios: Awaited<ReturnType<typeof getAxios>>;
  FormData: never;
  imageCdn: string;
}): Promise<void> {
  const FormData = ctx.FormData as FormDataLike;
  const formData = new FormData();
  appendImage(formData, "file", ctx.image);
  const url = `${ctx.imageCdn}/api/v1/upload`;
  let token = String(ctx.config.IMAGE_CDN_TOKEN);
  if (!token.startsWith("Bearer")) {
    token = `Bearer ${token}`;
  }
  const uploadResult = await ctx.axios.post(url, formData, {
    headers: {
      ...(formData as unknown as { getHeaders(): Record<string, string> }).getHeaders(),
      Authorization: token,
    },
  });
  const data = uploadResult.data as {
    status?: boolean;
    message?: string;
    data?: { links?: { url?: string } };
  };
  if (data.status) {
    const payload = (data.data ?? {}) as Record<string, unknown>;
    payload.url = data.data?.links?.url;
    ctx.res.data = payload;
  } else {
    throw new Error(data.message ?? "上传失败");
  }
}

/**
 * PicList 图床上传（1.x uploadImageToPicList 对齐：query key 鉴权）。
 */
async function uploadImageToPicList(ctx: {
  image: ParsedImage;
  config: ConfigData;
  res: TkResponseBody;
  axios: Awaited<ReturnType<typeof getAxios>>;
  FormData: never;
  imageCdn: string;
}): Promise<void> {
  const FormData = ctx.FormData as FormDataLike;
  const formData = new FormData();
  appendImage(formData, "file", ctx.image);
  let url = `${ctx.imageCdn}/upload`;
  if (ctx.config.IMAGE_CDN_TOKEN) {
    url += `?key=${ctx.config.IMAGE_CDN_TOKEN}`;
  }
  const uploadResult = await ctx.axios.post(url, formData);
  const data = uploadResult.data as {
    success?: boolean;
    message?: string;
    result?: string[];
  };
  if (data.success) {
    ctx.res.data = { ...(data as unknown as Record<string, unknown>), url: data.result?.[0] };
  } else {
    throw new Error(data.message ?? "上传失败");
  }
}

/**
 * EasyImage2.0 上传（1.x uploadImageToEasyImage 对齐）。
 */
async function uploadImageToEasyImage(ctx: {
  image: ParsedImage;
  config: ConfigData;
  res: TkResponseBody;
  axios: Awaited<ReturnType<typeof getAxios>>;
  FormData: never;
}): Promise<void> {
  const FormData = ctx.FormData as FormDataLike;
  if (!ctx.config.IMAGE_CDN_URL) {
    throw new Error("未配置 EasyImage2.0 的 API 地址 (IMAGE_CDN_URL)");
  }
  if (!ctx.config.IMAGE_CDN_TOKEN) {
    throw new Error("未配置 EasyImage2.0 的 Token (IMAGE_CDN_TOKEN)");
  }
  const formData = new FormData();
  formData.append("token", ctx.config.IMAGE_CDN_TOKEN);
  appendImage(formData, "image", ctx.image);
  const uploadResult = await ctx.axios.post(ctx.config.IMAGE_CDN_URL as string, formData, {
    headers: {
      ...(formData as unknown as { getHeaders(): Record<string, string> }).getHeaders(),
      "User-Agent": "Twikoo",
    },
  });
  const response = uploadResult.data as {
    code?: number;
    result?: string;
    url?: string;
    thumb?: string;
    del?: string;
    message?: string;
  };
  if (response.code !== 200 || response.result !== "success") {
    throw new Error(`API 返回错误 (CODE: ${response.code})`);
  }
  if (!response.url) {
    throw new Error("未找到有效图片 URL");
  }
  ctx.res.data = { url: response.url, thumb: response.thumb, del: response.del };
}

/**
 * Chevereto 上传（1.x uploadImageToChevereto 对齐）。
 */
async function uploadImageToChevereto(ctx: {
  image: ParsedImage;
  config: ConfigData;
  res: TkResponseBody;
  axios: Awaited<ReturnType<typeof getAxios>>;
  FormData: never;
}): Promise<void> {
  const FormData = ctx.FormData as FormDataLike;
  if (!ctx.config.IMAGE_CDN_URL) {
    throw new Error("未配置 Chevereto 站点地址 (IMAGE_CDN_URL)");
  }
  if (!ctx.config.IMAGE_CDN_TOKEN) {
    throw new Error("未配置 Chevereto API Key (IMAGE_CDN_TOKEN)");
  }
  const formData = new FormData();
  formData.append("key", ctx.config.IMAGE_CDN_TOKEN);
  appendImage(formData, "source", ctx.image);
  formData.append("format", "json");
  const apiUrl = `${ctx.config.IMAGE_CDN_URL}`.replace(/\/$/, "") + "/api/1/upload";
  const uploadResult = await ctx.axios.post(apiUrl, formData, {
    headers: (formData as unknown as { getHeaders(): Record<string, string> }).getHeaders(),
  });
  const data = uploadResult.data as {
    status_code?: number;
    image?: { url?: string; thumb?: { url?: string }; delete_url?: string };
    error?: { message?: string };
  };
  if (data.status_code === 200 && data.image && data.image.url) {
    ctx.res.data = {
      url: data.image.url,
      thumb: data.image.thumb ? data.image.thumb.url : data.image.url,
      del: data.image.delete_url,
    };
  } else {
    throw new Error(`Chevereto 上传失败: ${data.error?.message ?? JSON.stringify(data)}`);
  }
}

/**
 * S3 上传（1.x uploadImageToS3 对齐：原生 AWS SigV4，零 SDK）。
 */
async function uploadImageToS3(ctx: {
  image: ParsedImage;
  config: ConfigData;
  res: TkResponseBody;
  axios: Awaited<ReturnType<typeof getAxios>>;
  FormData: never;
}): Promise<void> {
  const { image, config } = ctx;
  if (!config.S3_BUCKET) throw new Error("未配置 S3 存储桶名称 (S3_BUCKET)");
  if (!config.S3_ACCESS_KEY_ID) {
    throw new Error("未配置 S3 Access Key ID (S3_ACCESS_KEY_ID)");
  }
  if (!config.S3_SECRET_ACCESS_KEY) {
    throw new Error("未配置 S3 Secret Access Key (S3_SECRET_ACCESS_KEY)");
  }
  const region = config.S3_REGION || "us-east-1";
  const { body, mimeType, fileName } = image;
  const prefix = config.S3_PATH_PREFIX ? `${config.S3_PATH_PREFIX}`.replace(/\/$/, "") + "/" : "";
  const key = `${prefix}${fileName}`;
  const forcePathStyle = String(config.S3_FORCE_PATH_STYLE).trim().toLowerCase() !== "false";
  let s3Base: string;
  let endpoint: string;
  if (config.S3_ENDPOINT) {
    const endpointBase = `${config.S3_ENDPOINT}`.replace(/\/$/, "");
    s3Base = forcePathStyle ? `${endpointBase}/${config.S3_BUCKET}` : endpointBase;
    endpoint = `${s3Base}/${key}`;
  } else {
    s3Base = `https://${config.S3_BUCKET}.s3.${region}.amazonaws.com`;
    endpoint = `${s3Base}/${key}`;
  }
  const endpointUrl = new URL(endpoint);
  const host = endpointUrl.host;
  const pathname = endpointUrl.pathname;
  const now = new Date();
  const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, "");
  const amzDate = now.toISOString().replace(/[:-]/g, "").slice(0, 15) + "Z";
  const payloadHash = createHash("sha256").update(body).digest("hex");
  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
  const canonicalHeaders =
    [
      `content-type:${mimeType}`,
      `host:${host}`,
      `x-amz-content-sha256:${payloadHash}`,
      `x-amz-date:${amzDate}`,
    ].join("\n") + "\n";
  const canonicalRequest = ["PUT", pathname, "", canonicalHeaders, signedHeaders, payloadHash].join(
    "\n",
  );
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    createHash("sha256").update(canonicalRequest).digest("hex"),
  ].join("\n");
  /**
   *
   */
  const hmac = (key: Buffer | string, data: string): Buffer =>
    createHmac("sha256", key).update(data).digest();
  const signingKey = hmac(
    hmac(
      hmac(hmac(Buffer.from(`AWS4${config.S3_SECRET_ACCESS_KEY}`), dateStamp), `${region}`),
      "s3",
    ),
    "aws4_request",
  );
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
  const authorization = `AWS4-HMAC-SHA256 Credential=${config.S3_ACCESS_KEY_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  await ctx.axios.put(endpoint, body, {
    headers: {
      "Content-Type": mimeType,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      Authorization: authorization,
    },
    maxBodyLength: Infinity,
  });
  const fileUrl = config.S3_CDN_URL
    ? `${config.S3_CDN_URL}`.replace(/\/$/, "") + `/${key}`
    : `${s3Base}/${key}`;
  ctx.res.data = { url: fileUrl };
}
