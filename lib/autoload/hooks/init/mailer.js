// Creates N.mailer interface. Currently it allows to send email letters only.
//
'use strict';


const _          = require('lodash');
const os         = require('os');
const nodemailer = require('nodemailer');
const inspect    = require('util').inspect;
const url        = require('url');


// Map of available internal transport types to NodeMailer transport engines
//
const TRANSPORTS = {
  sendmail: { sendmail: true },
  dummy:    { streamTransport: true, buffer: true }
};


// Available build in NodeMailer protocols
//
const PROTOCOLS = [
  'direct:',
  'smtps:',
  'smtp:'
];


module.exports = function (N) {
  N.wire.after('init:models', function init_mailer() {
    let transport;
    let dummyLogger = N.logger.getLogger('mailer.dummy');


    // Initialize mailer context
    //
    if (TRANSPORTS[N.config.email.transport]) {
      transport = nodemailer.createTransport(TRANSPORTS[N.config.email.transport]);

    } else if (PROTOCOLS.indexOf(url.parse(N.config.email.transport || '').protocol)) {
      transport = nodemailer.createTransport(N.config.email.transport);

    } else {
      throw `Unknown email transport "${N.config.email.transport}"`;
    }


    // Add a letter to the mailer's queue and call back when that's actually sent.
    //
    // - from (String) - email sender address (defaults to N.config.email.from)
    // - to (String) - email receiver address
    // - subject (String) - email subject
    // - text|html (String) - email text (plain text or html)
    // - safe_error (Boolean) - optional. Set true to protect sencitive info leak to client via error messages.
    // For example, if you send tokens. Now this option remove email body from error text. Default `false`
    //
    function send(options) {
      // Fill-in default letter options.
      let opts = _.assign({ from: N.config.email.from }, options);

      return transport.sendMail(opts)
        .then(info => {
          if (N.config.email.transport === 'dummy') {
            dummyLogger.info(`Mailer:${os.EOL}${info.message.toString()}`);
          }
        })
        .catch(err => {
          if (opts.safe_error) {
            opts = _.omit(opts, [ 'text', 'html' ]);
          }
          throw new Error(`Mailer error: ${os.EOL}${inspect(err)}${os.EOL}${inspect(opts)}`);
        });
    }


    // Expose the public interface.
    //
    N.mailer = { send };
  });
};
