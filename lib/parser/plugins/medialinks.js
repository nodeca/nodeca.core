// Medialinks support for parser
//

'use strict';

var async = require('async');
var $     = require('../cheequery');


module.exports = function (N, pluginConfig) {

  return function (parser) {
    parser.bus.on('render', function (data, callback) {
      var medialinker = N.medialinker(pluginConfig);

      async.eachSeries(data.ast.find('a'), function (item, next) {
        var tag = $(item);

        medialinker.render(tag.attr('href'), function (err, result) {
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
