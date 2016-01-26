// Register quote plugin and wrap urls+quotes
//

'use strict';


N.wire.once('init:parser', function quote_plugin_init() {
  N.parse.addPlugin(
    'quote',
    function quote_plugin_init(parser) {
      require('nodeca.core/lib/parser/plugins/quote')(N)(parser);

      parser.bus.on('render', function render_quote(data) {
        data.ast.find('msg-quote').each(function () {
          var $tag = $(this);
          var url  = $tag.data('nd-title');

          if (!N.router.match(url)) {
            return;
          }

          var result = data.params.rpc_cache.get('common.content.quote_wrap', { url });

          if (!result || !result.html) {
            return;
          }

          var replacement = $(result.html);

          replacement.children('.quote__content').append($tag.contents());
          $tag.replaceWith(replacement);
        });
      });
    }
  );
});
