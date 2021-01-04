const path = require('path')
const webpack = require('webpack')
const CopyPlugin = require('copy-webpack-plugin')
const VueLoaderPlugin = require('vue-loader/lib/plugin')
const ROOT_PATH = path.resolve(__dirname)
const BUILD_PATH = path.resolve(ROOT_PATH, 'dist')
const version = require('./package.json').version
const TerserPlugin = require('terser-webpack-plugin')
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
      { test: /\.svg$/, loader: 'svg-inline-loader' },
      { test: /\.js$/, use: { loader: 'babel-loader', options: { presets: ['@babel/preset-env'], plugins: ['@babel/plugin-transform-modules-commonjs', '@babel/transform-runtime'] } } }
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
  target: ['web', 'es5'],
  plugins: [
    new webpack.BannerPlugin(banner),
    new CopyPlugin({
      patterns: [
        { from: 'demo/', to: './' }
      ]
    }),
    new VueLoaderPlugin(),
    new TerserPlugin({
      parallel: 4,
      terserOptions: {
        ecma: 5,
        toplevel: true,
        ie8: true,
        safari10: true
      }
    })
  ],
  devServer: {
    static: [{
      directory: BUILD_PATH,
      publicPath: '/dist/',
      serveIndex: true,
      watch: true
    }],
    port: 9820,
    host: 'localhost',
    open: true,
    hot: true,
    compress: true
  },
  performance: {
    maxEntrypointSize: 524288,
    maxAssetSize: 524288
  }
}
