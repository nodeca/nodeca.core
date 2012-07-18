"use strict";


/*global nodeca*/


////////////////////////////////////////////////////////////////////////////////


// Middleware that marks start of the request
//
nodeca.filters.before('', {weight: -800}, function mark_puncher_start(params, callback) {
  this.extras.puncher.start('Request', params);
  callback();
});


// Middleware that embeds puncher results
//
nodeca.filters.after('', {weight: 800}, function finish_puncher(params, callback) {
  if (!this.extras.puncher.stop().stopped()) {
    callback(new Error("Some of puncher scopes were not closed"));
    return;
  }

  this.response.data.widgets.puncher_stats = this.extras.puncher.result();
  callback();
});
