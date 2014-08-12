// Compile medialinks providers config.
//
// - providersConfig  - N.config.medialinks.providers
// - enabledProviders - Array of providers to compile or 'true' to compile all providers
// - stubMode         - 'true' to create stub for 'fetch' and 'template' functions. Default 'false'
//
// Compile:
//
//   provider.fetch (string) -> function (url, callback(err, data))
//   In stub mode will callback empty data object
//
//   provider.template (string) -> function (data)
//   In stub mode will return stub template
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

'use strict';

var _ = require('lodash');

function compile(providersConfig, enabledProviders, stubMode) {
  var providers;
  var regExpParse = /^\/(.*?)\/([gimy]{0,4})$/;

  // Find providers to parse
  if (enabledProviders === true) {
    providers = providersConfig;
  } else {
    providers = _.filter(providersConfig, function (provider, providerName) {
      return enabledProviders.indexOf(providerName) !== -1;
    });
  }

  providers = _.cloneDeep(providers);

  _.forEach(providers, function (provider) {

    // Convert 'match' properties to array
    if (!_.isArray(provider.match)) {
      provider.match = [ provider.match ];
    }

    var regExpParseMatch;

    // Make 'match' properties to RegExp
    provider.match = provider.match.map(function (regExpStr) {
      regExpParseMatch = regExpStr.match(regExpParse);
      return new RegExp(regExpParseMatch[1], regExpParseMatch[2]);
    });

    // If provider has no 'stub' property - compile original 'fetch' and 'template'
    if (stubMode && provider.stub) {

      // Create stub 'fetch' functions
      provider.fetch = function (url, callback) {
        callback(null, {});
      };

      // Replace 'template' properties by stub function
      provider.template = function () {
        return _.template(provider.stub);
      };
    } else {

      /* eslint no-new-func: 0 */

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


module.exports = _.memoize(compile, function (providersConfig, enabledProviders, stubMode) {
  return JSON.stringify(enabledProviders) + stubMode;
});
