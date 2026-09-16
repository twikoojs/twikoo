import io

def patch(p, old, new):
    s = io.open(p, encoding='utf-8').read()
    assert old in s, f"NOT FOUND {p}: {old[:70]}"
    io.open(p, 'w', encoding='utf-8', newline='\n').write(s.replace(old, new))

patch('test/contract/contract-suite.ts',
 '''  let handler: ReturnType<typeof createHandler>;
  let adapters: TkAdapters & { database: Database };

  /** 每用例：创建 DB → 组装 handler → 预置管理密码与替身 */
  beforeEach(async () => {''',
 '''  /** 逐用例独立的 handler 与适配器 */
  let handler: ReturnType<typeof createHandler>;
  /** 逐用例独立的适配器聚合 */
  let adapters: TkAdapters & { database: Database };

  /** 每用例：创建 DB → 组装 handler → 预置管理密码与替身 */
  beforeEach(async () => {''')

patch('test/contract/loki-contract.test.ts',
 '''  /** 每用例独立数据目录 */
  createDb: async () => {
    const dir = join(workDir, `data-${Math.random().toString(36).slice(2, 8)}`);
    const db = new LokiDatabase({ dataDir: dir });
    await db.init();
    return db;
  },''',
 '''  /** 每用例独立数据目录 */
  createDb: async () => {
    /** 本用例的数据目录 */
    const dir = join(workDir, `data-${Math.random().toString(36).slice(2, 8)}`);
    const db = new LokiDatabase({ dataDir: dir });
    await db.init();
    return db;
  },''')
print("ok")
