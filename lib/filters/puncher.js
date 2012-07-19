"use strict";


/*global nodeca*/


////////////////////////////////////////////////////////////////////////////////


// Middleware that marks start of the request
//
nodeca.filters.before('', {weight: -9000}, function mark_puncher_start(params, callback) {
  this.extras.puncher.start('Total', {'transport': this.request.origin, 'request params': params});
  callback();
});


function inject_stats(env) {
  var resp      = env.response,
      viewsTree = nodeca.runtime.views[env.session.locale][env.session.theme];

  resp.body = resp.body.replace(
    '<!--{{PUNCHER_STATS}}-->',
    nodeca.shared.common.render(viewsTree, 'widgets.debug_timeline', false, resp.data));
}


// Middleware that embeds puncher results
//
nodeca.filters.after('', {weight: 9000}, function finish_puncher(params, callback) {
  if (!this.extras.puncher.stop().stopped) {
    callback(new Error("Some of puncher scopes were not closed"));
    return;
  }

  this.response.data.widgets.puncher_stats = this.extras.puncher.result;

  if (this.origin.http) {
    inject_stats(this);
  }

  callback();
});
