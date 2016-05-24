// Replace block links with previews of the objects they link to,
// and inline links with the titles of those objects.
//

'use strict';

const $     = require('nodeca.core/lib/parser/cheequery');

// limit the amount of the embedded links to prevent an insane amount of
// database queries popping up
const LIMIT = 100;


module.exports = function (N) {

  N.wire.once('init:parser', function link_expand_plugin_init() {
    N.parse.addPlugin(
      'link_expand',
      function (parser) {
        parser.bus.on('render', function* expand_links(data) {
          let items = data.ast.find('msg-link[data-nd-auto]').slice(0, LIMIT);

          /* eslint-disable max-depth */
          for (let item of Array.from(items)) {
            let $tag  = $(item);
            let url   = $tag.attr('href');
            let types = data.params.options.link_to_title ? [ 'inline' ] : [];

            if (($tag.parent().prop('tagName') === 'P') && ($tag.parent().contents().length === 1)) {
              if (data.params.options.link_to_snippet) {
                types.unshift('block');
              }
            }

            let sub_data = {
              url,
              types,
              cacheOnly: !data.params.user_info
            };

            try {
              yield N.wire.emit('internal:common.embed', sub_data);
            } catch (__) {
              // If any errors happen, ignore them and leave the link as is
              continue;
            }

            // Switch url destination if it's been unshortened
            if (sub_data.canonical) {
              $tag.attr('href', sub_data.canonical);
            }

            // If no result is returned, leave the link as is
            if (!sub_data.html) continue;

            // Check if user has an access to this resource
            // (external links are not checked)
            if (sub_data.local) {
              let have_access = false;

              if (!data.params.user_info) {
                // Rebuild mode: get access from cache
                have_access = (data.params.imports || []).indexOf(url) !== -1;
              } else {
                // Normal mode: get access from `common.access` and cache it
                let access_env = { params: { url, user_info: data.params.user_info } };

                yield N.wire.emit('internal:common.access', access_env);

                if (data.result.imports.indexOf(url) === -1 && access_env.data.access_read) {
                  data.result.imports.push(url);
                }

                have_access = access_env.data.access_read;
              }

              // No access: leave link as is
              if (!have_access) continue;
            }


            let replacement = $(sub_data.html);

            replacement.attr('data-nd-orig', url);

            if (sub_data.type === 'block') {
              // if result is a block, replace parent `P` tag
              $tag.parent().replaceWith(replacement);
            } else {
              // otherwise replace `A` tag itself
              $tag.replaceWith(replacement);
            }

            replacement.find('._identicon').each(function () {
              let user_id = $(this).data('user-id');

              if (user_id && data.result.import_users.indexOf(user_id) === -1) {
                data.result.import_users.push(user_id);
              }
            });
          }
        });
      },
      true
    );
  });
};
