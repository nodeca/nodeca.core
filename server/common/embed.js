// Fetch content by link for embedding
//
// Params:
//
// - url   (String)   - link to content
// - types ([String]) - suitable format list, in priority order ('block', 'inline')
//
// Out:
//
// - html  (String)  - rendered template
// - type  (String)  - format type
// - local (Boolean) - is the link local or external (local ones will need permission checks later)
//
'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    url:   { type: 'string', required: true },
    types: {
      type: 'array',
      required: true,
      uniqueItems: true,
      items: {
        type: 'string',
        'enum': [ 'block', 'inline' ]
      }
    }
  });


  function check_access(data, env, callback) {
    if (!data.local) {
      // don't check permissions for external links
      // (not a big deal, just a micro-optimization here)
      callback(null, true);
      return;
    }

    N.wire.emit('internal:common.access', env, function (err) {
      if (err) {
        callback(err);
        return;
      }

      callback(null, env.data.access_read);
    });
  }


  N.wire.on(apiPath, function embed(env, callback) {
    if (env.user_info.is_guest) {
      callback(N.io.FORBIDDEN);
      return;
    }

    var data = {
      url:   env.params.url,
      types: env.params.types
    };

    N.wire.emit('internal:common.embed', data, function (err) {
      if (err) {
        callback(err);
        return;
      }

      check_access(data, env, function (err, allowed) {
        if (err) {
          callback(err);
          return;
        }

        // unshortened urls
        env.res.canonical = data.canonical;

        if (allowed) {
          env.res.html = data.html;
          env.res.type = data.type;
        }

        callback();
      });
    });
  });
};
