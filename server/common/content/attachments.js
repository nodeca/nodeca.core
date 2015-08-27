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


  N.wire.on(apiPath, function get_attachments(env, callback) {
    var data = {
      ids: env.params.ids
    };

    N.wire.emit('internal:common.content.attachments', data, function (err) {
      if (err) {
        callback(err);
        return;
      }

      env.res.attachments = data.attachments;

      callback();
    });
  });
};
