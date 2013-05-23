// Creates N.mailer interface. Currently it allows to send email letters only.


'use strict';


var _          = require('lodash');
var os         = require('os');
var nodemailer = require('nodemailer');


// Map of available internal transport types to NodeMailer transport engines.
//
var TRANSPORTS = {
  sendmail: 'SENDMAIL'
, dummy:    'STUB'
};


// Abstract interface over the underlying mailer library.
//
function createMailer(N) {
  var type, transport, logger, defaultOptions;


  // Initialize or update mailer context if email transport setting was changed.
  //
  function prepare(callback) {
    N.settings.get(['email_transport', 'email_header_from'], {}, function (err, settings) {
      if (err) {
        callback(err);
        return;
      }

      if (!_.has(TRANSPORTS, settings.email_transport)) {
        callback('Unable to initialize N.mailer; ' +
                 'Unregistered email transport: "' + settings.email_transport + '"');
        return;
      }

      // Reinitialize if transport type was changed.
      if (settings.email_transport !== type) {
        type           = settings.email_transport;
        transport      = nodemailer.createTransport(TRANSPORTS[type]);
        logger         = N.logger.getLogger('system@mailer.' + type);
        defaultOptions = { from: settings.email_header_from };
      }

      callback();
    });
  }


  // Add a letter to the mailer's queue and call back when that's actually sent.
  //
  function send(options, callback) {
    prepare(function (err) {
      if (err) {
        callback(err);
        return;
      }

      // Fill-in default letter options.
      options = _.extend({}, options, defaultOptions);

      transport.sendMail(options, function (err, result) {
        if (err) {
          logger.error("Mailer transport error, can't send letter to %j", options.to);
          callback(err);
          return;
        }

        logger.info('Sent a letter to %s', result.envelope.to.join(', '));
        logger.debug('Sent a letter with content:%s%s', os.EOL, result.message);
        callback();
      });
    });
  }


  return { prepare: prepare, send: send };
}


module.exports = function (N) {
  N.wire.before('init:server', function init_mailer(__, callback) {
    N.mailer = createMailer(N);
    N.mailer.prepare(callback);
  });
};
