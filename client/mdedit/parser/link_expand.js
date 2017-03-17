'use strict';

N.wire.once('init:parser', function link_expand_plugin_init() {
  N.parser.addPlugin(
    'link_expand',
    function (parser) {
      parser.bus.on('ast2html', function expand_links(data) {
        if (!data.params.rpc_cache) return;

        data.ast.find('msg-link').each(function () {
          let $tag    = $(this);
          let url     = $tag.attr('href');
          let types   = data.params.options.link_to_title ? [ 'inline' ] : [];
          let is_auto = $tag.data('nd-auto');

          if (is_auto && ($tag.parent().prop('tagName') === 'P') && ($tag.parent().contents().length === 1)) {
            if (data.params.options.link_to_snippet) {
              // links inside blockquotes should only be expanded as inline,
              // here's an example where it matters:
              //
              // > http://dev.rcopen.com/forum/f1/topic234
              //
              if ($tag.closest('msg-quote').length === 0) {
                types.unshift('block');
              }
            }
          }

          let result = data.params.rpc_cache.get('common.embed', { url, types });

          // Switch url destination if it's been unshortened
          if (result && result.canonical) {
            $tag.attr('href', result.canonical);
          }

          if (!result || !result.html) return;

          let replacement = $(result.html);

          replacement.attr('data-nd-orig', url);

          if (is_auto) {
            if (result.type === 'block') {
              // if result is a block, replace parent `P` tag
              $tag.parent().replaceWith(replacement);
            } else {
              // otherwise replace `A` tag itself
              $tag.replaceWith(replacement);
            }
          }
        });
      });
    },
    true
  );
});
