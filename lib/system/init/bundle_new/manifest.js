'use strict';


const fs   = require('fs');
const path = require('path');


module.exports = function (sandbox, callback) {
  let manifest_path = path.join(sandbox.N.mainApp.root, 'assets', 'server', 'manifest.json');
  let manifest = {
    files: sandbox.files,
    distribution: sandbox.assets_map
  };
  let tmp_manifest_path = manifest_path + '+';

  fs.writeFile(tmp_manifest_path, JSON.stringify(manifest, null, 2), err => {
    if (err) {
      callback(err);
      return;
    }

    fs.rename(tmp_manifest_path, manifest_path, callback);
  });
};
