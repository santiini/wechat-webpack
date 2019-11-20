const { resolve } = require("path");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");

module.exports = {
  // context 字段设置了项目入口文件的包含目录，绝对路径;
  context: resolve("src"),

  //  单入口的配置
  // entry: "./app.js",
  // 多入口的配置
  entry: {
    app: "./app.js",
    "pages/index/index": "./pages/index/index.js",
    "pages/logs/logs": "./pages/logs/logs.js"
  },

  // 输出文件的配置
  output: {
    path: resolve("dist"),
    filename: "[name].js"
  },

  // loader 配置
  module: {
    rules: [
      // babel 解析 js 文件，支持 es6,7,8语法
      {
        test: /\.js$/,
        use: "babel-loader"
      }
    ]
  },

  // 插件
  plugins: [
    new CleanWebpackPlugin({
      cleanStaleWebpackAssets: false
    }),
    // 复制源文件到 /dist 目录
    new CopyWebpackPlugin([
      {
        from: "**/*",
        to: "./",
        // 从 src 复制文件到 dist 时，排除 js 文件, 因为 js 文件需要 babel 编译;
        ignore: ["**/*.js"]
      }
    ])
  ],

  // devlopment, production 等环境设置
  mode: "none"
};
