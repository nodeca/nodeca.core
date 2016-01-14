// Get attachment attributes
//

'use strict';

// Max attachments to fetch
var LIMIT = 500;


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    ids: {
      type: 'array',
      required: true,
      uniqueItems: true,
      maxItems: LIMIT,
      items: { format: 'mongo', required: true }
    }
  });


  N.wire.on(apiPath, function* get_attachments(env) {
    var data = {
      ids: env.params.ids
    };

    yield N.wire.emit('internal:common.content.attachments', data);

    env.res.attachments = data.attachments;
  });
};
