// Init medialinks providers parser function
//
// Example:
//
//   var youtubeParser = N.config.medialinks.providers.youtube.parse;
//   youtubeParser('http://www.youtube.com/watch?v=iQqJm14sHRY', function (err, medialinkData) {
//     console.log(medialinkData);
//   });
//

/* eslint no-new-func: 0 */
'use strict';

var _    = require('lodash');

module.exports = function (N) {
  N.wire.before('init:server', function init_medialinks() {

    N.config.medialinks = N.config.medialinks || {};
    N.config.medialinks.providers = N.config.medialinks.providers || {};
    var providers = N.config.medialinks.providers;
    var regExpParse = /^\/(.*?)\/(g?i?m?y?)$/;

    _.forEach(providers, function (provider) {

      // Convert 'match' properties to array
      if (!_.isArray(provider.match)) {
        provider.match = [ provider.match ];
      }

      // Make 'match' properties to RegExp
      for (var i = 0; i < provider.match.length; i++) {
        var regExp = new RegExp(
          provider.match[i].replace(regExpParse, '$1'),
          provider.match[i].replace(regExpParse, '$2')
        );
        provider.match[i] = regExp;
      }

      // Replace 'fetch' properties by function
      var parser = new Function('require', 'N', 'url', 'callback', provider.fetch);
      provider.fetch = function (url, callback) {
        parser(require, N, url, callback);
      };
    });
  });
};
