'use strict';

var async      = require('async');
var MarkdownIt = require('markdown-it');
var _          = require('lodash');
var Wire       = require('./../system/wire');
var $          = require('./cheequery');


///////////////////////////////////////////////////////////////////////////////
// Parser class


function Parser() {
  this.bus = new Wire();
  this.md = new MarkdownIt('zero');
}


// Render message
//
// params:
// - text (String) - text in markdown
// - attachments (Array)
//   - media_id
//   - file_name
//   - type
// - options (Object) - object with plugins config
//   - links (Boolean)
//   - images (Boolean)
//   - ...
//
// callback(err, result):
// - err (Error | String) - null if success
// - result (Object)
//   - html (String) - displayed HTML
//   - text (String) - text for search index
//   - tail (Array)
//     - media_id (String)
//     - file_name (String)
//     - type (Number)
//
Parser.prototype.parse = function (params, callback) {
  var data = {
    params: params,
    result: {
      html: '',
      text: '',
      tail: []
    },
    ast: $.parse(this.md.render(params.text)),
    self: this
  };

  var steps = [
    'sanitize', // Cleanup AST from unresolved tags and attributes
    'transform', // Transform AST tags and attachments
    'render' // Transform AST to HTML format and render
  ];

  this.bus.after('render', { priority: 999 }, function (data) {
    data.result.html = data.ast.html();
    data.result.text = data.ast.text();
  });

  var self = this;

  async.eachSeries(steps, function (step, next) {
    self.bus.emit(step, data, next);
  }, function (err) {
    if (err) {
      callback(err);
      return;
    }

    callback(null, data.result);
  });
};


///////////////////////////////////////////////////////////////////////////////
// Parser builder class

var plugins = {};

var create = _.memoize(function (options) {
  var parser = new Parser();

  _.forEach(plugins, function (plugin, pluginName) {
    if (options[pluginName] !== false) {
      plugin(parser);
    }
  });

  return parser;
}, JSON.stringify);

module.exports = function (params, callback) {
  create(params.options).parse(params, callback);
};

module.exports.addPlugin = function (pluginName, plugin) {
  plugins[pluginName] = plugin;
};
