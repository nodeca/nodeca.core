'use strict';

N.wire.once('init:parser', function attachment_plugin_init() {
  N.parse.addPlugin(
    'attachment',
    require('nodeca.core/lib/parser/plugins/attachment')(N, {
      types: '$$ JSON.stringify(N.models.users.MediaInfo.types) $$',
      sizes: '$$ JSON.stringify(N.config.users.uploads.resize) $$'
    })
  );
});
