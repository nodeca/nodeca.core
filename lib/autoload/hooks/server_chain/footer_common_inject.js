// Add footer elements (About, Contacts, etc.);
// required in layout for http requests only
//

'use strict';


module.exports = function (N) {

  // don't inject footer to admin panel pages
  N.wire.skip('server_chain:http:admin.*', 'footer_common_inject');


  N.wire.after('server_chain:http:*', { priority: 80 }, function footer_common_inject(env) {
    env.runtime.footer = N.config.menus.common.footer;
  });
};
