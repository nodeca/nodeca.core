"use strict";


/*global nodeca, _*/


////////////////////////////////////////////////////////////////////////////////


function Extras() {
  Object.defineProperty(this, '__data__', {
    value: {
      javascripts: {require: [], include: [], inject:  []},
      stylesheets: {require: [], include: [], inject:  []}
    }
  });
}

Extras.prototype = {
  requireJavascript: function (logicalPath) {
    this.__data__.javascripts.require.push(logicalPath);
  },

  requireStylesheet: function (logicalPath, media) {
    this.__data__.stylesheets.require.push([logicalPath, media]);
  },

  includeJavascript: function (logicalPath) {
    this.__data__.javascripts.include.push(logicalPath);
  },

  includeStylesheet: function (logicalPath, media) {
    this.__data__.stylesheets.include.push([logicalPath, media]);
  },

  injectJavascript: function (source) {
    this.__data__.javascripts.inject.push(source);
  },

  injectStylesheet: function (source, media) {
    this.__data__.stylesheets.inject.push([source, media]);
  }
};


////////////////////////////////////////////////////////////////////////////////


function js_require(url) {
  return '<script type="application/javascript" src="' + url + '"></script>';
}


function js_include(str) {
  return '<script type="application/javascript">' + str + '</script>';
}


function js_error(message) {
  return js_include('alert("' + message + '");');
}


function css_require(url, media) {
  media = !!media ? (' media="' + media + '"') : '';
  return '<link rel="stylesheet" href="' + url + '"' + media + ' />';
}


function css_include(str, media) {
  media = !!media ? (' media="' + media + '"') : '';
  return '<style type="text/css"' + media + '>' + str + '</style>';
}


function build_javascript_tags() {
  var parts = [], env = nodeca.runtime.assets.environment;

  /*jshint validthis:true*/

  // process required files
  _.each(this.require, function (logicalPath) {
    var asset = env.findAsset(logicalPath);

    if (asset) {
      parts.push(js_require('/assets/' + asset.digestPath));
      return;
    }

    parts.push(js_error('JavaScript file ' + logicalPath + ' not found.'));
  });

  // push included inlines
  _.each(this.include, function (logicalPath) {
    var asset = env.findAsset(logicalPath);

    if (asset) {
      if (!asset.isCompiled) {
        parts.push(js_error('JavaScript file ' + logicalPath + ' was not precompiled.'));
        return;
      }

      parts.push(js_include(asset.toString()));
      return;
    }

    parts.push(js_error('JavaScript file ' + logicalPath + ' not found.'));
  });

  // push inline injections
  _.each(this.inject, function (source) {
    parts.push(js_include(source));
  });

  return parts.join('\n');
}


function build_stylesheet_tags(data) {
  var parts = [], env = nodeca.runtime.assets.environment;

  /*jshint validthis:true*/

  // process required files
  _.each(this.require, function (pair) {
    var asset = env.findAsset(pair[0]);

    if (asset) {
      parts.push(css_require('/assets/' + asset.digestPath, pair[1]));
      return;
    }

    parts.push(js_error('Stylesheet file ' + pair[0] + ' not found.'));
  });

  // push included inlines
  _.each(this.include, function (pair) {
    var asset = env.findAsset(pair[0]);

    if (asset) {
      if (!asset.isCompiled) {
        parts.push(js_error('Stylesheet file ' + pair[0] + ' was not precompiled.'));
        return;
      }

      parts.push(css_include(asset.toString(), pair[1]));
      return;
    }

    parts.push(js_error('Stylesheet file ' + pair[0] + ' not found.'));
  });

  // push inline injections
  _.each(this.inject, function (pair) {
    parts.push(css_include(pair[0], pair[1]));
  });

  return parts.join('\n');
}


////////////////////////////////////////////////////////////////////////////////


nodeca.filters.before('', {weight: -50}, function assets_helpers(params, callback) {
  var data = (this.extras.assets = new Extras).__data__;

  this.helpers.javascripts  = build_javascript_tags.bind(data.javascripts);
  this.helpers.stylesheets  = build_stylesheet_tags.bind(data.stylesheets);

  callback();
});


nodeca.filters.after('', {weight: 50}, function precompile_required_assets(params, callback) {
  var assets = [];

  assets.push.apply(assets, this.extras.assets.__data__.javascripts.require);
  assets.push.apply(assets, this.extras.assets.__data__.javascripts.include);

  assets.push.apply(assets, this.extras.assets.__data__.stylesheets.require);
  assets.push.apply(assets, this.extras.assets.__data__.stylesheets.include);

  if (0 === assets.length) {
    callback(null);
    return;
  }

  nodeca.runtime.assets.environment.precompile(assets, callback);
});
