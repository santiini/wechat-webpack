/**
 * 自定义的 webpack 插件
 *   1. 和我们手动配置 entry 所做的一模一样，通过代码分析 .json 文件，
 *      找到所有可能的入口文件，添加到 webpack。
 */
// plugin/MinaWebpackPlugin.js
const SingleEntryPlugin = require('webpack/lib/SingleEntryPlugin');
const MultiEntryPlugin = require('webpack/lib/MultiEntryPlugin');
const path = require('path');
const fs = require('fs');
const replaceExt = require('replace-ext');

// asserts 资源 chunk name
const assetsChunkName = '__assets_chunk_name__';

/* 识别 item, 自动生成多入口、单入口的配置 */
function itemToPlugin(context, item, name) {
  if (Array.isArray(item)) {
    return new MultiEntryPlugin(context, item, name);
  }
  return new SingleEntryPlugin(context, item, name);
}

function _inflateEntries(entries = [], dirname, entry) {
  // 获取小程序的入口配置文件
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

//
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
    this.entries = [];
    this.assetExtensions = options.assetExtensions || [];
    this.scriptExtensions = options.scriptExtensions || ['.ts', '.js'];
  }

  // MinaWebpackPlugin 事件的相应函数
  applyEntry(compiler, done) {
    const { context } = compiler.options;
    this.entries
      // 将文件的扩展名替换成 js
      .map(item => first(item, this.scriptExtensions))

      // 把绝对路径转换成相对于 context 的路径
      .map(item => path.relative(context, item))
      // 应用每一个入口文件，就像手动配置的那样
      // 'app'              : './app.js',
      // 'pages/index/index': './pages/index/index.js',
      // 'pages/logs/logs'  : './pages/logs/logs.js',
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

  // apply 是每一个插件的入口
  apply(compiler) {
    const { context, entry } = compiler.options;
    // 找到所有的入口文件，存放在 entries 里面
    inflateEntries(this.entries, context, entry);

    // 这里订阅了 compiler 的 entryOption 事件，当事件发生时，就会执行回调里的代码
    compiler.hooks.entryOption.tap('MinaWebpackPlugin', () => {
      this.applyEntry(compiler);
      // 返回 true 告诉 webpack 内置插件就不要处理入口文件了，因为这里已经处理了
      return true;
    });

    // 监听 watchRun 事件
    compiler.hooks.watchRun.tap('MinaWebpackPlugin', (compiler, done) => {
      this.applyEntry(compiler, done);
    });

    // asserts 资源的处理
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
