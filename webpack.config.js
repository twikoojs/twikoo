const path = require('path')
const ROOT_PATH = path.resolve(__dirname)
const BUILD_PATH = path.resolve(ROOT_PATH, 'dist')

module.exports = {
  entry: {
    maeco: './src/js/index.js'
  },
  output: {
    path: BUILD_PATH,
    filename: '[name].min.js',
    library: 'Maeco',
    libraryTarget: 'umd'
  },
  devServer: {
    contentBase: BUILD_PATH,
    port: 8080
  }
}
