'use strict';

const MarkdownIt = require('markdown-it');
const _          = require('lodash');
const wire       = require('event-wire');
const utils      = require('./utils');
const $          = require('./cheequery');


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


  this.bus.on('ast2length', function calc_p_length(data) {
    data.ast.find('p').each(function () {
      data.result.text_length += utils.text_length($(this));
    });
  });

  this.bus.before('md2html', function md2html_emit_length(data) {
    // Calculate AST text length
    return bus.emit('ast2length', data)
      .then(() => {
        // We should create new AST because plugins (quote) could modify it
        data.ast = $.parse(data.ast_text);
      });
  });

  this.bus.on('md2html', function md2html_emit_render(data) {
    // Transform AST to HTML format and render
    return bus.emit('ast2html', data);
  });

  this.bus.after('md2html', function md2html_serialize_ast(data) {
    data.result.html = data.ast.html();
    data.result.text = data.ast.text();
  });


  this.bus.after('ast2preview', function replace_paragraphs(data) {
    // Replace paragraphs to text
    data.ast.find('p').each(function () {
      $(this).replaceWith($(this).contents());
    });

    // We should replace newlines with spaces. Removing `<br>` is enough,
    // because those are followed with `\n`.
    data.ast.find('br').each(function () {
      $(this).remove();
    });
  });

  this.bus.after('ast2preview', function limit_length(data) {
    if (!data.params.limit) return;

    let length = 0;
    let ellipsis = false;

    function limit(node) {
      node.contents().each(function () {
        if (length >= data.params.limit) {
          if (!ellipsis) {
            ellipsis = true;
            $(this).replaceWith('…');
          } else {
            $(this).remove();
          }
          return;
        }

        if (this.type === 'text') {
          length += this.data.length;

          if (length > data.params.limit) {
            this.data = this.data.slice(0, data.params.limit - length) + '…';
            ellipsis = true;
          }
        } else if (this.type === 'tag') {
          limit($(this));
        } else {
          $(this).remove(); // comment?
        }
      });
    }

    limit(data.ast);
  });

  this.bus.on('md2preview', function md2preview_emit_render(data) {
    // Transform AST to preview format and render
    return bus.emit('ast2preview', data);
  });

  this.bus.after('md2preview', function md2preview_serialize_ast(data) {
    // TODO: limit

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
//   - imports (Array) - list of urls used to create this post
//   - import_users (Array) - list of users needed to display this post
//   - tail (Array)
//     - media_id (String)
//     - file_name (String)
//     - type (Number)
//
Parser.prototype.md2html = function (params, callback) {
  let ast_text = this.md.render(params.text);
  let data = {
    params,
    result: {
      html: '',
      text: '',
      text_length: 0,
      tail: [],
      imports: _.clone(params.imports) || [],
      import_users: []
    },
    ast: $.parse(ast_text),
    ast_text,
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
let plugins = [];


// Create parser instance with needed plugins and cache it
//
const create = _.memoize(function (options) {
  let parser = new Parser();

  plugins.forEach(plugin => {
    let namespace = plugin.name.split(/[:.]/)[0];

    // `options === true` means all plugins are enabled (used in tests)
    if (options === true || options[namespace] || plugin.persistent) {
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
  plugins.push({ name: pluginName, fn: plugin, persistent });
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
