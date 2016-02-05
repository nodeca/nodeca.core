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
  sendmail() {
    return require('nodemailer-sendmail-transport')();
  },
  dummy() {
    return require('nodemailer-stub-transport')();
  }
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
      let transporter = TRANSPORTS[N.config.email.transport]();

      if (N.config.email.transport === 'dummy') {
        transporter.on('log', data => {
          if (data.type === 'message') {
            dummyLogger.info(`Mailer:${os.EOL}${data.message}`);
          }
        });
      }

      transport = nodemailer.createTransport(transporter);

    } else if (PROTOCOLS.indexOf(url.parse(N.config.email.transport || '').protocol)) {
      transport = nodemailer.createTransport(N.config.email.transport);

    } else {
      throw `Unknown email transport "${N.config.email.transport}"`;
    }


    // Add a letter to the mailer's queue and call back when that's actually sent.
    //
    function send(options) {
      // Fill-in default letter options.
      options = _.assign({}, options, { from: N.config.email.from });

      return new Promise((resolve, reject) => {
        transport.sendMail(options, err => {
          if (err) reject (err);
          else resolve();
        });
      }).catch(err => {
        throw new Error(`Mailer error: ${os.EOL}${inspect(err)}${os.EOL}${inspect(options)}`);
      });
    }


    // Expose the public interface.
    //
    N.mailer = { send };
  });
};
