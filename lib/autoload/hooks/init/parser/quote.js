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
  function check_access(parser_data, url, callback) {
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


  N.wire.once('init:parser', function quote_plugin_init() {
    N.parse.addPlugin(
      'quote',
      function quote_plugin_init(parser) {
        /*eslint-disable max-nested-callbacks*/
        require('nodeca.core/lib/parser/plugins/quote')(N)(parser);

        parser.bus.on('render', function render_quote(data, callback) {
          async.eachSeries(data.ast.find('msg-quote').slice(0, LIMIT), function (item, next) {
            var $tag = $(item);
            var url  = $tag.data('nd-title');

            if (!N.router.match(url)) {
              next();
              return;
            }

            var sub_data = { url: url };

            N.wire.emit('internal:common.content.quote_wrap', sub_data, function (err) {
              // If any errors happen, ignore them (quote will be replaced by a default formatting later)
              if (err) {
                next();
                return;
              }

              if (!sub_data.html) {
                next();
                return;
              }

              check_access(data, url, function (err, allowed) {
                if (err) {
                  next(err);
                  return;
                }

                if (!allowed) {
                  next();
                  return;
                }

                var replacement = $(sub_data.html);

                replacement.children('.quote__content').append($tag.contents());
                $tag.replaceWith(replacement);

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
