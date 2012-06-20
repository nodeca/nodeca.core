'use strict';


/*global nodeca, _*/


// stdlib
var crypto = require('crypto');


// crypto-strong random 128 bit string
function random() {
  var rnd = crypto.randomBytes(16);
  return crypto.createHash('md5').update(rnd).digest('hex');
}


nodeca.filters.after('', {weight: 25}, function (params, callback) {
  this.extras.assets.injectJavascript('window.REALTIME_ID = "' + random() + '";');
  callback();
});
