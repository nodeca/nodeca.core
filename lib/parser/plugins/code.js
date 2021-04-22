// Code block parser plugin
//
'use strict';


const hljs  = require('highlight.js/lib/core');
const $     = require('../cheequery');
const _     = require('lodash');
const utils = require('../utils');


module.exports = function () {

  return function (parser) {
    parser.md.enable([ 'fence', 'code', 'backticks' ]);

    hljs.registerLanguage('actionscript', require('highlight.js/lib/languages/actionscript'));
    hljs.registerLanguage('apache',       require('highlight.js/lib/languages/apache'));
    hljs.registerLanguage('armasm',       require('highlight.js/lib/languages/armasm'));
    hljs.registerLanguage('xml',          require('highlight.js/lib/languages/xml'));
    hljs.registerLanguage('asciidoc',     require('highlight.js/lib//languages/asciidoc'));
    hljs.registerLanguage('avrasm',       require('highlight.js/lib/languages/avrasm'));
    hljs.registerLanguage('bash',         require('highlight.js/lib/languages/bash'));
    hljs.registerLanguage('clojure',      require('highlight.js/lib/languages/clojure'));
    hljs.registerLanguage('cmake',        require('highlight.js/lib/languages/cmake'));
    hljs.registerLanguage('coffeescript', require('highlight.js/lib/languages/coffeescript'));
    hljs.registerLanguage('c-like',       require('highlight.js/lib/languages/c-like'));
    hljs.registerLanguage('c',            require('highlight.js/lib/languages/c'));
    hljs.registerLanguage('cpp',          require('highlight.js/lib/languages/cpp'));
    hljs.registerLanguage('arduino',      require('highlight.js/lib/languages/arduino'));
    hljs.registerLanguage('css',          require('highlight.js/lib/languages/css'));
    hljs.registerLanguage('diff',         require('highlight.js/lib/languages/diff'));
    hljs.registerLanguage('django',       require('highlight.js/lib/languages/django'));
    hljs.registerLanguage('dockerfile',   require('highlight.js/lib/languages/dockerfile'));
    hljs.registerLanguage('ruby',         require('highlight.js/lib/languages/ruby'));
    hljs.registerLanguage('fortran',      require('highlight.js/lib/languages/fortran'));
    hljs.registerLanguage('glsl',         require('highlight.js/lib/languages/glsl'));
    hljs.registerLanguage('go',           require('highlight.js/lib/languages/go'));
    hljs.registerLanguage('groovy',       require('highlight.js/lib/languages/groovy'));
    hljs.registerLanguage('handlebars',   require('highlight.js/lib/languages/handlebars'));
    hljs.registerLanguage('haskell',      require('highlight.js/lib/languages/haskell'));
    hljs.registerLanguage('ini',          require('highlight.js/lib/languages/ini'));
    hljs.registerLanguage('java',         require('highlight.js/lib/languages/java'));
    hljs.registerLanguage('javascript',   require('highlight.js/lib/languages/javascript'));
    hljs.registerLanguage('json',         require('highlight.js/lib/languages/json'));
    hljs.registerLanguage('less',         require('highlight.js/lib/languages/less'));
    hljs.registerLanguage('lisp',         require('highlight.js/lib/languages/lisp'));
    hljs.registerLanguage('livescript',   require('highlight.js/lib/languages/livescript'));
    hljs.registerLanguage('lua',          require('highlight.js/lib/languages/lua'));
    hljs.registerLanguage('makefile',     require('highlight.js/lib/languages/makefile'));
    hljs.registerLanguage('matlab',       require('highlight.js/lib/languages/matlab'));
    hljs.registerLanguage('mipsasm',      require('highlight.js/lib/languages/mipsasm'));
    hljs.registerLanguage('perl',         require('highlight.js/lib/languages/perl'));
    hljs.registerLanguage('nginx',        require('highlight.js/lib/languages/nginx'));
    hljs.registerLanguage('objectivec',   require('highlight.js/lib/languages/objectivec'));
    hljs.registerLanguage('php',          require('highlight.js/lib/languages/php'));
    hljs.registerLanguage('python',       require('highlight.js/lib/languages/python'));
    hljs.registerLanguage('rust',         require('highlight.js/lib/languages/rust'));
    hljs.registerLanguage('scala',        require('highlight.js/lib/languages/scala'));
    hljs.registerLanguage('scheme',       require('highlight.js/lib/languages/scheme'));
    hljs.registerLanguage('scss',         require('highlight.js/lib/languages/scss'));
    hljs.registerLanguage('smalltalk',    require('highlight.js/lib/languages/smalltalk'));
    hljs.registerLanguage('stylus',       require('highlight.js/lib/languages/stylus'));
    hljs.registerLanguage('swift',        require('highlight.js/lib/languages/swift'));
    hljs.registerLanguage('tcl',          require('highlight.js/lib/languages/tcl'));
    hljs.registerLanguage('latex',        require('highlight.js/lib/languages/latex'));
    hljs.registerLanguage('typescript',   require('highlight.js/lib/languages/typescript'));
    hljs.registerLanguage('verilog',      require('highlight.js/lib/languages/verilog'));
    hljs.registerLanguage('vhdl',         require('highlight.js/lib/languages/vhdl'));
    hljs.registerLanguage('yaml',         require('highlight.js/lib/languages/yaml'));

    // Expose to allow extending. Also you will be able to override this
    // object with new instance:
    //
    // parser.md.highlighter = require('highlight.js')
    //
    parser.md.highlighter = hljs;


    ///////////////////////////////////////////////////////////////////////////
    // Block code to AST
    //
    const internalTpl = _.template('<msg-codeblock<% if (lang) { %> data-nd-lang="<%- lang %>"<% } %>>' +
                                   '<%- content %></msg-codeblock>');
    const unescapeAll = parser.md.utils.unescapeAll;


    parser.md.renderer.rules.code_block = function (tokens, idx) {
      return internalTpl({
        content: tokens[idx].content,
        lang: ''
      });
    };


    parser.md.renderer.rules.fence = function (tokens, idx) {
      let token = tokens[idx];
      let info = token.info ? unescapeAll(token.info).trim() : '';
      let lang = info.split(/\s+/g)[0];

      return internalTpl({
        content: token.content,
        lang
      });
    };


    ///////////////////////////////////////////////////////////////////////////
    // Render codeblock to HTML
    //
    const tpl = _.template('<pre class="hljs<% if (lang) { %> language-<%- lang %><% } %>">' +
                           '<code><%= content %></code></pre>\n');


    parser.bus.on('ast2html', function render_codeblock(data) {
      data.ast.find('msg-codeblock').each(function () {
        let $el = $(this);
        let lang = $el.data('nd-lang');

        try {
          if (lang && lang !== 'auto' && parser.md.highlighter.getLanguage(lang)) {
            $el.replaceWith(tpl({
              lang,
              content: parser.md.highlighter.highlight($el.text(), { language: lang, ignoreIllegals: true }).value
            }));
            return;
          } else if (lang === 'auto') {
            let result = parser.md.highlighter.highlightAuto($el.text());

            $el.replaceWith(tpl({
              lang: result.language,
              content: result.value
            }));
            return;
          }
        } catch (__) {}

        $el.replaceWith(tpl({
          lang,
          content: $el.html()
        }));
      });
    });


    ///////////////////////////////////////////////////////////////////////////
    // Render code to preview
    //
    // - `<msg-codeblock>` icon
    // - `<code>` to text
    //
    parser.bus.on('ast2preview', function code2preview(data) {
      data.ast.find('msg-codeblock').replaceWith('<span class="icon icon-code"></span>');
      data.ast.find('code').each(function () {
        $(this).replaceWith($(this).contents());
      });
    });


    ///////////////////////////////////////////////////////////////////////////
    // Get text length
    //
    parser.bus.on('ast2length', function calc_length(data) {
      data.ast.find('code, msg-codeblock').each(function () {
        data.result.text_length += utils.text_length($(this));
      });
    });
  };
};
