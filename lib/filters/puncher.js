"use strict";


/*global nodeca*/


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


// Middleware that embeds puncher results
//
nodeca.filters.after('', { weight: 90 }, function finish_puncher(params, callback) {
  var resp, viewsTree;

  if (!this.extras.puncher.stop().stopped) {
    callback(new Error("Some of puncher scopes were not closed"));
    return;
  }

  this.response.data.widgets.puncher_stats = this.extras.puncher.result;

  if (this.origin.http && this.response && this.response.body) {
    resp      = this.response;
    viewsTree = nodeca.runtime.views[this.runtime.locale][this.runtime.theme];

    // inject puncher stats
    resp.body = resp.body.replace(
      '<!--{{PUNCHER_STATS}}-->',
      nodeca.shared.render(
        viewsTree,
        'common.widgets.debug_timeline',
        resp.data
      )
    );
  }

  callback();
});
