"use strict";


/*global nodeca, _*/


// stdlib
var crypto = require('crypto');


// nodeca
var HashTree = require('nlib').Support.HashTree;
var JASON    = require('nlib').Vendor.JASON;


////////////////////////////////////////////////////////////////////////////////


var helpers = module.exports = {};


////////////////////////////////////////////////////////////////////////////////


helpers.asset_include = function asset_include(path) {
  var asset = nodeca.runtime.assets.environment.findAsset(path);
  return !asset ? "" : asset.toString();
};


helpers.config = function (part) {
  return !part ? nodeca.config : HashTree.get(nodeca.config, part);
};


// crypto-strong random 128 bit string
helpers.random = function () {
  var rnd = crypto.randomBytes(16);
  return crypto.createHash('md5').update(rnd).digest('hex');
};


helpers.link_to = function (name, params) {
  return nodeca.runtime.router.linkTo(name, params) || '#';
};


// nodeca reference
helpers.nodeca = nodeca;

// JSON alike serializer (but that treats RegExps, Function as they are)
helpers.jason = JASON.stringify;
