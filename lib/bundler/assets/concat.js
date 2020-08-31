'use strict';


const _         = require('lodash');
const Asset     = require('./base');
const SourceMap = require('fast-sourcemap-concat');


function AssetConcat() {
  Asset.apply(this, arguments);

  this.__queue__ = [];
}


require('util').inherits(AssetConcat, Asset);


AssetConcat.type = AssetConcat.prototype.type = 'concat';


Object.defineProperty(AssetConcat.prototype, 'isFresh', {
  get() {
    if (!this.resolved) { return false; }

    return _.values(this.__dependencies__)
            .every(depObj => this.isDependencyFresh(depObj));
  }
});


AssetConcat.prototype.push = function (asset) {
  if (_.isString(asset)) {
    this.__queue__.push(asset);
    this.dependOnFile(asset);
    return;
  }

  this.__queue__.push(asset.logicalPath);
  this.dependOnAsset(asset);
};


AssetConcat.prototype.resolve = function () {
  if (this.__promise__) return this.__promise__;

  this.__promise__ = (async () => {
    await this.__resolveDependencies__();

    if (await this.__restore_cache__()) return;

    let assets = this.__queue__.map(path => this.__bundler__.findAsset(path))
                               .filter(asset => asset.source);

    if (assets.length === 0) {
      this.source = '';
      this.sourceMap = null;

    } else if (this.__bundler__.sourceMaps) {
      let mapper = new SourceMap({ mapURL: 'unused', file: 'unused' });
      let node_count = 0;

      for (let asset of assets) {
        mapper.addFileSource(asset.sourceMapPath, asset.source, asset.sourceMap);

        if (++node_count !== asset.length) {
          mapper.addSpace('\n\n');
        }
      }

      let result = await mapper.end();
      this.source = result.code.replace(/\n\/\/# sourceMappingURL=unused\n$/, '');

      delete result.map.file;
      this.sourceMap = result.map;

    } else {
      let result = [];
      let node_count = 0;

      for (let asset of assets) {
        result.push(asset.source);

        if (++node_count !== asset.length) {
          result.push('\n\n');
        }
      }

      this.source = result.join('');
    }

    await this.__run_plugins__();

    this.digest = this.dependenciesDigest;

    await this.__save_cache__();
  })().then(() => { this.resolved = true; });

  return this.__promise__;
};


module.exports = AssetConcat;
