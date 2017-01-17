// Init mongoose connection


'use strict';


const mongoose = require('mongoose');
const bluebird = require('bluebird');


mongoose.Promise = bluebird;

////////////////////////////////////////////////////////////////////////////////


module.exports = function (N) {

  N.wire.before('init:models', function mongoose_init(N) {
    var config = (N.config.database || {}).mongo;

    if (!config) throw 'No MongoDB configuration found';

    N.logger.info('Connecting to MongoDB');

    var options = {
      promiseLibrary: require('bluebird'),
      server: {
        poolSize: 10,
        socketOptions: {
          connectTimeoutMS: 30000,
          keepAlive: 1
        }
      },
      replset: {
        poolSize: 10,
        socketOptions: {
          connectTimeoutMS: 30000,
          keepAlive: 1
        }
      }
    };

    return mongoose.connect(config, options)
      .then(function () {
        N.logger.info('MongoDB connected');
      });
  });
};
