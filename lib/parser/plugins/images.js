// Images parser plugin
//

'use strict';


var _ = require('lodash');
var $ = require('../cheequery');


module.exports = function () {

  return function (parser) {
    parser.md.enable('image');

    // Add "image" class to all images in the document, assuming that img tags
    // could only come from markdown images at this point.
    //
    // It should be executed before all other renderer rules, because they
    // could add their own img tag (e.g. attachments rule adds thumbnails).
    //
    parser.bus.before('render', { priority: -100 }, function add_image_class(data) {
      data.ast.find('img').addClass('image');
    });
  };
};
