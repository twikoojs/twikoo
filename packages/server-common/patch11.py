import io

def rw(p, s): io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
def patch(p, old, new, must=True):
    s = io.open(p, encoding='utf-8').read()
    if old not in s:
        if must: raise AssertionError(f"NOT FOUND {p}: {old[:60]}")
        return
    rw(p, s.replace(old, new))

# upload.ts: remove unused UploadContext (previous removal didn't match due to prettier)
p = 'src/services/upload.ts'
s = io.open(p, encoding='utf-8').read()
import re
s = re.sub(r"/\*\* 上传上下文（分发器传给各图床实现） \*/\ninterface UploadContext \{[^}]*\}\n\n", "", s)
rw(p, s)

# user.ts: drop unused Database import; login remove async? keep async + disable per-line? simplest: drop async/await-free -> keep async but add await Promise.resolve? Instead make login non-async returning value; handler awaits anyway.
patch('src/services/user.ts',
 'import type { CommentDoc, ConfigData, Database } from "../ports/database";',
 'import type { CommentDoc, ConfigData } from "../ports/database";')
patch('src/services/user.ts',
 '''export async function login(
  config: ConfigData,
  password: unknown
): Promise<TkResponseBody> {''',
 '''export function login(config: ConfigData, password: unknown): TkResponseBody {''')

# crypto.ts: String(unknown) on object
patch('src/utils/crypto.ts',
 '''export function md5(message: unknown): string {
  return createHash("md5").update(String(message)).digest("hex");
}''',
 '''export function md5(message: unknown): string {
  const input = typeof message === "string" ? message : JSON.stringify(message ?? "");
  return createHash("md5").update(input).digest("hex");
}''')
patch('src/utils/crypto.ts',
 '''export function sha256(message: unknown): string {
  return createHash("sha256")
    .update(message == null ? "" : String(message))
    .digest("hex");
}''',
 '''export function sha256(message: unknown): string {
  const input =
    message == null ? "" : typeof message === "string" ? message : JSON.stringify(message);
  return createHash("sha256").update(input).digest("hex");
}''')
print("ok")
