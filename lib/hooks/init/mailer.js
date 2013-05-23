// Creates N.mailer interface. Currently it allows to send email letters only.
//
// NOTE: Mailer is initialized on startup only. If you updated email settings,
// you should restart Nodeca to take effect.


'use strict';


var _          = require('lodash');
var nodemailer = require('nodemailer');


// Map of available transport types (from NodeMailer) and log names.
//
var TRANSPORTS = {
  SENDMAIL: 'system@mailer.sendmail'
, STUB:     'system@mailer.dummy'
};


// Abstract interface over the underlying mailer library.
//
function Mailer(N, transport, defaultOptions) {
  this.logger         = N.logger.getLogger(TRANSPORTS[transport]);
  this.transport      = nodemailer.createTransport(transport);
  this.defaultOptions = defaultOptions || {};
}

// Add a letter to the mailer's queue and call back when that's actually sent.
//
Mailer.prototype.send = function send(options, callback) {
  var self = this;

  options = _.defaults(_.clone(options), this.defaultOptions);

  this.transport.sendMail(options, function (err, result) {
    if (err) {
      self.logger.error('Failed to send a letter: ', err);
      callback(err);
      return;
    }

    self.logger.info('Sent a letter to address %j', result.envelope.to);
    self.logger.debug('Sent a letter: %j', result.message);
    callback();
  });
};


module.exports = function (N) {

  N.wire.after('init:__settings', function init_mailer(__, callback) {

    N.settings.get(['email_transport', 'email_header_from'], {}, function (err, settings) {
      if (err) {
        callback(err);
        return;
      }

      var transport = settings.email_transport
        , from      = settings.email_header_from;

      if (!_.has(TRANSPORTS, transport)) {
        callback('Unable to initialize N.mailer; ' +
                 'Unregistered E-mail transport: "' + transport + '"');
        return;
      }

      N.mailer = new Mailer(N, transport, { from: from });
      callback();
    });

  });
};
