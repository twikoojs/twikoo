import { defineConfig } from 'tsdown'
import { readFileSync } from 'node:fs'

// 单配置：不再构建 xhr-sync-worker（jsdom 同步 XHR 的子进程 worker）。
// 依赖链分析：jsdom 只被 twikoo-func 用于给 DOMPurify 提供 window 对象（HTML 反 XSS），
// 整个 twikoo 依赖树中没有任何代码调用同步 XHR（xhr.open(method, url, false)）。
// 同步 XHR 是 jsdom 中唯一会用到该 worker 的功能（spawnSync 子进程），
// 因此不打包 worker 对 Twikoo 服务端没有任何影响，产物体积更小、部署更简单。
// 若未来有人通过 jsdom window 执行 xhr.open(..., false)，同步请求会抛错
// （syncWorkerFile 为 null 时 spawnSync 直接报参数错误），异步 XHR 和其它功能不受影响。
/**
 * @type {import('tsdown').UserConfig}
 */
export default defineConfig({
  dts: false,
  entry: ['./index.js'],
  format: ['cjs'],
  clean: ['dist', 'build'],
  deps: {
    onlyBundle: false,
    // // 打包所有依赖，全部内联进单个输出文件
    alwaysBundle: [/.*/]
    // //  可选依赖（未安装），显式标记为 external，
    // // 避免 rolldown 解析失败产生 "Module not found" 警告
    // neverBundle: []
  },
  exports: false,
  platform: 'node',
  // 禁用压缩, 压缩会导致字段改变
  minify: false,
  outputOptions: {
    // 移除所有注释
    comments: false,
    // 将动态 import() 的 chunk 也内联进主文件，保证只输出单个文件
    codeSplitting: false,
    entryFileNames: '[name].js'
  },
  outDir: 'build',
  exe: {
    enabled: true,
    fileName: 'twikoo',
    outDir: 'dist',
    targets: [
      { platform: 'linux', arch: 'x64', nodeVersion: '26.8.1' },
      { platform: 'darwin', arch: 'arm64', nodeVersion: '26.8.1' },
      { platform: 'darwin', arch: 'x64', nodeVersion: '26.8.1' },
      { platform: 'win', arch: 'x64', nodeVersion: '26.8.1' }
    ],
    seaConfig: {
      assets: {
        '.env': '.env',
        'web.config': 'web.config'
      }
    }
  },
  plugins: [
    {
      name: 'twikoo-disable-xhr-sync-worker',
      // 保险处理：在内存中把 jsdom 里的 require.resolve('./xhr-sync-worker.js')
      // 置为 null，避免运行时真的去 resolve 一个不存在的文件抛 MODULE_NOT_FOUND；
      // 若真触发同步 XHR，会得到更明确的 spawnSync 参数错误。
      renderChunk (code) {
        const target =
          'const syncWorkerFile = require.resolve ? require.resolve("./xhr-sync-worker.js") : null;'
        if (code.includes(target)) {
          return code.replace(
            target,
            'const syncWorkerFile = null; // xhr-sync-worker 未打包: 同步 XHR 不可用'
          )
        }
        return code
      }
    },
    {
      name: 'twikoo-inline-ip2region-db',
      // 把 ip2region.db 内联进产物：
      // ip2region 用 fs.openSync(dbPath) + fs.readSync 随机读取，必须是真实文件，
      // 无法纯内存运行。因此把 db 内容 base64 存进产物字符串，
      // 替换 DEFAULT_DB_PATH 定义：文件存在时直接用；不存在时落盘到系统临时目录固定
      // 路径再用（按大小校验，避免重启累积副本或使用半截文件）。
      // 这样产物不再依赖 dist/data/ip2region.db（copy 已移除），部署仍只需单文件。
      renderChunk (code) {
        const target =
          'const DEFAULT_DB_PATH = require("path").join(__dirname, "./data/ip2region.db");'
        if (!code.includes(target)) return code
        const dbBase64 = readFileSync(
          './node_modules/@imaegoo/node-ip2region/data/ip2region.db'
        ).toString('base64')
        return code.replace(
          target,
          `\
const __TWIKOO_IP2REGION_DB__ = ${JSON.stringify(dbBase64)};
const DEFAULT_DB_PATH = (() => {
  const fs = require("fs");
  const path = require("path");
  const bundled = path.join(__dirname, "./data/ip2region.db");
  try {
    if (fs.statSync(bundled).isFile()) return bundled; // 优先使用部署目录里的文件
  } catch {}
  // 使用固定路径而不是每次启动新建临时目录，避免可执行文件反复重启时累积数据库副本；
  // 文件大小与内联内容不一致（首次写入被中断或版本升级）时重新生成
  const dbBuffer = Buffer.from(__TWIKOO_IP2REGION_DB__, "base64");
  const tmpFile = path.join(require("os").tmpdir(), "twikoo-ip2region.db");
  try {
    if (fs.statSync(tmpFile).size === dbBuffer.length) return tmpFile;
  } catch {}
  fs.writeFileSync(tmpFile, dbBuffer);
  return tmpFile;
})();`
        )
      }
    }
  ]
})
