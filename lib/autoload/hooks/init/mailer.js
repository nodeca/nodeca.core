// Creates N.mailer interface. Currently it allows to send email letters only.


'use strict';


const _          = require('lodash');
const os         = require('os');
const nodemailer = require('nodemailer');
const inspect    = require('util').inspect;
const co         = require('co');


// List of global settings used by the mailer.
var SETTINGS = [
  'email_transport',
  'email_header_from'
];


// Map of available internal transport types to NodeMailer transport engines.
var TRANSPORTS = {
  sendmail() {
    return require('nodemailer-sendmail-transport')();
  },
  dummy() {
    return require('nodemailer-stub-transport')();
  }
};


module.exports = function (N) {
  N.wire.before('init:server.worker-http', function init_mailer() {
    var settings, transport, logger;

    // Initialize or update mailer context if email transport setting was changed.
    //
    function checkTransport() {
      return N.settings.get(SETTINGS, {})
        .then(fetched => {
          if (!_.has(TRANSPORTS, fetched.email_transport)) {
            throw `Unknown email transport "${fetched.email_transport}"`;
          }

          // Reinitialize if any of email settings was changed.
          if (!_.isEqual(settings, fetched)) {
            settings  = fetched;

            transport = nodemailer.createTransport(TRANSPORTS[settings.email_transport]());
            logger    = N.logger.getLogger('system@mailer.' + settings.email_transport);
          }
        });
    }

    // Add a letter to the mailer's queue and call back when that's actually sent.
    //
    let send = co.wrap(function* (options) {
      try {
        yield checkTransport();
      } catch (err) {
        // Log transport init errors
        logger.error(`Mailer error: ${os.EOL}%s${os.EOL}%s`, inspect(err), inspect(options));
        throw new Error('Mailer error: problem with sending email (init)');
      }

      // Fill-in default letter options.
      options = _.assign({}, options, { from: settings.email_header_from });

      try {
        yield new Promise((resolve, reject) => {
          transport.sendMail(options, err => {
            if (err) reject (err);
            else resolve();
          });
        });
      } catch (err) {
        logger.error(`Mailer error: ${os.EOL}%s${os.EOL}%s`, inspect(err), inspect(options));
        throw new Error('Mailer error: problem with sending email (process)');
      }

      logger.debug('Mailer ok: ${os.EOL}%s', inspect(options));
    });

    // Expose the public interface.
    N.mailer = { send };
  });
};
