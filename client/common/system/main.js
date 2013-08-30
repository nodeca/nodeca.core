//= require vendor/jquery/jquery
//= require vendor/history.js/scripts/uncompressed/history.adapter.jquery
//= require vendor/history.js/scripts/uncompressed/history
//= require vendor/powertip/jquery.powertip
//= require frontend/bootstrap_custom/bootstrap
//= require_self
//= require client


window.NodecaLoader.execute(function (N, require) {
  'use strict';

  // Initialize client N.
  //
  // NOTE: We have to use this `init` variable here because our `require` parser
  // ignores expressions like require('something')(arg)
  var init = require('nodeca.core/lib/system/client/n.js.ejs');

  init(N);
});
