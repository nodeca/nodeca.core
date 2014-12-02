// Creates N.mailer interface. Currently it allows to send email letters only.


'use strict';


var _          = require('lodash');
var os         = require('os');
var nodemailer = require('nodemailer');
var util       = require('util');


// List of global settings used by the mailer.
var SETTINGS = [
  'email_transport'
, 'email_header_from'
];


// Map of available internal transport types to NodeMailer transport engines.
var TRANSPORTS = {
  sendmail: function () {
    return require('nodemailer-sendmail-transport')();
  },
  dummy: function () {
    return require('nodemailer-stub-transport')();
  }
};


module.exports = function (N) {
  N.wire.before('init:server', function init_mailer() {
    var settings, transport, logger;

    // Initialize or update mailer context if email transport setting was changed.
    //
    function checkTransport(callback) {
      N.settings.get(SETTINGS, {}, function (err, fetched) {
        if (err) {
          callback(err);
          return;
        }

        if (!_.has(TRANSPORTS, fetched.email_transport)) {
          callback('Unknown email transport "' + fetched.email_transport + '"');
          return;
        }

        // Reinitialize if any of email settings was changed.
        if (!_.isEqual(settings, fetched)) {
          settings  = fetched;

          transport = nodemailer.createTransport(TRANSPORTS[settings.email_transport]());
          logger    = N.logger.getLogger('system@mailer.' + settings.email_transport);
        }

        callback();
      });
    }

    // Add a letter to the mailer's queue and call back when that's actually sent.
    //
    function send(options, callback) {
      checkTransport(function (err) {
        if (err) {
          callback(err);
          return;
        }

        // Fill-in default letter options.
        options = _.assign({}, options, { from: settings.email_header_from });

        transport.sendMail(options, function (err, info) {
          if (err) {
            logger.error('Mailer error: %s%s%s%s', os.EOL, util.inspect(err), os.EOL, util.inspect(options));
            callback(err);
            return;
          }

          logger.debug('Mailer ok: %s%s', os.EOL, util.inspect(options));
          callback();
        });
      });
    }

    // Expose the public interface.
    N.mailer = { send: send };
  });
};
