// Code blocks parser plugin
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
    hl.registerLanguage('stylus',     require('highlight.js/lib/languages/stylus'));
    hl.registerLanguage('css',        require('highlight.js/lib/languages/css'));

    parser.md.renderer.rules.fence = function (tokens, idx, options, env, _self) {
      var token = tokens[idx],
          hl = parser.md.highlighter,
          langName = '',
          source = token.content,
          result = parser.md.utils.escapeHtml(source), // default result value
          result_lang = '',
          hl_out;

      /*eslint-disable max-depth*/
      try {
        // Skip highlight for big texts (> 10K), to avoid CPU overload.
        if (source.length < 10000) {

          if (token.info) {
            langName = parser.md.utils.unescapeAll(token.info.trim().split(/\s+/g)[0]);
          }

          if (langName) {
            // If language set & supported - try to highlight it
            if (hl.getLanguage(langName)) {
              hl_out = hl.highlight(langName, source);

              result = hl_out.value;
              result_lang = hl_out.language;
            }

          } else {
            // If language not set - try to autodetect
            hl_out = hl.highlightAuto(source);

            result = hl_out.value;
            result_lang = hl_out.language;
          }
        }
      } catch (__) {}

      // Add detected language to wrapper class
      if (result_lang) {
        token.attrPush([ 'class', result_lang ]);
      }

      return  '<pre><code' + _self.renderAttrs(token) + '>'
            + result
            + '</code></pre>\n';
    };
  };
};
