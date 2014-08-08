// Compile medialinks providers functions
//
// - providersConfig - N.config.medialinks.providers
// - providersList   - Array of providers to compile or 'true' to compile all providers
// - stub            - 'true' to create stub for 'fetch' and 'template' functions. Default 'false'
//
// Example:
//
//   var medialinks = require('lib/parser/medialinks');
//   var providers = medialinks(N.config.medialinks.providers, [ 'youtube' ]);
//
//   var youtubeParser = providers['youtube'];
//   youtubeParser.fetch('http://www.youtube.com/watch?v=iQqJm14sHRY', function (err, data) {
//     var html = youtubeParser.template(data);
//   });
//

/* eslint no-new-func: 0 */
'use strict';

var _ = require('lodash');

function compile(providers, stub) {
  providers = _.cloneDeep(providers);
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

    if (stub) {

      // Create stub 'fetch' functions
      provider.fetch = function (url, callback) {
        callback(null, {});
      };

      // Replace 'template' properties by stub function
      provider.template = function () {
        return provider.stub;
      };
    } else {

      // Compile 'fetch' functions
      var parser = new Function('require', 'url', 'callback', provider.fetch);
      provider.fetch = function (url, callback) {
        parser(require, url, callback);
      };

      // Replace 'template' properties by function
      var template = provider.template;
      provider.template = function (data) {
        return _.template(template, data, { variable: 'self' });
      };
    }
  });

  return providers;
}


module.exports = _.memoize(function (providersConfig, providersList, stub) {
  if (stub === undefined) {
    stub = false;
  }

  var providers;

  // Find providers to parse
  if (providersList === true) {
    providers = providersConfig;
  } else {
    providers = _.filter(providersConfig, function (provider, providerName) {
      return providersList.indexOf(providerName) !== -1;
    });
  }

  return compile(providers, stub);

}, function (providersConfig, providersList, stub) {
  return [ JSON.stringify(providersConfig), JSON.stringify(providersList), stub ].join(',');
});
