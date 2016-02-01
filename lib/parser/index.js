'use strict';

var MarkdownIt = require('markdown-it');
var _          = require('lodash');
var wire       = require('event-wire');
var $          = require('./cheequery');


// Get an amount of non-space characters in html tree
//
function get_text_length(node) {
  var length = 0;

  node.contents().each(function () {
    if (this.type === 'text') {
      // don't count spaces, count each surrogate pair as one character
      length += this.data.replace(/\s+|[\uD800-\uDBFF](?=[\uDC00-\uDFFF])/g, '').length;
    } else if (this.type === 'tag') {

      if (this.name === 'img') {
        // if tag is an image, count characters in `src` attribute instead
        length += $(this).attr('src');

      } else if (this.name !== 'msg-quote') {
        // count all other tags except blockquotes
        length += get_text_length($(this));
      }
    }
  });

  return length;
}


///////////////////////////////////////////////////////////////////////////////
// Parser class


function Parser() {
  var bus = this.bus = wire();

  this.bus.on('parse', function emit_render(data) {
    // Transform AST to HTML format and render
    return bus.emit('render', data);
  });

  this.bus.after('parse', function serialize_ast(data) {
    data.result.html = data.ast.html();
    data.result.text = data.ast.text();
  });

  // Default zero markdown config to extend
  this.md = new MarkdownIt('zero', {
    typographer: true
  });

  // Enable basic features
  this.md.enable([
    'newline', 'escape', 'entity',
    'smartquotes', 'replacements'
  ]);
}


// Render message
//
// params:
// - text (String) - text in markdown
// - imports (Array) - list of urls user has access to (optional, rebuild mode)
// - image_info (Object) - image sizes and attachment attributes (optional, rebuild mode)
// - user_info (Object) - for permission checks (needed if `imports` is not present)
// - attachments (Array) - list of attachment ids
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
//   - image_info (Object) - image sizes and attachment attributes
//   - imports (Array) - list of urls used to create this post
//   - import_users (Array) - list of users needed to display this post
//   - tail (Array)
//     - media_id (String)
//     - file_name (String)
//     - type (Number)
//
Parser.prototype.parse = function (params, callback) {
  var ast = $.parse(this.md.render(params.text));
  var text_length = get_text_length(ast);
  var data = {
    params,
    result: {
      html: '',
      text: '',
      text_length,
      tail: [],
      image_info: {},
      imports: _.clone(params.imports) || [],
      import_users: []
    },
    ast,
    self: this
  };

  this.bus.emit('parse', data, function (err) {
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
