//= require vendor/jquery/jquery
//= require vendor/history.js/scripts/uncompressed/history.adapter.jquery
//= require vendor/history.js/scripts/uncompressed/history
//= require frontend/bootstrap_custom/bootstrap
//= require vendor/jquery-ui/ui/jquery.ui.core
//= require vendor/jquery-ui/ui/jquery.ui.widget
//= require vendor/jquery-ui/ui/jquery.ui.mouse
//= require vendor/jquery-ui/ui/jquery.ui.position
//= require vendor/jquery-ui/ui/jquery.ui.draggable
//= require vendor/jquery-ui/ui/jquery.ui.droppable
//= require vendor/jquery-ui/ui/jquery.ui.menu
//= require vendor/jquery-ui/ui/jquery.ui.autocomplete
//= require vendor/typeahead.js/dist/typeahead
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
