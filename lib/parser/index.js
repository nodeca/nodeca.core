'use strict';

const MarkdownIt = require('markdown-it');
const _          = require('lodash');
const wire       = require('event-wire');
const charcount  = require('charcount');
const $          = require('./cheequery');


// Get an amount of non-space characters in html tree.
//
// - node - root node
// - limit - remove all child elements above limit if specified
//
function getTextLength(node, limit, state) {
  state = state || { length: 0, ellipsis: false };

  node.contents().each(function () {
    if (limit && state.length >= limit) {
      if (!state.ellipsis) {
        state.ellipsis = true;
        $(this).replaceWith('…');
      } else {
        $(this).remove();
      }
      return;
    }

    if (this.type === 'text') {
      state.length += charcount(this.data.replace(/\s+/g, ''));
    } else if (this.type === 'tag') {

      if (this.name === 'img') {
        // if tag is an image, count characters in `src` attribute instead
        state.length += $(this).attr('src');

      } else if (this.name !== 'msg-quote') {
        // count all other tags except blockquotes
        getTextLength($(this), limit, state);
      }
    }
  });

  return state.length;
}


function wireOptions() {
  let options = {};

  if (module.exports.Promise) options.p = module.exports.Promise;
  if (module.exports.co) options.co = module.exports.co;

  return options;
}


///////////////////////////////////////////////////////////////////////////////
// Parser class


function Parser() {
  let bus = this.bus = wire(wireOptions());


  this.bus.on('md2html', function md2html_emit_render(data) {
    // Transform AST to HTML format and render
    return bus.emit('ast2html', data);
  });

  this.bus.after('md2html', function md2html_serialize_ast(data) {
    data.result.html = data.ast.html();
    data.result.text = data.ast.text();
  });


  this.bus.on('md2preview', function md2preview_emit_render(data) {
    // Transform AST to preview format and render
    return bus.emit('ast2preview', data);
  });

  this.bus.after('md2preview', function md2preview_serialize_ast(data) {
    getTextLength(data.ast, data.params.limit); // TODO: ast2length

    data.result.preview = data.ast.html();
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
//
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
//
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
Parser.prototype.md2html = function (params, callback) {
  let ast = $.parse(this.md.render(params.text));
  let text_length = getTextLength(ast); // TODO: ast2length
  let data = {
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

  if (!callback) {
    return this.bus.emit('md2html', data).then(() => data.result);
  }

  this.bus.emit('md2html', data, function (err) {
    if (err) {
      callback(err);
      return;
    }

    callback(null, data.result);
  });
};


// Create preview from message
//
// params:
//
// - text (String) - text in markdown
// - attachments (Array) - list of attachment ids
// - link2text (Boolean) - replace links with spans
// - limit (Number) - limit maximum text length
//
// callback(err, result):
//
// - err (Error | String) - null if success
// - result (Object)
//   - preview (String) - simplified HTML
//
Parser.prototype.md2preview = function (params, callback) {
  let ast = $.parse(this.md.render(params.text));
  let data = {
    params,
    ast,
    self: this,
    result: {
      preview: ''
    }
  };

  if (!callback) {
    return this.bus.emit('md2preview', data).then(() => data.result);
  }

  this.bus.emit('md2preview', data, function (err) {
    if (err) {
      callback(err);
      return;
    }

    callback(null, data.result);
  });
};


///////////////////////////////////////////////////////////////////////////////
// Parser builder class
//
let plugins = {};


// Create parser instance with needed plugins and cache it
//
const create = _.memoize(function (options) {
  let parser = new Parser();

  _.forEach(plugins, (plugin, pluginName) => {
    // `options === true` means all plugins are enabled (used in tests)
    if (options === true || options[pluginName] || plugin.persistent) {
      plugin.fn(parser);
    }
  });

  return parser;
}, JSON.stringify);


// md2html wrapper
//
function md2html(params, callback) {
  return create(params.options).md2html(params, callback);
}


// md2preview wrapper
//
function md2preview(params, callback) {
  return create(true).md2preview(params, callback);
}


// Register a plugin
//
//  - pluginName (String)  - plugin name
//  - plugin (Function)    - function (parser) { ... }
//  - persistent (Boolean) - if `true`, this plugin is always enabled
//
function addPlugin(pluginName, plugin, persistent) {
  plugins[pluginName] = { fn: plugin, persistent };
}


module.exports = {
  md2html,
  md2preview,
  addPlugin
};


// Override this exports to use `blueburd` & `bluebird-co`
//
module.exports.Promise = null;
module.exports.co = null;
