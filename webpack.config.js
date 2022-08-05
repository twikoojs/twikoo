const path = require('path')
const webpack = require('webpack')
const CopyPlugin = require('copy-webpack-plugin')
const VueLoaderPlugin = require('vue-loader/lib/plugin')
const ROOT_PATH = path.resolve(__dirname)
const BUILD_PATH = path.resolve(ROOT_PATH, 'dist')
const version = require('./package.json').version
const TerserPlugin = require('terser-webpack-plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const banner =
  'Twikoo v' + version + '\n' +
  '(c) 2020-' + new Date().getFullYear() + ' iMaeGoo\n' +
  'Released under the MIT License.\n' +
  'Last Update: ' + (new Date()).toLocaleString()

function getConfig ({ extractCss }) {
  return {
    module: {
      rules: [
        { test: /\.vue$/, loader: 'vue-loader' },
        extractCss
          ? { test: /\.css$/, use: [MiniCssExtractPlugin.loader, 'css-loader'] }
          : { test: /\.css$/, use: ['vue-style-loader', 'css-loader'] },
        { test: /\.svg$/, loader: 'svg-inline-loader' },
        { test: /\.js$/, use: { loader: 'babel-loader', options: { presets: ['@babel/preset-env'], plugins: ['@babel/plugin-transform-modules-commonjs', '@babel/transform-runtime'] } } }
      ]
    },
    entry: extractCss
      ? {
          twikoo: './src/client/main.all.js'
        }
      : {
          twikoo: './src/client/main.js',
          'twikoo.all': './src/client/main.all.js'
        },
    output: {
      path: BUILD_PATH,
      filename: extractCss ? '[name].nocss.js' : '[name].min.js',
      library: 'twikoo',
      libraryTarget: 'umd',
      globalObject: 'this'
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
      new MiniCssExtractPlugin(),
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
}

module.exports = process.env.NODE_ENV === 'production'
  ? [
      getConfig({ extractCss: false }),
      getConfig({ extractCss: true })
    ]
  : getConfig({ extractCss: false })
