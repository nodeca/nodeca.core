'use strict';

module.exports = function (N) {

  N.wire.once('init:parser', function attachment_plugin_init() {
    N.parse.addPlugin(
      'attachment',
      require('nodeca.core/lib/parser/plugins/attachment')(N, {
        types: N.models.users.MediaInfo.types,
        sizes: N.config.users.uploads.resize
      })
    );
  });
};
