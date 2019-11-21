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

### 八、多环境的配置

项目中使用两个变量分别控制 构建模式和 环境变量

1. NODE_ENV : 环境变量
2. BUILD_TYPE： 构建模式

webpack.config.js 配置:

```js
+ const webpack = require('webpack');
+ const debuggable = process.env.BUILD_TYPE !== 'release'
module.exports = {
  plugins: [
+     new webpack.EnvironmentPlugin({
+       NODE_ENV: JSON.stringify(process.env.NODE_ENV) || 'development',
+       BUILD_TYPE: JSON.stringify(process.env.BUILD_TYPE) || 'debug',
+     }),
  ],
-   mode: 'none',
+   mode: debuggable ? 'none' : 'production',
}

```

启动脚本设置:

```js
{
  "scripts": {
    "start": "webpack --watch --progress",
    "build": "cross-env NODE_ENV=production BUILD_TYPE=release webpack"
  }
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

### sass 支持

[sass](http://www.ruanyifeng.com/blog/2012/06/sass.html) 是一种 css 预处理器，当然也可以使用其它 css 预处理器，这里仅以 sass 为例，读者很容易举一反三。

安装相关依赖

```bash
npm i --save-dev sass-loader node-sass file-loader
```

修改 webpack.config.js 文件

```js
module.exports = {
  module: {
    rules: [
+       {
+         test: /\.(scss)$/,
+         include: /src/,
+         use: [
+           {
+             loader: 'file-loader',
+             options: {
+               useRelativePath: true,
+               name: '[path][name].wxss',
+               context: resolve('src'),
+             },
+           },
+           {
+             loader: 'sass-loader',
+             options: {
+               includePaths: [resolve('src', 'styles'), resolve('src')],
+             },
+           },
+         ],
+       },
    ],
  },
  plugins: [
    new CopyWebpackPlugin([
      {
        from: '**/*',
        to: './',
-       ignore: ['**/*.js', ],
+       ignore: ['**/*.js', '**/*.scss'],
      },
    ]),
    new MinaWebpackPlugin({
+      scriptExtensions: ['.js'],
+      assetExtensions: ['.scss'],
    }),
  ],
}
```

在上面的配置中，我们使用到了 [file-loader](https://webpack.docschina.org/loaders/file-loader), 这是一个可以直接输出文件到 dist 的 loader。

我们在分析 webpack 工作流程时，曾经提到过，loader 主要工作在 module 构建阶段。也就是说，我们依然需要添加 .scss 文件作为 entry，让 loader 能有机会去解析它，并输出最终结果。

每一个 entry 都会对应一个 chunk, 每一个 entry chunk 都会输出一个文件。因为 file-loader 已经帮助我们输出最终我们想要的结果了，所以我们需要阻止这一行为。

修改 plugin/MinaWebpackPlugin.js 文件，以下是修改后的样子

```js
// plugin/MinaWebpackPlugin.js
const SingleEntryPlugin = require('webpack/lib/SingleEntryPlugin');
const MultiEntryPlugin = require('webpack/lib/MultiEntryPlugin');
const path = require('path');
const fs = require('fs');
const replaceExt = require('replace-ext');

const assetsChunkName = '__assets_chunk_name__';

function itemToPlugin(context, item, name) {
  if (Array.isArray(item)) {
    return new MultiEntryPlugin(context, item, name);
  }
  return new SingleEntryPlugin(context, item, name);
}

function _inflateEntries(entries = [], dirname, entry) {
  const configFile = replaceExt(entry, '.json');
  const content = fs.readFileSync(configFile, 'utf8');
  const config = JSON.parse(content);

  ['pages', 'usingComponents'].forEach(key => {
    const items = config[key];
    if (typeof items === 'object') {
      Object.values(items).forEach(item =>
        inflateEntries(entries, dirname, item)
      );
    }
  });
}

function inflateEntries(entries, dirname, entry) {
  entry = path.resolve(dirname, entry);
  if (entry != null && !entries.includes(entry)) {
    entries.push(entry);
    _inflateEntries(entries, path.dirname(entry), entry);
  }
}

function first(entry, extensions) {
  for (const ext of extensions) {
    const file = replaceExt(entry, ext);
    if (fs.existsSync(file)) {
      return file;
    }
  }
  return null;
}

function all(entry, extensions) {
  const items = [];
  for (const ext of extensions) {
    const file = replaceExt(entry, ext);
    if (fs.existsSync(file)) {
      items.push(file);
    }
  }
  return items;
}

class MinaWebpackPlugin {
  constructor(options = {}) {
    this.scriptExtensions = options.scriptExtensions || ['.ts', '.js'];
    this.assetExtensions = options.assetExtensions || [];
    this.entries = [];
  }

  applyEntry(compiler, done) {
    const { context } = compiler.options;

    this.entries
      .map(item => first(item, this.scriptExtensions))
      .map(item => path.relative(context, item))
      .forEach(item =>
        itemToPlugin(context, './' + item, replaceExt(item, '')).apply(compiler)
      );

    // 把所有的非 js 文件都合到同一个 entry 中，交给 MultiEntryPlugin 去处理
    const assets = this.entries
      .reduce(
        (items, item) => [...items, ...all(item, this.assetExtensions)],
        []
      )
      .map(item => './' + path.relative(context, item));
    itemToPlugin(context, assets, assetsChunkName).apply(compiler);

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

    compiler.hooks.watchRun.tap('MinaWebpackPlugin', (compiler, done) => {
      this.applyEntry(compiler, done);
    });

    compiler.hooks.compilation.tap('MinaWebpackPlugin', compilation => {
      // beforeChunkAssets 事件在 compilation.createChunkAssets 方法之前被触发
      compilation.hooks.beforeChunkAssets.tap('MinaWebpackPlugin', () => {
        const assetsChunkIndex = compilation.chunks.findIndex(
          ({ name }) => name === assetsChunkName
        );
        if (assetsChunkIndex > -1) {
          // 移除该 chunk, 使之不会生成对应的 asset，也就不会输出文件
          // 如果没有这一步，最后会生成一个 __assets_chunk_name__.js 文件
          compilation.chunks.splice(assetsChunkIndex, 1);
        }
      });
    });
  }
}

module.exports = MinaWebpackPlugin;
```
