const neostandard = require('neostandard')
const pluginVue = require('eslint-plugin-vue')

module.exports = [
  {
    ignores: [
      '**/*.css',
      '**/*.json',
      '**/*.md',
      '**/*.sh',
      '**/*.tf',
      'LICENSE',
      'yarn.lock',
      'pnpm-lock.yaml',
      'Dockerfile',
      'Spacefile',
      'src/client/lib/marked/**',
      'src/server/self-hosted/data/**',
      'src/server/pkg/dist/**',
      'src/server/pkg/patches/**',
      'src/server/pkg/web.config',
      'src/server/eo-pages/cloud-functions/ip2region-data.js',
      'src/server/eo-pages/cloud-functions/smtp.go',
      'src/server/eo-pages/.edgeone/**'
    ]
  },
  ...neostandard({
    env: ['browser', 'node'],
    noJsx: true
  }),
  ...pluginVue.configs['flat/vue2-essential'],
  {
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module'
    }
  }
]
