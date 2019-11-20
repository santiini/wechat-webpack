# Webpack 搭建小程序开发工程

参考地址: [小工具 webpack 搭建](https://juejin.im/post/5d00aa5e5188255a57151c8a#heading-2)

## 一些配置的说明

webpack 的改造过程中，需要进行很多的配置修改

### 一、修改小程序的入口目录

在 project.config.jsong 中，因为移动了 app.js 的位置，需要指定;

在本项目中，把 webpack 打包后的项目作为小程序的入口;

```js
// 指明小程序的入口
"miniprogramRoot": "dist/",
```

### 二、webpack 中修改小程序的入口配置

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

参考 1: 本项目中，使用插件 MinaWebpackPlugin.js 解决该问题;

参考 2： [webpack 官方插件指南](https://webpack.docschina.org/contribute/writing-a-plugin/)

### 三、webpack 全局对象 globalObject 改变 window -> wx

```js
// webpack.js
module.exports = {
  output: {
    path: resolve('dist'),
-   filename: '[name].js'
+   filename: '[name].js',
+   globalObject: 'wx'
  },
}
```

### 四、runtime 代码的抽取, 分离 runtime.js

为了减少打包的文件体积，使用 webpack optimization [配置 runtimeChunk](https://webpack.docschina.org/configuration/optimization/#optimization-runtimechunk) 抽取 runtime 代码为 runtime.js;

改写已有的插件 [MinaRuntimePlugin](https://github.com/tinajs/mina-webpack/tree/master/packages/mina-runtime-webpack-plugin)；

本项目中， 参考文件 `plugin/MinaRuntimePlugin.js`

```js
plugins: {
  // 把 runtime.js 引入到各个文件中
  new MinaRuntimePlugin(),
}
```

但是， `npx webpack` 后项目无法运行，原因是: runtime 抽取后，并没有引入到各个需要的模块中, 分析如下:

1. 小程序和 web 应用不一样，web 应用可以通过 `<script>` 标签引用 runtime.js，然而小程序却不能这样。

2. 我们必须让其它模块感知到 runtime.js 的存在，因为 runtime.js 里面是个立即调用函数表达式，所以只要导入 runtime.js 即可。

3. webpack 在 assets 渲染阶段中的代码解析

```js
  // 共用代码的提取
  optimization: {
    // runtime 的代码分离和提取
    runtimeChunk: {
      name: 'runtime',
    },
  },
```

参考： 本项目中，使用 MinaRuntimePlugin.js 解决该问题;

最终，查看成功的结果: 查看 `dist/app.js, dist/pages/index/index.js` 等文件，
它们的首行都添加了类似 `;require('./../../runtime');` 的代码。

### 五、 公共代码的分离和提取，生成文件 common.js

项目中的重复代码，防止各个文件中重复引入, 需要分离和提取 common.js

```js
  optimization: {
+   splitChunks: {
+     chunks: 'all',
+     name: 'common',
+     minChunks: 2,
+     minSize: 0,
+   },
    runtimeChunk: {
      name: 'runtime',
    },
  },

```

`npx webpack` 后，抽离生成 common.js 文件，其中是 util 目录下的代码，此时引入 utils 的文件中，多了代码，变成；

```js
require('./../../runtime');
require('./../../common');
```

### 六、Tree Shaking 移除没有使用过的方法

我们可以在生成 dist 代码时，移除哪些我们从来没有使用过的方法，这种方式叫做 [tree shaking](https://webpack.docschina.org/guides/tree-shaking/)。就是把树上的枯枝败叶给摇下来，比喻移除无用的代码。

TODO: tree shaking 的使用仍需要优化

### 七、lodash 的按需加载

安装以下两个依赖:

```bash
npm i --save-dev babel-plugin-lodash lodash-webpack-plugin
```

修改 webpack.config.js 文件:

```js
  const MinaRuntimePlugin = require('./plugin/MinaRuntimePlugin');
+ const LodashWebpackPlugin = require('lodash-webpack-plugin');

  new MinaRuntimePlugin(),
+ new LodashWebpackPlugin()

```

修改 .babelrc 文件:

```js
{
  "presets": ["@babel/env"],
+ "plugins": ["lodash"]
}

```

## 小程序的运行

由于小程序的入口目录调整为: /dist，所以需要打包后的代码才能使用;

```bash
  npx webpack
```

我们每修改一次代码，便执行一次 npx webpack，这有些麻烦

### 开启 webpack 的 watch 模式

webpack 可以以 run 或 watchRun 的方式运行

```js
// https://github.com/webpack/webpack/blob/master/lib/webpack.js#L62
const webpack = (options, callback) => {
  if (
    options.watch === true ||
    (Array.isArray(options) && options.some(o => o.watch))
  ) {
    const watchOptions = Array.isArray(options)
      ? options.map(o => o.watchOptions || {})
      : options.watchOptions || {};
    // 如果执行了 watch 就不会执行 run
    return compiler.watch(watchOptions, callback);
  }
  compiler.run(callback);
  return compiler;
};
```

本项目中，修改 plugin/MinaWebpackPlugin.js 文件：

```js
class MinaWebpackPlugin {
  constructor() {
    this.entries = [];
  }

  applyEntry(compiler, done) {
    const { context } = compiler.options;
    this.entries
      .map(item => replaceExt(item, '.js'))
      .map(item => path.relative(context, item))
      .forEach(item =>
        itemToPlugin(context, './' + item, replaceExt(item, '')).apply(compiler)
      );
    if (done) {
      done();
    }
  }

  apply(compiler) {
    const { context, entry } = compiler.options;
    inflateEntries(this.entries, context, entry);

    compiler.hooks.entryOption.tap('MinaWebpackPlugin', () => {
      this.applyEntry(compiler);
      return true;
    });

    // 监听 watchRun 事件
    compiler.hooks.watchRun.tap('MinaWebpackPlugin', (compiler, done) => {
      this.applyEntry(compiler, done);
    });
  }
}
```

执行 `npx webpack --watch --progress`即可开启 watch 模式，修改源代码并保存，将会重新生成 dist。
