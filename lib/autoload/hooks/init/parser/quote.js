'use strict';

const $     = require('nodeca.core/lib/parser/cheequery');

// limit the amount of the embedded links to prevent an insane amount of
// database queries popping up
const LINK_EXPAND_LIMIT = 200;


module.exports = function (N) {

  N.wire.once('init:parser', function quote_plugin_init() {
    N.parser.addPlugin(
      'quote',
      require('nodeca.core/lib/parser/plugins/quote')(N)
    );

    N.parser.addPlugin(
      'quote:fetch_quote_info',
      function quote_plugin_init(parser) {
        parser.bus.on('ast2html', async function render_quote(data) {
          let items = data.ast.find('msg-quote').slice(0, LINK_EXPAND_LIMIT);

          /* eslint-disable max-depth */
          for (let item of Array.from(items)) {
            let $tag = $(item);
            let url  = String($tag.data('nd-title'));

            if (!N.router.match(url)) continue;

            let sub_data = { url };

            try {
              await N.wire.emit('internal:common.content.quote_wrap', sub_data);
            } catch (__) {
              // If any errors happen, ignore them (quote will be replaced by a default formatting later)
              continue;
            }

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

                await N.wire.emit('internal:common.access', access_env);

                if (data.result.imports.indexOf(url) === -1 && access_env.data.access_read) {
                  data.result.imports.push(url);
                }

                have_access = access_env.data.access_read;
              }

              // No access: leave link as is
              if (!have_access) continue;
            }


            let replacement = $(sub_data.html);

            replacement.children('.quote__content').append($tag.contents());
            $tag.replaceWith(replacement);

            replacement.find('._identicon').each(function () {
              let user_id = $(this).data('user-id');

              if (user_id && data.result.import_users.indexOf(user_id) === -1) {
                data.result.import_users.push(user_id);
              }
            });
          }
        });
      }
    );
  });
};
