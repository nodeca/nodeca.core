// Send abuse report via email
//
// Params:
//
// - report - N.models.core.AbuseReport
// - recipients - { user_id: user_info }
// - locals - rendering data
// - email_templates - { body, subject } - i18n path
//
//
'use strict';


const _       = require('lodash');
const encode  = require('emailjs-mime-codec').mimeWordEncode;
const render  = require('nodeca.core/lib/system/render/common');


module.exports = function (N) {

  // Send abuse report via email
  //
  N.wire.on('internal:common.abuse_report.deliver', async function send_via_email(params) {
    if (!params.email_templates) {
      let type_name = _.invert(_.get(N, 'shared.content_type', {}))[params.report.type];

      N.logger.warn(`Abuse report (${type_name}): email templates not specified`);
      return;
    }

    // Fetch users emails
    let users_email = await N.models.users.User.find()
                                .where('_id').in(Object.keys(params.recipients))
                                .select('_id email')
                                .lean(true);

    let emails = users_email.reduce((acc, user) => {
      acc[user._id] = user.email;
      return acc;
    }, {});

    await Promise.all(_.values(params.recipients).map(async user_info => {
      let to = emails[user_info.user_id];

      if (!to) return; // continue

      let locale = user_info.locale || N.config.locales[0];
      let helpers = {};

      helpers.t = (phrase, params) => N.i18n.t(locale, phrase, params);
      helpers.t.exists = phrase => N.i18n.hasPhrase(locale, phrase);
      helpers.link_to = (name, params) => N.router.linkTo(name, params) || '#';

      // fetch nick separately because user_info doesn't contain it
      let { nick } = await N.models.users.User.findById(params.locals.author.user_id);

      let from = `"${encode(nick)} @ ${encode(params.locals.project_name)}" <${N.config.email.from}>`;

      let subject = render(N, params.email_templates.subject, params.locals, helpers);
      let body = render(N, params.email_templates.body, params.locals, helpers);

      return N.mailer.send({ from, to, subject, html: body })
        .catch(err => {
          // don't return an error here
          N.logger.error('Cannot send email to %s: %s', to, err.message || err);
        });
    }));
  });
};
