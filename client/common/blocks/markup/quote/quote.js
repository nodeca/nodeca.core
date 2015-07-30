// Expand/collapse a quote
//

'use strict';


N.wire.once('navigate.done', function () {

  $(document).on('click', '.quote__expand', function () {
    var quote       = $(this).closest('.quote');
    var old_content = quote.children('.quote__content').html();

    if (quote.data('alternate-content')) {
      // we previously expanded this post, so get it from cache
      quote.addClass('quote__m-expanded');
      quote.children('.quote__content').html(quote.data('alternate-content'));
      quote.data('alternate-content', old_content);
      return;
    }

    N.io.rpc('common.content.get', { url: quote.attr('cite') })
        .done(function (res) {

      var $result = $(res.html);

      N.wire.emit('navigate.update', { $: $result, locals: res }, function () {
        quote.addClass('quote__m-expanded');
        quote.data('alternate-content', old_content);
        quote.children('.quote__content').html($result);
      });
    });
  });

  $(document).on('click', '.quote__collapse', function () {
    var quote       = $(this).closest('.quote');
    var old_content = quote.children('.quote__content').html();

    quote.removeClass('quote__m-expanded');
    quote.children('.quote__content').html(quote.data('alternate-content'));
    quote.data('alternate-content', old_content);
  });
});
