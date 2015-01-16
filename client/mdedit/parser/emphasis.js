'use strict';

N.wire.once('init:parser', function emphasis_plugin_init() {
  N.parse.addPlugin(
    'emphasis',
    require('nodeca.core/lib/parser/plugins/emphasis')(N)
  );
});
