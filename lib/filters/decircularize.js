"use strict";


/**
 *  filters
 **/


/*global nodeca*/


////////////////////////////////////////////////////////////////////////////////


// disabled. and will be removed soon
if (0 === 0) {
  return;
}


////////////////////////////////////////////////////////////////////////////////


// stdlib
var traverse = require('traverse');


////////////////////////////////////////////////////////////////////////////////


/**
 *  filters.decircularize(params, next) -> Void
 *
 *  - **chain**: after `<ALL>`
 *  - **weight**: 9999
 *
 *  Middleware that removes (and notifies about) circular references in
 *  `env.response` object and needed for realtime protocol only.
 *
 *  **WARNING** This middleware is a performance killer, thus it's enabled ONLY
 *  on `development` environment.
 **/
nodeca.filters.after('', {weight: 9999}, function base_assets(params, callback) {
  var found = [];

  if (!this.origin.realtime) {
    // process realtime requests only
    callback(null);
    return;
  }

  traverse(this.response).forEach(function () {
    if (this.circular) {
      found.push(
        "  ╭╴ env.response." + this.path.join('.') + '\n' +
        "  ╰► env.response." + this.circular.path.join('.')
      );
    }
  });


  if (found.length) {
    this.response = JSON.parse(JSON.stringify(this.response));
    nodeca.logger.error('Circular references found (showing first ' +
                        Math.min(10, found.length) + ' of ' + found.length +
                        '):\n\n' +
                        found.slice(0, 10).join('\n\n'));
  }

  callback();
});
