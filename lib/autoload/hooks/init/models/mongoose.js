// Init mongoose connection


'use strict';


const mongoose = require('mongoose');


////////////////////////////////////////////////////////////////////////////////


module.exports = function (N) {

  N.wire.before('init:models', async function mongoose_init(N) {
    var config = N.config.database?.mongo;

    if (!config) throw 'No MongoDB configuration found';

    N.logger.info('Connecting to MongoDB');

    var options = {
      connectTimeoutMS: 30000
    };

    await mongoose.connect(config, options);
    N.logger.info('MongoDB connected');
  });
};
