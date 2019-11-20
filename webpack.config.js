const { resolve } = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const MinaWebpackPlugin = require('./plugin/MinaWebpackPlugin');
const MinaRuntimePlugin = require('./plugin/MinaRuntimePlugin');

module.exports = {
  // context 字段设置了项目入口文件的包含目录，绝对路径;
  context: resolve('src'),

  //  单入口的配置 -- 配合插件 MinaWebpackPlugin 使用
  entry: './app.js',
  // 多入口的配置
  // entry: {
  //   app: './app.js',
  //   'pages/index/index': './pages/index/index.js',
  //   'pages/logs/logs': './pages/logs/logs.js',
  // },

  // 输出文件的配置
  output: {
    path: resolve('dist'),
    filename: '[name].js',
    // 配置全局对象 window，改变它的别名
    globalObject: 'wx',
  },

  // loader 配置
  module: {
    rules: [
      // babel 解析 js 文件，支持 es6,7,8语法
      {
        test: /\.js$/,
        use: 'babel-loader',
      },
    ],
  },

  // 插件
  plugins: [
    new CleanWebpackPlugin({
      cleanStaleWebpackAssets: false,
    }),
    // 复制源文件到 /dist 目录
    new CopyWebpackPlugin([
      {
        from: '**/*',
        to: './',
        // 从 src 复制文件到 dist 时，排除 js 文件, 因为 js 文件需要 babel 编译;
        ignore: ['**/*.js'],
      },
    ]),
    // 自定把小程序的配置中的 pages 下的目录注册到 entry 中
    new MinaWebpackPlugin(),
    // 把 runtime.js 引入到各个文件中
    new MinaRuntimePlugin(),
  ],

  // 共用代码的提取
  optimization: {
    runtimeChunk: {
      name: 'runtime',
    },
  },

  // devlopment, production 等环境设置
  mode: 'none',
};
