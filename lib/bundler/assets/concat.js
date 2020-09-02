'use strict';


const _         = require('lodash');
const Asset     = require('./base');


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

    let result = [];
    let result_map = { version: 3, sections: [] };
    let node_count = 0;
    let line_count = 0;
    let enable_maps = this.__bundler__.sourceMaps;

    for (let asset of assets) {
      let source = asset.source;
      let current_line_count = 0;

      result.push(source);

      if (!source.endsWith('\n')) {
        result.push('\n');
        current_line_count++;
      }

      if (enable_maps) {
        current_line_count += (source.match(/\n/g) || []).length;

        result_map.sections.push({
          offset: { line: line_count, column: 0 },
          map: asset.sourceMap || {
            version: 3,
            sources: [ asset.sourceMapPath ],
            sourcesContent: [ source ],
            mappings: 'AAAA;' + 'AACA;'.repeat(current_line_count - 1)
          }
        });
      }

      if (++node_count !== assets.length) {
        result.push('\n');
        line_count += current_line_count + 1;
      }
    }

    this.source = result.join('');

    if (enable_maps && result_map.sections.length) {
      this.sourceMap = result_map;
    } else {
      this.sourceMap = null;
    }

    await this.__run_plugins__();

    this.digest = this.dependenciesDigest;

    await this.__save_cache__();
  })().then(() => { this.resolved = true; });

  return this.__promise__;
};


module.exports = AssetConcat;
