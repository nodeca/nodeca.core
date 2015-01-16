'use strict';

module.exports = function (N) {

  N.wire.once('init:parser', function medialinks_plugin_init() {
    N.parse.addPlugin(
      'attachments',
      require('nodeca.core/lib/parser/plugins/attachments')(N)
    );
  });
};
