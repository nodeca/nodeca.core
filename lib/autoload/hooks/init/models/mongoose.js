// Init mongoose connection


'use strict';


const mongoose = require('mongoose');


////////////////////////////////////////////////////////////////////////////////


module.exports = function (N) {

  N.wire.before('init:models', function mongoose_init(N) {
    var config = (N.config.database || {}).mongo;

    if (!config) throw 'No MongoDB configuration found';

    N.logger.info('Connecting to MongoDB');

    var options = {
      poolSize: 10,
      connectTimeoutMS: 30000,
      keepAlive: 1,

      // fix deprecation warnings appearing in mongodb driver,
      // see https://mongoosejs.com/docs/deprecations.html for details
      useNewUrlParser: true,
      useFindAndModify: false,
      useCreateIndex: true,
      useUnifiedTopology: true
    };

    return mongoose.connect(config, options)
      .then(function () {
        N.logger.info('MongoDB connected');
      });
  });
};
