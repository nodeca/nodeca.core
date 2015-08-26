// Get attachment attributes
//

'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    id: { format: 'mongo', required: true }
  });


  N.wire.on(apiPath, function get_attachment(env, callback) {
    var data = {
      id: env.params.id
    };

    N.wire.emit('internal:common.content.attachment', data, function (err) {
      if (err) {
        callback(err);
        return;
      }

      env.res.type      = data.type;
      env.res.file_name = data.file_name;

      callback();
    });
  });
};
