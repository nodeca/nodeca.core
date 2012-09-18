"use strict";


/*global nodeca*/


////////////////////////////////////////////////////////////////////////////////


var defaultSession = { locale: nodeca.config.locales['default'], theme: 'default' };


////////////////////////////////////////////////////////////////////////////////


// Middleware that marks start of the request
//
nodeca.filters.before('', { weight: -90 }, function start_puncher(params, callback) {
  this.extras.puncher.start('Total', {
    'transport': this.request.origin,
    'request params': params
  });
  callback();
});


function inject_stats(env) {
  var resp      = env.response,
      sess      = env.session || defaultSession,
      viewsTree = nodeca.runtime.views[sess.locale][sess.theme];

  resp.body = resp.body.replace(
    '<!--{{PUNCHER_STATS}}-->',
    nodeca.shared.common.render(viewsTree, 'common.widgets.debug_timeline', resp.data));
}


// Middleware that embeds puncher results
//
nodeca.filters.after('', { weight: 90 }, function finish_puncher(params, callback) {
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
