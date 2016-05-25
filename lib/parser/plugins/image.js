// Image parser plugin
//
'use strict';


const _ = require('lodash');
const $ = require('../cheequery');


module.exports = function () {

  return function (parser) {
    let imgTpl = _.template(
      '<% if (width && height) { %>' +
        '<span class="image" style="width: <%- width %>px" data-nd-orig="<%- src %>">' +
          '<img src="<%- src %>" alt="<%- alt %>" title="<%- title %>">' +
          '<span class="image__spacer" style="padding-bottom: <%- (height/width*100).toFixed(4) %>%;">' +
        '</span>' +
      '<% } else { %>' +
        '<img class="image" data-nd-orig="<%- src %>" src="<%- src %>" alt="<%- alt %>" title="<%- title %>">' +
      '<% } %>');

    parser.md.enable('image');

    // Add "image" class to all images in the document, assuming that img tags
    // could only come from markdown images at this point.
    //
    // It should be executed before all other renderer rules, because they
    // could add their own img tag (e.g. attachments rule adds thumbnails).
    //
    parser.bus.before('md2html.render', { priority: -100 }, function add_image_class(data) {
      data.ast.find('img').addClass('image');
    });

    parser.bus.after('md2html.render', function add_image_size(data) {
      data.ast.find('.image').each(function () {
        let width, height;
        let $img = $(this);

        // replace all dots with full-width dots due to mongodb restrictions
        let key = 'url:' + $img.attr('src').replace(/\./g, '．');
        let info = data.result.image_info[key] || (data.params.image_info || {})[key];

        if (info) {
          // set image width and height if available
          width = info.width;
          height = info.height;
          data.result.image_info[key] = info;
        } else {
          // schedule image size fetch
          data.result.image_info[key] = null;
        }

        let replacement = $(imgTpl({
          src:    $img.attr('src'),
          alt:    $img.attr('alt'),
          title:  $img.attr('title'),
          width,
          height
        }));

        $img.replaceWith(replacement);
      });
    });


    // Replace image tag to icon
    //
    parser.bus.on('html2preview.render', function replace_image_to_icon(data) {
      data.whitelist.push('span.icon.icon-picture');

      data.ast.find('img').replaceWith('<span class="icon icon-picture"></span>');
    });
  };
};
