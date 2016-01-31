'use strict';


const fs   = require('mz/fs');
const path = require('path');
const co   = require('co');


module.exports = co.wrap(function* (sandbox) {
  let manifest_path = path.join(sandbox.N.mainApp.root, 'assets', 'server',
    `manifest-${sandbox.N.environment}.json`);
  let manifest = {
    files: sandbox.files,
    distribution: sandbox.assets_map
  };
  let tmp_manifest_path = manifest_path + '+';

  yield fs.writeFile(tmp_manifest_path, JSON.stringify(manifest, null, 2));

  yield fs.rename(tmp_manifest_path, manifest_path);
});
