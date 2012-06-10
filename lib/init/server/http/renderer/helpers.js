"use strict";


/*global nodeca, _*/


// stdlib
var crypto = require('crypto');


// nodeca
var HashTree = require('nlib').Support.HashTree;


// internal
var realtime = require('../../realtime');


////////////////////////////////////////////////////////////////////////////////


var helpers = module.exports = {};


////////////////////////////////////////////////////////////////////////////////


helpers.asset_path = function asset_path(path) {
  // {bundle: true} is a workaround for the mincer's bug, which is fixed in the
  // master branch, so this can be removed once we update mincer's dependency
  var asset = nodeca.runtime.assets.environment.findAsset(path, {bundle: true});
  return !asset ? "#" : ("/assets/" + asset.digestPath);
};


helpers.asset_include = function asset_include(path) {
  // {bundle: true} is a workaround for the mincer's bug, which is fixed in the
  // master branch, so this can be removed once we update mincer's dependency
  var asset = nodeca.runtime.assets.environment.findAsset(path, {bundle: true});
  return !asset ? "" : asset.toString();
};


helpers.config = function (part) {
  return !part ? nodeca.config : HashTree.get(nodeca.config, part);
};


// FIXME: this is a temporary shit used just to test that Faye works
helpers.count_online_users = function () {
  return realtime.activeClients + 1;
};


// crypto-strong random 128 bit string
helpers.random = function () {
  var rnd = crypto.randomBytes(16);
  return crypto.createHash('md5').update(rnd).digest('hex');
};


helpers.link_to = function (name, params) {
  return nodeca.runtime.router.linkTo(name, params) || '#';
};
