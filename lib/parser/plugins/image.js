// Image parser plugin
//

'use strict';


var _ = require('lodash');
var $ = require('../cheequery');


module.exports = function () {

  return function (parser) {
    var imgTpl = _.template('<img class="image" src="<%- src %>" alt="<%- alt %>"' +
      '<% if (width || height) { %>' +
        ' width="<%- width %>" height="<%- height %>"' +
      '<% } %>' +
    '>');

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

    parser.bus.after('render', function add_image_size(data) {
      data.ast.find('.image').each(function () {
        var width, height;
        var $img = $(this);

        // replace all dots with full-width dots due to mongodb restrictions
        var key = 'url:' + $img.attr('src').replace(/\./g, '．');

        if (data.result.image_info[key]) {
          // set image width and height if available
          width = data.result.image_info[key].width;
          height = data.result.image_info[key].height;
        } else {
          // schedule image size fetch
          data.result.image_info[key] = null;
        }

        var replacement = $(imgTpl({
          src:    $img.attr('src'),
          alt:    $img.attr('alt'),
          width:  width,
          height: height
        }));

        $img.replaceWith(replacement);
      });
    });
  };
};
