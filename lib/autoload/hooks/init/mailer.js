// Creates N.mailer interface. Currently it allows to send email letters only.


'use strict';


const _          = require('lodash');
const os         = require('os');
const nodemailer = require('nodemailer');
const inspect    = require('util').inspect;
const thenify    = require('thenify');


// List of global settings used by the mailer.
var SETTINGS = [
  'email_transport',
  'email_header_from'
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
  N.wire.before('init:server.worker', function init_mailer() {
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
    let send = thenify.withCallback(function send(options, callback) {
      checkTransport(function (err) {
        if (err) {
          // Log transport init errors
          logger.error(`Mailer error: ${os.EOL}%s${os.EOL}%s`, inspect(err), inspect(options));
          callback(new Error('Mailer error: problem with sending email (init)'));
          return;
        }

        // Fill-in default letter options.
        options = _.assign({}, options, { from: settings.email_header_from });

        transport.sendMail(options, function (err) {
          if (err) {
            logger.error(`Mailer error: ${os.EOL}%s${os.EOL}%s`, inspect(err), inspect(options));
            callback(new Error('Mailer error: problem with sending email (process)'));
            return;
          }

          logger.debug('Mailer ok: ${os.EOL}%s', inspect(options));
          callback();
        });
      });
    });

    // Expose the public interface.
    N.mailer = { send };
  });
};
