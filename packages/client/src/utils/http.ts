/** 请求因超过时限被主动中止，与网络失败或跨域拦截区分。 */
export class TwikooFetchTimeoutError extends Error {}

/** 拉取响应及文本，30 秒时限覆盖等待响应头和读取响应体的全过程。 */
export async function fetchText(
  url: string,
  options: RequestInit = {},
): Promise<{ response: Response; text: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const text = await response.text();
    return { response, text };
  } catch (e) {
    if (controller.signal.aborted) throw new TwikooFetchTimeoutError("请求超时");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
