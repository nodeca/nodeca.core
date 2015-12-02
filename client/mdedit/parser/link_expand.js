'use strict';

N.wire.once('init:parser', function link_expand_plugin_init() {
  N.parse.addPlugin(
    'link_expand',
    function (parser) {
      parser.bus.on('render', function expand_links(data) {
        if (!data.params.rpc_cache) {
          return;
        }

        data.ast.find('msg-link[data-nd-auto]').each(function () {
          var $tag  = $(this);
          var url   = $tag.attr('href');
          var types = data.params.options.link_to_title !== false ? [ 'inline' ] : [];

          if (($tag.parent().prop('tagName') === 'P') && ($tag.parent().contents().length === 1)) {
            if (data.params.options.link_to_snippet !== false) {
              types.unshift('block');
            }
          }

          var result = data.params.rpc_cache.get('common.embed', { url: url, types: types });

          // Switch url destination if it's been unshortened
          if (result && result.canonical) {
            $tag.attr('href', result.canonical);
          }

          if (!result || !result.html) {
            return;
          }

          var replacement = $(result.html);

          replacement.attr('data-nd-orig', url);

          if (result.type === 'block') {
            // if result is a block, replace parent `P` tag
            $tag.parent().replaceWith(replacement);
          } else {
            // otherwise replace `A` tag itself
            $tag.replaceWith(replacement);
          }
        });
      });
    }
  );
});
