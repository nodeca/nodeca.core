/*global nodeca, $, History*/


//= require nodeca


nodeca.io.init();


$(function () {
  'use strict';

  // Bootstrap.Collapse calls e.preventDefault() only when there's no
  // data-target attribute. We don't want URL to be changed, so we are
  // forcing prevention of default behavior.
  $('body').on('click.collapse.data-api', '[data-toggle=collapse]', function ( e ) {
    e.preventDefault();
  });

  //
  // Observe quicksearch focus to tweak icon style
  //
  $('.navbar-search .search-query')
    .focus(function (){ $(this).next('div').addClass('focused'); })
    .blur(function (){ $(this).next('div').removeClass('focused'); });


  $('body').on('click', 'a', function (event) {
    var href  = $(this).attr('href'),
        match = href && nodeca.runtime.router.match(href);

    if (match) {
      nodeca.io.apiTree(match.meta, match.params, function (err, msg) {
        // TODO: Properly handle `err` and (?) `msg.error`
        if (err) {
          nodeca.logger.error('Failed apiTree call', err);
          return;
        }

        History.pushState(null, msg.data.head.title, href);

        // FIXME: use view from msg
        nodeca.render(msg.view || match.meta, msg.data);
      });

      event.preventDefault();
      return false;
    }
  });
});
