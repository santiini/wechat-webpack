# Webpack 搭建小程序开发工程

## 一些配置的说明

webpack 的改造过程中，需要进行很多的配置修改

### 修改小程序的入口目录

在 project.config.jsong 中，因为移动了 app.js 的位置，需要指定;

在本项目中，把 webpack 打包后的项目作为小程序的入口;

```js
// 指明小程序的入口
"miniprogramRoot": "dist/",
```

### webpack 中修改小程序的入口配置

小程序是个多页面应用程序, 在 webpack 项目中，应该对应多个 entry 入口配置;

```js
// webpack.config.js
// 单入口文件的配置
 entry: './app.js'
// 多入口文件的配置
 entry: {
   'app'              : './app.js',
   'pages/index/index': './pages/index/index.js',
   'pages/logs/logs'  : './pages/logs/logs.js'
 },

```

上面的 entry 配置虽然可以实现功能，但是并不够智能，可以通过 webpack 插件优化；

replace-ext 可以是一个替换文件扩展名的包;

```bash
npm i --save-dev replace-ext
```

### 公共代码的抽取, 分离 runtime.js

## 小程序的允许

由于小程序的入口目录调整为: /dist，所以需要打包后的代码才能使用;

```bash
  npx webpack
```

tips: 这里存在优化的空间
