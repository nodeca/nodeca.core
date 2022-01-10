// Replace block links with previews of the objects they link to,
// and inline links with the titles of those objects.
//

'use strict';

const _       = require('lodash');
const $       = require('nodeca.core/lib/parser/cheequery');

// limit the amount of the embedded links to prevent an insane amount of
// database queries popping up
const LINK_EXPAND_LIMIT = 200;


module.exports = function (N) {

  // Sanitize and expand links
  //
  //  - is_preview - true if we're expanding to create preview (no embedded video there)
  //
  async function expand_links(data, is_preview) {
    let items = data.ast.find('msg-link').slice(0, LINK_EXPAND_LIMIT);

    let urls = _.uniq(Array.from(items).map(item => $(item).attr('href')));

    // insert all used urls into the database
    if (urls.length) {
      let bulk = N.models.core.UrlTracker.collection.initializeUnorderedBulkOp();

      urls.forEach(url => {
        bulk.find({ url }).upsert().update({
          $setOnInsert: {
            url,
            status: N.models.core.UrlTracker.statuses.PENDING,
            retries: 0,
            uses_unshort: false,
            uses_embedza: false
          }
        });
      });

      await bulk.execute();
    }

    /* eslint-disable max-depth */
    for (let item of Array.from(items)) {
      let $tag    = $(item);
      let url     = $tag.attr('href');
      let is_auto = $tag.data('nd-auto');

      // Do not render links for previews: we don't have parser options available for them
      let types   = (!is_preview && data.params.options.link_to_title) ? [ 'inline' ] : [];

      // Replace each autolink with a snippet if it's the only tag in its paragraph
      if (is_auto && ($tag.parent().prop('tagName') === 'P') && ($tag.parent().contents().length === 1)) {
        // Check that block snippets are enabled and allowed,
        // do not render snippets inside preview
        if (!is_preview && data.params.options.link_to_snippet) {
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

      let sub_data = {
        url,
        types,
        cacheOnly: !data.params.user_info
      };

      try {
        await N.wire.emit('internal:common.embed', sub_data);
      } catch (__) {
        // If any errors happen, ignore them and leave the link as is
        continue;
      }

      // Switch url destination if it's been unshortened or sanitized
      if (sub_data.canonical) {
        $tag.attr('href', sub_data.canonical);
      }

      // Only replace autolinks
      if (!is_auto) continue;

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

      replacement.attr('data-nd-link-orig', url);
      replacement.attr('data-nd-link-type', $tag.data('nd-link-type'));

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
  }

  N.wire.once('init:parser', function link_expand_plugin_init() {
    N.parser.addPlugin(
      'link_expand',
      function (parser) {
        parser.bus.on('ast2html', function expand_links_html(data) {
          return expand_links(data, false);
        });

        parser.bus.on('ast2preview', function expand_links_preview(data) {
          return expand_links(data, true);
        });
      },
      true
    );
  });
};
