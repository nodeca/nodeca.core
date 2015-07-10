'use strict';

N.wire.once('init:parser', function medialink_plugin_init() {
  N.parse.addPlugin(
    'medialink',
    function (parser) {
      parser.bus.on('render', function render_medialinks(data) {
        if (!data.params.rpc_cache) {
          return;
        }

        data.ast.find('msg-link[data-nd-auto]').each(function () {
          var $tag = $(this);
          var type = [ 'inline' ];

          if (($tag.parent().prop('tagName') === 'P') && ($tag.parent().contents().length === 1)) {
            type.unshift('block');
          }

          var result = data.params.rpc_cache.get('common.embed.ext', { link: $tag.attr('href'), type: type });

          if (!result || !result.html) {
            return;
          }

          // If block result - replace parent tag `P`
          if (result.type === 'block') {
            $tag.parent().replaceWith(result.html);

          // For inline result - just replace tag `A`
          } else {
            $tag.replaceWith(result.html);
          }
        });
      });
    }
  );
});
