/*global nodeca, $, History, window*/


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
        match = href && nodeca.runtime.router.match(href.split('#')[0]);

    if (match) {
      nodeca.io.apiTree(match.meta, match.params, function (err, msg) {
        // TODO: Properly handle `err` and (?) `msg.error`
        if (err) {
          nodeca.logger.error('Failed apiTree call', err);
          return;
        }

        try {
          nodeca.render(msg.view || match.meta, msg.layout, msg.data);
        } catch (err) {
          if ('NODECA_PLACEHOLDER_NOT_FOUND' === err) {
            window.location = href;
            return;
          }

          // FIXME: redirect on error? or at least propose user to click
          //        a link to reload to the requested page
          nodeca.logger.error('Failed render view <' + (msg.view || match.meta) +
                              '> with layout <' + msg.layout + '>', err);
          return;
        }

        History.pushState(null, msg.data.head.title, href);

        // unset active menu
        $('[data-api3-route], [data-api3-namespace]').removeClass('active');

        var route = msg.data.head.route || match.meta;
        var ns    = msg.data.head.namespace || route.split('.').shift();

        // set new active menu
        $('[data-api3-route="' + route + '"], [data-api3-namespace="' + ns + '"]').addClass('active');
      });

      event.preventDefault();
      return false;
    }
  });
});
