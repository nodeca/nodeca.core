'use strict';

module.exports = function (N) {

  N.wire.once('init:parser', function cut_plugin_init() {
    N.parser.addPlugin(
      'cut',
      require('nodeca.core/lib/parser/plugins/cut')(N)
    );

    N.parser.addPlugin(
      'cut:render',
      function cut_render_init(parser) {
        // default renderer
        parser.bus.after('ast2html', function render_cut(data) {
          data.ast.children('msg-cut').first().replaceWith('<!--cut-->');
          data.ast.find('msg-cut').remove();
        });

        // remove it in preview
        parser.bus.after('ast2preview', function remove_cut(data) {
          data.ast.find('msg-cut').remove();
        });

        // remove it when counting
        parser.bus.after('ast2length', function remove_cut(data) {
          data.ast.find('msg-cut').remove();
        });
      }
    );
  });
};
