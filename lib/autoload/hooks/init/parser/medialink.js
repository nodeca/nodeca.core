'use strict';


var async = require('async');
var $     = require('nodeca.core/lib/parser/cheequery');


module.exports = function (N) {

  N.wire.once('init:parser', function medialink_plugin_init() {
    N.parse.addPlugin(
      'medialink',
      function (parser) {
        parser.bus.on('render', function render_medialinks(data, callback) {
          async.each(data.ast.find('.link[data-nd-auto]'), function (item, next) {
            var $tag = $(item);
            var data = { link: $tag.attr('href'), type: [ 'inline' ] };

            if (($tag.parent().prop('tagName') === 'P') && ($tag.parent().contents().length === 1)) {
              data.type.unshift('block');
            }

            N.wire.emit('internal:common.embed.ext', data, function (err) {
              // If any errors happen, ignore them and leave the link as is
              if (err) {
                next();
                return;
              }

              // If no result is returned, leave the link as is
              if (!data.html) {
                next();
                return;
              }

              // If block result - replace parent tag `P`
              if (data.type === 'block') {
                $tag.parent().replaceWith(data.html);

              // For inline result - just replace tag `A`
              } else {
                $tag.replaceWith(data.html);
              }

              next();
            });
          }, callback);
        });
      }
    );
  });
};
