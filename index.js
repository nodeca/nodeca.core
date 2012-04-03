"use strict";


/*global nodeca*/


// nodeca
var NLib = require('nlib');


module.exports = NLib.Application.create({
  root: __dirname,
  name: 'nodeca.core',
  bootstrap: function (nodeca, callback) {
    // empty bootstrap... for now..
    callback();
  }
});


nodeca.hooks.init.before('init-start',    require('./lib/init/redis'));
nodeca.hooks.init.before('init-start',    require('./lib/init/mongoose'));

nodeca.hooks.init.after('bundles',        require('./lib/init/assets_server'));

nodeca.hooks.init.after('init-complete',  require('./lib/init/migrations_check'));
nodeca.hooks.init.after('init-complete',  require('./lib/init/http_server'));
