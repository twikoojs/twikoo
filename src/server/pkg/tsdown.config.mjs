import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['./index.js'],
  platform: 'node',
  // ...config options
  clean: ['dist'],
  format: 'commonjs',
  exe: {
    enabled: true,
    fileName: 'twikoo',
    targets: [
      { platform: 'linux', arch: 'x64', nodeVersion: '25.8.1' },
      { platform: 'darwin', arch: 'arm64', nodeVersion: '25.8.1' },
      { platform: 'darwin', arch: 'x64', nodeVersion: '25.8.1' },
      { platform: 'win', arch: 'x64', nodeVersion: '25.8.1' }
    ],
    outDir: 'dist',
    seaConfig: {
      assets: {
        '.env': '.env',
        'ip2region.db': 'ip2region.db',
        'xhr-sync-worker.js': 'xhr-sync-worker.js',
        'web.config': 'web.config'
      }
    }
  }
});
