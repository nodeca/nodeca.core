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


  N.wire.on(apiPath, async function embed(env) {
    if (!env.user_info.is_member) throw N.io.FORBIDDEN;

    let data = {
      url:   env.params.url,
      types: env.params.types
    };

    await N.wire.emit('internal:common.embed', data);

    // Check permissions for local links
    //
    if (data.local) {
      let access_env = { params: { url: env.params.url, user_info: env.user_info } };

      await N.wire.emit('internal:common.access', access_env);

      if (!access_env.data.access_read) return;
    }

    // unshortened urls
    env.res.canonical = data.canonical;

    env.res.html = data.html;
    env.res.type = data.type;
  });
};
