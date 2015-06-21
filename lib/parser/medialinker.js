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
var helpers = {
  encode: require('mdurl/encode'),
  decode: require('mdurl/decode')
};


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

    // Compile templates
    [ 'fetch_url', 'view', 'stub', 'thumb_url' ].forEach(function (prop) {
      if (provider[prop]) {
        provider[prop] = _.template(provider[prop], { variable: 'self' });
      }
    });
  });

  this.__providers__ = providers;
  this.__stubMode__ = stubMode;
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
// - url (String) - medialink url
// - type (String) - optional, `block`, `inline` or `any`, default `any`
// - callback (Function)
//
Medialinker.prototype.render = function (url, type, callback) {
  if (!callback) {
    callback = type;
    type = 'any';
  }

  // Find provider by url and type
  var provider = _.find(this.__providers__, function (provider) {
    if (type !== 'any' && provider.type !== 'any' && type !== provider.type) {
      return false;
    }

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

  if (this.__stubMode__ && provider.stub) {
    callback(null, {
      html: provider.stub({ src: url, helpers: helpers })
    });
    return;
  }

  if (!provider.fetch_url) {
    var result = { html: provider.view({ src: url, helpers: helpers }) };

    if (provider.thumb_url) {
      result.thumb = provider.thumb_url({ src: url, helpers: helpers });
    }

    callback(null, result);
    return;
  }

  // Use alias to avoid embedding server code to client
  var _require = require;
  var request = _require('request');

  // TODO: request limit
  // TODO: cache
  request(provider.fetch_url({ src: url, helpers: helpers }).trim(), function (err, response, body) {
    if (err) {
      callback(err);
      return;
    }

    if (response.statusCode !== 200) {
      callback({ code: response.statusCode });
      return;
    }

    if (response.headers['content-type'].indexOf('application/json') === 0) {
      try {
        body = JSON.parse(body);
      } catch (e) {
        callback(e);
        return;
      }
    }

    var result = { html: provider.view({ src: url, data: body, helpers: helpers }) };

    if (provider.thumb_url) {
      result.thumb = provider.thumb_url({ src: url, data: body, helpers: helpers });
    }

    callback(null, result);
  });
};


module.exports = Medialinker;
