// Check that client scripts not contain ES6
//
'use strict';


const Promise = require('bluebird');
const request = require('supertest')(TEST.N.config.bind.default.mount);
const _       = require('lodash');
const assert  = require('assert');


describe('No ES5', function () {
  let js_scripts_content = {};


  before(function () {
    let scripts_path = [];

    _.forEach(TEST.N.assets.distribution[TEST.N.config.locales[0]], assets => {
      scripts_path = scripts_path.concat(assets.javascripts.map(path => TEST.N.assets.asset_url(path)));
    });

    scripts_path = _.uniq(scripts_path);

    return Promise.map(scripts_path, path => new Promise((resolve, reject) => {
      request.get(path).end((err, res) => {
        if (err) return reject(err);
        js_scripts_content[path] = res.text;
        resolve();
      });
    }));
  });


  it('no `const`', function () {
    let re = /^(\s*)const /m;

    _.forEach(js_scripts_content, (script, path) => {
      assert.ok(!re.test(script), `"const" found in ${path}`);
    });
  });


  it('no `=>`', function () {
    let re = /^[^\/'"]*=>/m;

    _.forEach(js_scripts_content, (script, path) => {
      assert.ok(!re.test(script), `"=>" found in ${path}`);
    });
  });
});
