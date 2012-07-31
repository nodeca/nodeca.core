'use strict';


/**
 *  client
 **/

/**
 *  client.common
 **/


/*global $, _, nodeca, window, document*/


/**
 *  client.common.init()
 *
 *  Assigns all necessary event listeners and handlers.
 *
 *
 *  ##### Example
 *
 *      nodeca.client.common.init();
 **/
module.exports = function () {
  nodeca.io.init();


  $(function () {
    // Bootstrap.Collapse calls e.preventDefault() only when there's no
    // data-target attribute. We don't want URL to be changed, so we are
    // forcing prevention of default behavior.
    $('body').on('click.collapse.data-api', '[data-toggle=collapse]', function (e) {
      e.preventDefault();
    });

    //
    // Observe quicksearch focus to tweak icon style
    //

    $('.navbar-search .search-query')
      .focus(function (){ $(this).next('div').addClass('focused'); })
      .blur(function (){ $(this).next('div').removeClass('focused'); });
  });


  // assign action links handlers
  nodeca.client.common.init.action_links();


  // history intercepts clicks on all `a` elements,
  // so we initialize it as later as possible to have
  // "lowest" priority of handlers
  nodeca.client.common.init.history();
};
