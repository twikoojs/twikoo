import io

def rw(p, s): io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
def patch(p, old, new, must=True):
    s = io.open(p, encoding='utf-8').read()
    if old not in s:
        if must: raise AssertionError(f"NOT FOUND {p}: {old[:60]}")
        return
    rw(p, s.replace(old, new))

# escapeHtml returns string
patch('src/services/notify.ts',
 '''function escapeHtml(str: unknown): unknown {
  if (typeof str !== "string") return str;
  return str''',
 '''function escapeHtml(str: unknown): string {
  if (typeof str !== "string") return toStr(str);
  return str''')

patch('src/services/notify.ts',
 '  const IP = comment.ip;\n  const MAIL = escapeHtml(comment.mail);\n  const COMMENT = comment.comment;',
 '  const IP = toStr(comment.ip);\n  const MAIL = escapeHtml(comment.mail);\n  const COMMENT = toStr(comment.comment);')

patch('src/services/notify.ts',
 '  const MAIL = escapeHtml(comment.mail);\n  const IP = comment.ip;',
 '  const MAIL = escapeHtml(comment.mail);\n  const IP = toStr(comment.ip);')

patch('src/services/notify.ts',
 '  const htmlToText = await getHtmlToText();\n  const COMMENT = htmlToText(String(comment.comment ?? ""));',
 '  const htmlToText = await getHtmlToText();\n  const COMMENT = htmlToText(toStr(comment.comment));')

patch('src/services/notify.ts',
 '''  const subject = config.MAIL_SUBJECT_ADMIN || `${SITE_NAME}有新评论了`;''',
 '''  const subject: string = config.MAIL_SUBJECT_ADMIN || `${SITE_NAME}有新评论了`;''')

patch('src/services/notify.ts',
 '  return { subject, content, url: String(POST_URL) };',
 '  return { subject, content, url: POST_URL };')

patch('src/services/notify.ts',
 '  const PARENT_COMMENT = parentComment.comment;',
 '  const PARENT_COMMENT = toStr(parentComment.comment);')

# noticePushoo: drop caps param
patch('src/services/notify.ts',
 '''async function noticePushoo(options: {
  comment: CommentDoc;
  config: ConfigData;
  caps: Capabilities;
  logger: RequestLogger;
}): Promise<void> {
  const { comment, config, caps, logger } = options;''',
 '''async function noticePushoo(options: {
  comment: CommentDoc;
  config: ConfigData;
  logger: RequestLogger;
}): Promise<void> {
  const { comment, config, logger } = options;''')

patch('src/services/notify.ts',
 '''    noticePushoo({ comment, config, caps, logger })''',
 '''    noticePushoo({ comment, config, logger })''')

# noticeMaster/noticeReply COMMENT type
patch('src/services/notify.ts',
 '  const COMMENT = comment.comment;\n  const SITE_URL = toStr(config.SITE_URL);',
 '  const COMMENT = toStr(comment.comment);\n  const SITE_URL = toStr(config.SITE_URL);')
patch('src/services/notify.ts',
 '  const COMMENT = currentComment.comment;\n  const PARENT_COMMENT = toStr(parentComment.comment);',
 '  const COMMENT = toStr(currentComment.comment);\n  const PARENT_COMMENT = toStr(parentComment.comment);')

# upload.ts: drop unused UploadContext interface
p = 'src/services/upload.ts'
s = io.open(p, encoding='utf-8').read()
s = s.replace('''/** 上传上下文（分发器传给各图床实现） */
interface UploadContext {
  image: ParsedImage;
  config: ConfigData;
  res: TkResponseBody;
  axios: Awaited<ReturnType<typeof getAxios>>;
  FormData: never;
}

''', '')
rw(p, s)
print("ok")
