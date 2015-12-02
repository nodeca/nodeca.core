// Replace block links with previews of the objects they link to,
// and inline links with the titles of those objects.
//

'use strict';


var async = require('async');
var $     = require('nodeca.core/lib/parser/cheequery');

// limit the amount of the embedded links to prevent an insane amount of
// database queries popping up
var LIMIT = 100;


module.exports = function (N) {

  // Check if user has an access to this resource
  //
  function check_access(parser_data, url, is_local, callback) {
    if (!is_local) {
      // don't check permissions for external links,
      // and don't store them to "imports" array
      callback(null, true);
      return;
    }

    if (!parser_data.params.user_info) {
      callback(null, (parser_data.params.imports || []).indexOf(url) !== -1);
      return;
    }

    var access_env = { params: { url: url, user_info: parser_data.params.user_info } };

    N.wire.emit('internal:common.access', access_env, function (err) {
      if (err) {
        callback(err);
        return;
      }

      if (parser_data.result.imports.indexOf(url) === -1 && access_env.data.access_read) {
        parser_data.result.imports.push(url);
      }

      callback(null, access_env.data.access_read);
    });
  }


  N.wire.once('init:parser', function link_expand_plugin_init() {
    N.parse.addPlugin(
      'link_expand',
      function (parser) {
        /*eslint-disable max-nested-callbacks*/
        parser.bus.on('render', function expand_links(data, callback) {
          async.eachSeries(data.ast.find('msg-link[data-nd-auto]').slice(0, LIMIT), function (item, next) {
            var $tag  = $(item);
            var url   = $tag.attr('href');
            var types = data.params.options.link_to_title !== false ? [ 'inline' ] : [];

            if (($tag.parent().prop('tagName') === 'P') && ($tag.parent().contents().length === 1)) {
              if (data.params.options.link_to_snippet !== false) {
                types.unshift('block');
              }
            }

            var sub_data = {
              url: url,
              types: types,
              cacheOnly: !data.params.user_info
            };

            N.wire.emit('internal:common.embed', sub_data, function (err) {
              // If any errors happen, ignore them and leave the link as is
              if (err) {
                next();
                return;
              }

              // Switch url destination if it's been unshortened
              if (sub_data.canonical) {
                $tag.attr('href', sub_data.canonical);
              }

              // If no result is returned, leave the link as is
              if (!sub_data.html) {
                next();
                return;
              }

              check_access(data, url, sub_data.local, function (err, allowed) {
                if (err) {
                  next(err);
                  return;
                }

                if (!allowed) {
                  next();
                  return;
                }

                var replacement = $(sub_data.html);

                replacement.attr('data-nd-orig', url);

                if (sub_data.type === 'block') {
                  // if result is a block, replace parent `P` tag
                  $tag.parent().replaceWith(replacement);
                } else {
                  // otherwise replace `A` tag itself
                  $tag.replaceWith(replacement);
                }

                replacement.find('._identicon').each(function () {
                  var user_id = $(this).data('user-id');

                  if (user_id && data.result.import_users.indexOf(user_id) === -1) {
                    data.result.import_users.push(user_id);
                  }
                });

                next();
              });
            });
          }, callback);
        });
      }
    );
  });
};
