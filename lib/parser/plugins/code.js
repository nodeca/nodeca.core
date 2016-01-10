// Code block parser plugin
//

'use strict';


var hljs = require('highlight.js/lib/highlight.js');


module.exports = function () {

  return function (parser) {
    parser.md.enable([ 'fence', 'code', 'backticks' ]);

    hljs.registerLanguage('armasm',     require('highlight.js/lib/languages/armasm'));
    hljs.registerLanguage('xml',        require('highlight.js/lib/languages/xml'));
    hljs.registerLanguage('asciidoc',   require('highlight.js/lib//languages/asciidoc'));
    hljs.registerLanguage('avrasm',     require('highlight.js/lib/languages/avrasm'));
    hljs.registerLanguage('bash',       require('highlight.js/lib/languages/bash'));
    hljs.registerLanguage('cpp',        require('highlight.js/lib/languages/cpp'));
    hljs.registerLanguage('css',        require('highlight.js/lib/languages/css'));
    hljs.registerLanguage('ruby',       require('highlight.js/lib/languages/ruby'));
    hljs.registerLanguage('go',         require('highlight.js/lib/languages/go'));
    hljs.registerLanguage('javascript', require('highlight.js/lib/languages/javascript'));
    hljs.registerLanguage('json',       require('highlight.js/lib/languages/json'));
    hljs.registerLanguage('less',       require('highlight.js/lib/languages/less'));
    hljs.registerLanguage('lua',        require('highlight.js/lib/languages/lua'));
    hljs.registerLanguage('perl',       require('highlight.js/lib/languages/perl'));
    hljs.registerLanguage('nginx',      require('highlight.js/lib/languages/nginx'));
    hljs.registerLanguage('rust',       require('highlight.js/lib/languages/rust'));
    hljs.registerLanguage('scss',       require('highlight.js/lib/languages/scss'));
    hljs.registerLanguage('stylus',     require('highlight.js/lib/languages/stylus'));
    hljs.registerLanguage('yaml',       require('highlight.js/lib/languages/yaml'));

    // Expose to allow extending. Also you will be able to override this
    // object with new instance:
    //
    // parser.md.highlighter = require('highlight.js')
    //
    parser.md.highlighter = hljs;

    parser.md.set({
      highlight: function (str, lang) {
        if (lang && parser.md.highlighter.getLanguage(lang)) {
          try {
            return '<pre class="hljs"><code>' +
                   parser.md.highlighter.highlight(lang, str).value +
                   '</code></pre>';
          } catch (__) {}
        }

        return '<pre class="hljs"><code>' + parser.md.utils.escapeHtml(str) + '</code></pre>';
      }
    });
  };
};
