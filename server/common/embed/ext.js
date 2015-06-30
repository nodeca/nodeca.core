// Fetch content by link for embedding
//
// Params:
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


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    link: { type: 'string', required: true },
    type: {
      type: 'array',
      required: true,
      uniqueItems: true,
      minItems: 1,
      items: { type: 'string' }
    }
  });


  N.wire.on(apiPath, function embed_ext(env, callback) {
    if (env.user_info.is_guest) {
      callback(N.io.FORBIDDEN);
      return;
    }

    var data = {
      link: env.params.link,
      type: env.params.type
    };

    // Subcall
    N.wire.emit('internal:common.embed.ext', data, function (err) {
      if (err) {
        callback(err);
        return;
      }

      env.res.html = data.html;
      env.res.type = data.type;
      callback();
    });
  });
};
