'use strict';

N.wire.once('init:parser', function medialink_plugin_init() {
  N.parse.addPlugin(
    'medialink',
    function (parser) {
      parser.bus.on('render', function render_medialinks(data) {
        if (!data.params.rpc_cache) {
          return;
        }

        if (!data.params.options.link_to_title && !data.params.options.link_to_snippet) {
          return;
        }

        data.ast.find('msg-link[data-nd-auto]').each(function () {
          var $tag  = $(this);
          var url   = $tag.attr('href');
          var types = data.params.options.link_to_title ? [ 'inline' ] : [];

          if (($tag.parent().prop('tagName') === 'P') && ($tag.parent().contents().length === 1)) {
            if (data.params.options.link_to_snippet) {
              types.unshift('block');
            }
          }

          if (!types.length) {
            return;
          }

          var result = data.params.rpc_cache.get('common.embed', { url: url, types: types });

          // Switch url destination if it's been unshortened
          if (result && result.canonical) {
            $tag.attr('href', result.canonical);
          }

          if (!result || !result.html) {
            return;
          }

          if (data.type === 'block') {
            // if result is a block, replace parent `P` tag
            $tag.parent().replaceWith(result.html);
          } else {
            // otherwise replace `A` tag itself
            $tag.replaceWith(result.html);
          }
        });
      });
    }
  );
});
