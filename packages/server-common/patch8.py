import io

def rw(p, s): io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
def patch(p, old, new, must=True):
    s = io.open(p, encoding='utf-8').read()
    if old not in s:
        if must: raise AssertionError(f"NOT FOUND {p}: {old[:60]}")
        return
    rw(p, s.replace(old, new))

# comment-submit: remaining String(unknown ?? "")
patch('src/handlers/comment-submit.ts',
 '''      {
        comment: String(comment.comment ?? ""),
        nick: String(comment.nick ?? ""),''',
 '''      {
        comment: toStr(comment.comment),
        nick: toStr(comment.nick),''')

# counter-get: drop unused RES_CODE
patch('src/handlers/counter-get.ts',
 'import { RES_CODE } from "../utils/constants";\n', '')

# import.ts: require-await file-level + base-to-string fixes
p = 'src/services/import.ts'
s = io.open(p, encoding='utf-8').read()
s = s.replace('''/**
 * 评论导入服务（1.x utils/import.js 移植；格式：Valine / Disqus / Artalk /
 * Artalk v2 / Twikoo）。''',
'''/* eslint-disable @typescript-eslint/require-await --
 * 导入器与 1.x 形态一致保持异步签名（XML/消毒路径为异步），同步分支为容错形态。
 */
/**
 * 评论导入服务（1.x utils/import.js 移植；格式：Valine / Disqus / Artalk /
 * Artalk v2 / Twikoo）。''')
s = s.replace('`artalk${String(c.rid)}`', '`artalk` + toStr(c.rid)')
s = s.replace('await renderMarkdown(String(c.content ?? ""), caps)', 'await renderMarkdown(toStr(c.content), caps)')
s = s.replace('getRelativeUrl(String(c.page_key ?? ""))', 'getRelativeUrl(toStr(c.page_key))')
s = s.replace('''import { md5 } from "../utils/crypto";
import { getRelativeUrl, normalizeMail } from "./comment-dto";''',
'''import { md5 } from "../utils/crypto";
import { toStr } from "../utils/safe-str";
import { getRelativeUrl, normalizeMail } from "./comment-dto";''')
rw(p, s)

# notify.ts: unknown template expressions -> toStr
p = 'src/services/notify.ts'
s = io.open(p, encoding='utf-8').read()
s = s.replace('''import { RES_CODE } from "../utils/constants";''',
'''import { RES_CODE } from "../utils/constants";
import { toStr } from "../utils/safe-str";''')
s = s.replace('const emailSubject = config.MAIL_SUBJECT_ADMIN || `${SITE_NAME}上有新评论了`;',
              'const emailSubject = config.MAIL_SUBJECT_ADMIN || `${toStr(SITE_NAME)}上有新评论了`;')
s = s.replace('const subject = String(config.MAIL_SUBJECT_ADMIN || `${SITE_NAME}有新评论了`);',
              'const subject = config.MAIL_SUBJECT_ADMIN || `${toStr(SITE_NAME)}有新评论了`;')
s = s.replace('const SITE_NAME = config.SITE_NAME;',
              'const SITE_NAME = toStr(config.SITE_NAME);')
s = s.replace('''  const emailSubject =
    config.MAIL_SUBJECT || `${PARENT_NICK}，您在『${SITE_NAME}』上的评论收到了回复`;''',
'''  const emailSubject =
    config.MAIL_SUBJECT || `${toStr(PARENT_NICK)}，您在『${SITE_NAME}』上的评论收到了回复`;''')
s = s.replace('''    emailSubject: emailSubject,
''', '')
s = s.replace('  const { mail, config, isAdminUser, caps, logger } = options;',
              '  const { mail, config, isAdminUser, logger } = options;')
s = s.replace('''    await initMailer({ config, throwErr: true, caps, logger });''',
              '''    await initMailer({ config, throwErr: true, caps, logger });''')
rw(p, s)

# upload.ts: UploadContext unused -> use type
patch('src/services/upload.ts',
 '  FormData: never;\n}\n\n/**\n * NSFW 检测', '  FormData: never;\n}\n\n/**\n * NSFW 检测')

# create shared safe-str util
write_util = '''/**
 * 安全字符串化工具（消除 [object Object] 风险的统一入口）。
 */
/**
 * 任意值转字符串：字符串原样；null/undefined 空串；其余 JSON 化。
 * @param v 任意值
 * @returns 字符串
 */
export function toStr(v: unknown): string {
  if (typeof v === "string") return v;
  if (v === undefined || v === null) return "";
  try {
    return JSON.stringify(v);
  } catch {
    return "";
  }
}
'''
rw('src/utils/safe-str.ts', write_util)
print("ok")
