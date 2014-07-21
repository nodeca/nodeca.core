// Init mongoose connection


'use strict';


var mongoose = require('mongoose');


////////////////////////////////////////////////////////////////////////////////


module.exports = function (N) {

  N.wire.before('init:models', function mongoose_init(N, callback) {
    var config = (N.config.database || {}).mongo;

    if (!config) {
      callback('No MongoDB configuration found');
      return;
    }

    N.logger.info('Connecting to MongoDB');

    var options = {
      server  : {
        socketOptions: { keepAlive: 1 }
      },
      replset : {
        socketOptions: { keepAlive: 1 }
      }
    };

    mongoose.connect(config, options, function (err) {
      if (err) {
        callback('MongoDB error: ' + String(err.message || err));
        return;
      }

      N.logger.info('MongoDB connected');
      callback();
    });
  });
};
