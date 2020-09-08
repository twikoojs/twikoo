const path = require('path')
const webpack = require('webpack')
const CopyPlugin = require('copy-webpack-plugin')
const VueLoaderPlugin = require('vue-loader/lib/plugin')
const ROOT_PATH = path.resolve(__dirname)
const BUILD_PATH = path.resolve(ROOT_PATH, 'dist')
const version = require('./package.json').version
const banner =
  'Twikoo v' + version + '\n' +
  '(c) 2020-' + new Date().getFullYear() + ' iMaeGoo\n' +
  'Released under the MIT License.\n' +
  'Last Update: ' + (new Date()).toLocaleString()

module.exports = {
  module: {
    rules: [
      { test: /\.vue$/, loader: 'vue-loader' },
      { test: /\.css$/, use: ['vue-style-loader', 'css-loader'] },
      { test: /\.svg$/, loader: 'svg-inline-loader' }
    ]
  },
  entry: {
    /* eslint-disable-next-line quote-props */
    'twikoo': './src/js/main.js',
    'twikoo.all': './src/js/main.all.js'
  },
  output: {
    path: BUILD_PATH,
    filename: '[name].min.js',
    library: 'twikoo',
    libraryTarget: 'umd'
  },
  plugins: [
    new webpack.BannerPlugin(banner),
    new CopyPlugin({
      patterns: [
        { from: 'public/', to: './' }
      ]
    }),
    new VueLoaderPlugin()
  ],
  devServer: {
    contentBase: BUILD_PATH,
    port: 9820
  }
}
