const { resolve } = require("path");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");

module.exports = {
  context: resolve("src"),
  entry: "./app.js",
  output: {
    path: resolve("dist"),
    filename: "[name].js"
  },
  plugins: [
    new CleanWebpackPlugin({
      cleanStaleWebpackAssets: false
    }),
    new CopyWebpackPlugin([
      {
        from: "**/*",
        to: "./"
      }
    ])
  ],
  mode: "none"
};
