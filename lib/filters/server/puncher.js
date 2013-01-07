"use strict";


/*global N*/


////////////////////////////////////////////////////////////////////////////////


// Middleware that marks start of the request
//
N.filters.before('', { weight: -90 }, function start_puncher(params, callback) {
  this.extras.puncher.start('Total', {
    'transport': this.request.origin,
    'request params': params
  });
  callback();
});


// Middleware that embeds puncher results
//
N.filters.after('', { weight: 90 }, function finish_puncher(params, callback) {
  if (!this.extras.puncher.stop().stopped) {
    callback(new Error("Some of puncher scopes were not closed"));
    return;
  }

  this.response.data.widgets.puncher_stats = this.extras.puncher.result;

  if (this.origin.http && this.response && this.response.body) {
    // inject puncher stats
    this.response.body = this.response.body.replace('<!--{{PUNCHER_STATS}}-->',
      this.render('common.widgets.debug_timeline', this.response.data));
  }

  callback();
});
