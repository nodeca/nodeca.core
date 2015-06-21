// Medialinks support for parser
//

'use strict';

var async = require('async');
var $     = require('../cheequery');


module.exports = function (N, pluginConfig) {

  return function (parser) {
    parser.bus.on('render', function render_medialinks(data, callback) {
      var medialinker = N.medialinker(pluginConfig);

      async.eachSeries(data.ast.find('.link-auto'), function (item, next) {
        var tag = $(item);
        var type = 'inline';

        if ((tag.parent().prop('tagName') === 'P') && (tag.parent().contents().length === 1)) {
          type = 'block';
        }

        medialinker.render(tag.attr('href'), type, function (err, result) {
          if (err) {
            next(err);
            return;
          }

          if (!result) {
            next();
            return;
          }

          tag.replaceWith(result.html);
          next();
        });
      }, callback);
    });
  };
};
