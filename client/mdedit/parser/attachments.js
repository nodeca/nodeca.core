'use strict';

N.wire.once('init:parser', function attachments_plugin_init() {
  N.parse.addPlugin(
    'attachments',
    require('nodeca.core/lib/parser/plugins/attachments')(N, {
      types: '$$ JSON.stringify(N.models.users.MediaInfo.types) $$',
      sizes: '$$ JSON.stringify(N.config.users.uploads.resize) $$'
    })
  );
});
