// Footnote parser plugin
//

'use strict';


module.exports = function () {

  return function (parser) {
    parser.md.use(require('markdown-it-footnote'));


    // Remove footnotes
    //
    parser.bus.before('html2preview.render', function remove_footnotes(data) {
      data.ast.find('.footnote-ref, .footnotes-sep, .footnotes').remove();
    });
  };
};
