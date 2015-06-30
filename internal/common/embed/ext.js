// Fetch content by link for embedding
//
// Data:
//
// - link (String) - link to content
// - type ([String]) - suitable format list, in priority order ('block', 'inline')
//
// Out:
//
// - html (String) - rendered template
// - type (String) - format type
//
'use strict';


var async = require('async');


module.exports = function (N, apiPath) {
  N.wire.on(apiPath, function embed_ext(data, callback) {
    var medialinker = N.medialinker(N.config.parser.medialinks);

    async.eachSeries(data.type, function (type, next) {
      // Requested template already rendered - skip
      if (data.html) {
        next();
        return;
      }

      // TODO: replace medialinker
      medialinker.render(data.link, type, function (err, result) {
        if (err) {
          next(err);
          return;
        }

        if (!result) {
          next();
          return;
        }

        data.html = result.html;
        data.type = type;

        next();
      });
    }, callback);
  });
};
