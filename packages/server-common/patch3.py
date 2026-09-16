import io

def patch(path, old, new):
    s = io.open(path, encoding='utf-8').read()
    assert old in s, f"NOT FOUND in {path}: {old[:60]}"
    s = s.replace(old, new)
    io.open(path, 'w', encoding='utf-8', newline='\n').write(s)

patch('test/database/cloudbase.test.ts',
 '''interface MockCommand {
  __op: "in" | "inc";
  list?: unknown[];
  n?: number;
}''',
 '''interface MockCommand {
  __op: "in" | "inc" | "neq" | "gt";
  list?: unknown[];
  n?: number;
  value?: unknown;
}''')

patch('test/database/cloudbase.test.ts',
 '''    /** _.inc 指令 */
    inc: (n: number): MockCommand => ({ __op: "inc", n })
  };''',
 '''    /** _.inc 指令 */
    inc: (n: number): MockCommand => ({ __op: "inc", n }),
    /** _.neq 指令 */
    neq: (value: unknown): MockCommand => ({ __op: "neq", value }),
    /** _.gt 指令 */
    gt: (value: unknown): MockCommand => ({ __op: "gt", value })
  };''')

patch('test/database/cloudbase.test.ts',
 '''      if (isCommand(expected) && expected.__op === "in") {
        const list = expected.list ?? [];
        // TCB 语义：null 在列表中命中「字段缺失」
        return list.includes(actual) || (list.includes(null) && actual === undefined);
      }
      return actual === expected;''',
 '''      if (isCommand(expected) && expected.__op === "in") {
        const list = expected.list ?? [];
        // TCB 语义：null 在列表中命中「字段缺失」
        return list.includes(actual) || (list.includes(null) && actual === undefined);
      }
      if (isCommand(expected) && expected.__op === "neq") {
        return actual !== expected.value;
      }
      if (isCommand(expected) && expected.__op === "gt") {
        return typeof actual === "number" && actual > (expected.value as number);
      }
      return actual === expected;''')

print("mock ok")
