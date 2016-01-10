// Code block parser plugin
//

'use strict';


var hljs = require('highlight.js/lib/highlight.js');


module.exports = function () {

  return function (parser) {
    parser.md.enable([ 'fence', 'code', 'backticks' ]);

    // Expose to allow extending. Also you will be able to override this
    // object with new instance:
    //
    // parser.md.highlighter = require('highlight.js')
    //
    parser.md.highlighter = hljs;

    var hl = parser.md.highlighter;

    hl.registerLanguage('armasm',     require('highlight.js/lib/languages/armasm'));
    hl.registerLanguage('xml',        require('highlight.js/lib/languages/xml'));
    hl.registerLanguage('asciidoc',   require('highlight.js/lib//languages/asciidoc'));
    hl.registerLanguage('avrasm',     require('highlight.js/lib/languages/avrasm'));
    hl.registerLanguage('bash',       require('highlight.js/lib/languages/bash'));
    hl.registerLanguage('cpp',        require('highlight.js/lib/languages/cpp'));
    hl.registerLanguage('css',        require('highlight.js/lib/languages/css'));
    hl.registerLanguage('ruby',       require('highlight.js/lib/languages/ruby'));
    hl.registerLanguage('go',         require('highlight.js/lib/languages/go'));
    hl.registerLanguage('javascript', require('highlight.js/lib/languages/javascript'));
    hl.registerLanguage('json',       require('highlight.js/lib/languages/json'));
    hl.registerLanguage('less',       require('highlight.js/lib/languages/less'));
    hl.registerLanguage('lua',        require('highlight.js/lib/languages/lua'));
    hl.registerLanguage('perl',       require('highlight.js/lib/languages/perl'));
    hl.registerLanguage('nginx',      require('highlight.js/lib/languages/nginx'));
    hl.registerLanguage('rust',       require('highlight.js/lib/languages/rust'));
    hl.registerLanguage('scss',       require('highlight.js/lib/languages/scss'));
    hl.registerLanguage('stylus',     require('highlight.js/lib/languages/stylus'));
    hl.registerLanguage('yaml',       require('highlight.js/lib/languages/yaml'));

    parser.md.set({
      highlight: function (str, lang) {
        if (lang && hljs.getLanguage(lang)) {
          try {
            return '<pre class="hljs"><code>' +
                   hljs.highlight(lang, str).value +
                   '</code></pre>';
          } catch (__) {}
        }

        return '<pre class="hljs"><code>' + parser.md.utils.escapeHtml(str) + '</code></pre>';
      }
    });
  };
};
