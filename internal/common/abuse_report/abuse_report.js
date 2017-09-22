// Send abuse report
//
// Will be extended by specific handler (by report.type). Handler should
// fill `recipients`, `locals`, and templates for deliver chain.
//
// - `internal:common.abuse_report.forum_post` for `FORUM_POST`
//
// Deliver handlers:
//
// - send via email
// - log to special forum section
//
// Params:
//
// - report - N.models.core.AbuseReport
// - recipients - { user_id: user_info }
// - locals - rendering data
//   - src_url
//   - src_text
//   - report_text
//   - author - user_info
//   - project_name
//   - recipients
//   - report_topic_url
//
'use strict';


module.exports = function (N, apiPath) {

  // Save report
  //
  N.wire.before(apiPath, async function save_report(params) {
    await params.report.save();
  });


  // Deliver
  //
  N.wire.after(apiPath, async function deliver(params) {
    await N.wire.emit('internal:common.abuse_report.deliver', params);
  });
};
