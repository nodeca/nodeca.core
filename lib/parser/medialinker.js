// Medialinker class.
//
// - providersConfig  - N.config.medialinks.providers
// - enabledProviders - Array of providers to compile or 'true' to compile all providers
// - stubMode         - 'true' to create stub for 'fetch' and 'template' functions. Default 'false'
//
// Example:
//
//   var medialinker = N.medialinker('albums');
//
//   medialinker.render('http://www.youtube.com/watch?v=iQqJm14sHRY', function (err, result) {
//     console.log(result.html);
//   });
//


'use strict';

var _ = require('lodash');


function Medialinker(providersConfig, enabledProviders, stubMode) {
  var providers;
  // Parse regexp text to pattern and flags parts
  var regexpParse = /^\/(.*?)\/([gimy]{0,4})$/;

  // Filter enabled providers
  if (enabledProviders === true) {
    providers = providersConfig;
  } else {
    providers = _.pick(providersConfig, function (provider, providerName) {
      return enabledProviders.indexOf(providerName) !== -1;
    });
  }

  providers = _.cloneDeep(providers);

  _.forEach(providers, function (provider, providerKey) {

    // Convert 'match' properties to array
    if (!Array.isArray(provider.match)) {
      provider.match = [ provider.match ];
    }

    var match;

    // Convert `match` properties to RegExp
    provider.match = provider.match.map(function (regexpStr) {
      match = regexpStr.match(regexpParse);

      if (!match) {
        throw 'Medialinker: invalid regexp in config for "' + providerKey + '" ("' + regexpStr + '")';
      }

      return new RegExp(match[1], match[2]);
    });

    // If stub mode and provider has `stub` property - compile stub `template` and fake `fetch`
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
      // Compile original `fetch` and `template`

      /*eslint-disable no-new-func*/

      // Compile 'fetch' functions
      var parser = new Function('require', 'url', 'callback', provider.fetch);

      provider.fetch = function (url, callback) {
        parser(require, url, callback);
      };

      // Replace `template` properties by function
      var template = provider.template;

      provider.template = _.template(template, { variable: 'self' });
    }
  });

  this.__providers__ = providers;
}


// Get active providers
//
//   {
//     youtube: {
//       name: 'YouTube',
//       home: 'http://...'
//     },
//     ...
//   }
//
Medialinker.prototype.providers = function () {
  return _.mapValues(this.__providers__, function (provider) {
    return {
      name: provider.name,
      home: provider.home
    };
  });
};


// Render medialink
//
Medialinker.prototype.render = function (url, callback) {

  // Find provider by url
  var provider = _.find(this.__providers__, function (provider) {
    for (var i = 0; i < provider.match.length; i++) {
      if (provider.match[i].test(url)) {
        return true;
      }
    }
    return false;
  });

  if (!provider) {
    callback(null, null);
    return;
  }

  provider.fetch(url, function (err, data) {
    if (err) {
      callback(err);
      return;
    }

    callback(null, {
      meta: data,
      html: provider.template(data)
    });
  });
};


module.exports = Medialinker;
