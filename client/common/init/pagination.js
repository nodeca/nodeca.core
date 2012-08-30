'use strict';


/**
 *  client
 **/

/**
 *  client.common
 **/

/**
 *  client.common.init
 **/


/*global $, _, nodeca*/


/**
 *  client.common.init.pagination()
 **/
module.exports = function () {
  var $linkHelper = $('<a href="#">').hide().appendTo('body');

  $('body').on('focus.pagination', 'input.pagination-input', function (event) {
    var $this = $(this), data;

    if ($this.data('pagination-init')) {
      // already initialized
      return;
    }

    // mark as "initialized"
    $this.data('pagination-init', true);

    // try get pagination data
    data = $this.parents('ul.pagination:eq(0)').data('pagination');

    if (!data) {
      return;
    }

    $this.next('button').on('click.pagination', function (event) {
      var page = +$this.val();

      if (data.current === page) {
        return;
      }

      if (1 > page) {
        page = 1;
      }

      $.extend(data.params, {page: page});

      $linkHelper
        .attr('href', nodeca.runtime.router.linkTo(data.route, data.params))
        .click();
    });
  });
};
