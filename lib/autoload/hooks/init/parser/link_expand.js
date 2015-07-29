// Replace block links with previews of the objects they link to,
// and inline links with the titles of those objects.
//

'use strict';


var async     = require('async');
var createEnv = require('nodeca.core/lib/system/env');
var $         = require('nodeca.core/lib/parser/cheequery');

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

    if (!parser_data.params.env) {
      callback(null, (parser_data.params.imports || []).indexOf(url) !== -1);
      return;
    }

    var env = parser_data.params.env ? parser_data.params.env.clone() : createEnv(N, {});
    env.params.url = url;

    N.wire.emit('internal:common.access', env, function (err) {
      if (err) {
        callback(err);
        return;
      }

      if (parser_data.result.imports.indexOf(url) === -1 && env.data.access_read) {
        parser_data.result.imports.push(url);
      }

      callback(null, env.data.access_read);
    });
  }


  N.wire.once('init:parser', function medialink_plugin_init() {
    N.parse.addPlugin(
      'medialink',
      function (parser) {
        /*eslint-disable max-nested-callbacks*/
        parser.bus.on('render', function render_medialinks(data, callback) {
          if (!data.params.options.link_to_title && !data.params.options.link_to_snippet) {
            callback();
            return;
          }

          async.eachSeries(data.ast.find('msg-link[data-nd-auto]').slice(0, LIMIT), function (item, next) {
            var $tag  = $(item);
            var url   = $tag.attr('href');
            var types = data.params.options.link_to_title ? [ 'inline' ] : [];

            if (($tag.parent().prop('tagName') === 'P') && ($tag.parent().contents().length === 1)) {
              if (data.params.options.link_to_snippet) {
                types.unshift('block');
              }
            }

            if (!types.length) {
              next();
              return;
            }

            var sub_data = { url: url, types: types };

            N.wire.emit('internal:common.embed', sub_data, function (err) {
              // If any errors happen, ignore them and leave the link as is
              if (err) {
                next();
                return;
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
