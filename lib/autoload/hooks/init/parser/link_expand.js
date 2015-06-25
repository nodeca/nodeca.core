// Replace internal block links with previews of the objects they link to,
// and add titles to internal links.
//

'use strict';

var async     = require('async');
var createEnv = require('nodeca.core/lib/system/env');
var $         = require('nodeca.core/lib/parser/cheequery');

// limit the amount of the internal links to prevent an insane amount of
// database queries popping up
var LIMIT = 100;


module.exports = function (N) {

  function plugin(parser) {
    parser.bus.on('render', function expand_links(data, callback) {
      var links = [];

      data.ast.find('.link[data-nd-auto]').each(function () {
        if (links.length > LIMIT) { return; }

        var tag = $(this);
        var url = tag.attr('href');

        // make sure it is an internal link (doesn't make sense to call
        // for an embed object if we know we won't get any)
        if (!N.router.match(url)) { return; }

        links.push(tag);
      });

      async.eachSeries(links, function (tag, next) {
        var url      = tag.attr('href');
        var is_block = (tag.parent().prop('tagName') === 'P') && (tag.parent().contents().length === 1);
        var type     = (is_block ? 'block' : 'inline');

        // check if this expand type is allowed in settings
        if ((is_block && !data.params.options.link_to_snippet) || (!is_block && !data.params.options.link_to_title)) {
          process.nextTick(next);
          return;
        }

        var sub_env  = data.params.env ? data.params.env.clone() : createEnv(N, {});

        sub_env.method = 'internal:common.embed.' + type;
        sub_env.params = { url: url };

        N.wire.emit('internal:common.embed.' + type, sub_env, function (err) {
          if (err) {
            next(err);
            return;
          }

          if (sub_env.res.embed) {
            var replacement = $(sub_env.res.embed);

            // if it's the same tag as we just removed, copy over all attributes
            // (such as line mapping)
            if (replacement.prop('tagName') === 'P') {
              var parent = tag.parent();

              parent.attr(parent.attrs());
            }

            tag.replaceWith(sub_env.res.embed);
          }

          // delay invocation until next tick to prevent stack overflow
          // in case there are no async listeners on the wire
          process.nextTick(next);
        });
      }, callback);
    });
  }

  N.wire.once('init:parser', function link_expand_plugin_init() {
    N.parse.addPlugin('link_expand', plugin);
  });
};
