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

    parser.md.set({
      highlight: function (str, lang) {
        // Skip highlight for big texts (> 10K), to avoid CPU overload.
        if (str.length > 10000) { return ''; }

        var hl = parser.md.highlighter;

        if (lang) {
          // If language set & supported - try to highlight it
          if (hl.getLanguage(lang)) {
            try {
              return hl.highlight(lang, str).value;
            } catch (__) {}
          }
          return ''; // Do nothing on fail
        }

        try {
          // If language not set - try to autodetect
          return hl.highlightAuto(str).value;
        } catch (__) {}

        return ''; // use external default escaping
      }
    });
  };
};
