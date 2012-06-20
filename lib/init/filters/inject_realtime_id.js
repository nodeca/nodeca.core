'use strict';


/*global nodeca, _*/


// stdlib
var crypto = require('crypto');


// crypto-strong random 128 bit string
function random() {
  var rnd = crypto.randomBytes(16);
  return crypto.createHash('md5').update(rnd).digest('hex');
}


nodeca.filters.before('', {weight: 75}, function (params, callback) {
  this.extras.assets.requireStylesheet('app.css');
  this.extras.assets.includeJavascript('modernizr.custom.js');
  this.extras.assets.injectJavascript('window.REALTIME_ID = "' + random() + '";');
  this.extras.assets.requireJavascript('lib.js');
  this.extras.assets.requireJavascript('app.js');
  callback();
});
