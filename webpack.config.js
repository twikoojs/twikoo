const path = require('path')
const CopyPlugin = require('copy-webpack-plugin')
const VueLoaderPlugin = require('vue-loader/lib/plugin')
const ROOT_PATH = path.resolve(__dirname)
const BUILD_PATH = path.resolve(ROOT_PATH, 'dist')

module.exports = {
  module: {
    rules: [
      { test: /\.vue$/, loader: 'vue-loader' },
      { test: /\.css$/, use: ['vue-style-loader', 'css-loader'] }
    ]
  },
  entry: {
    /* eslint-disable-next-line quote-props */
    'twii': './src/js/main.js',
    'twii.all': './src/js/main.all.js'
  },
  output: {
    path: BUILD_PATH,
    filename: '[name].min.js',
    library: 'twii',
    libraryTarget: 'umd'
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'public/', to: './' }
      ]
    }),
    new VueLoaderPlugin()
  ],
  devServer: {
    contentBase: BUILD_PATH,
    port: 8080
  }
}
