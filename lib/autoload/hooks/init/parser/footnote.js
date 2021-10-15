'use strict';

const crypto = require('crypto');


module.exports = function (N) {

  N.wire.once('init:parser', function footnote_plugin_init() {
    N.parser.addPlugin(
      'footnote',
      function (parser) {
        // Create a unique prefix for footnotes to resolve cases when multiple posts with footnotes are
        // on the same page, needs to be stable between rebuilds.
        parser.bus.before('ast2html', function create_footnote_prefix(data) {
          let prefix;

          Object.defineProperty(data, 'footnote_prefix', {
            // getter is used for lazy evaluation
            get() {
              prefix = prefix || (crypto.createHash('sha1').update(data.params.text).digest('hex').slice(0, 8) + '-');
              return prefix;
            }
          });
        });
      }
    );

    N.parser.addPlugin(
      'footnote',
      require('nodeca.core/lib/parser/plugins/footnote')(N)
    );
  });
};
