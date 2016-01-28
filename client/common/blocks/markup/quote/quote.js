// Expand/collapse a quote
//

'use strict';


N.wire.once('navigate.done', function () {

  $(document).on('click', '.quote__expand', function () {
    var quote         = $(this).closest('.quote');
    var quote_content = quote.children('.quote__content');
    var old_height    = quote_content.height();

    if (quote.attr('data-full-content')) {
      // we previously expanded this post, so get it from cache
      quote.addClass('quote__m-expanded');

      // Use `quote.attr('data-X')` instead of `quote.data('X')` to force
      // jQuery to write data to DOM. Otherwise nested quotes would fail
      // to expand/collapse sometimes.
      quote.attr('data-short-content', quote_content.html());
      quote_content.html(quote.attr('data-full-content'));

      var new_height = quote_content.height();

      quote_content
        .stop()
        .css({ height: old_height })
        .animate({ height: new_height }, 'fast', function () {
          quote_content.css({ height: '' });
        });

      return;
    }

    N.io.rpc('common.content.get', { url: quote.attr('cite') })
        .done(function (res) {

      var $result = $(res.html);

      N.wire.emit('navigate.update', { $: $result, locals: res }, function () {
        quote.addClass('quote__m-expanded');
        quote.attr('data-short-content', quote_content.html());
        quote_content.empty().append($result);

        var new_height = quote_content.height();

        quote_content
          .stop()
          .css({ height: old_height })
          .animate({ height: new_height }, 'fast', function () {
            quote_content.css({ height: '' });
          });
      });
    });
  });

  $(document).on('click', '.quote__collapse', function () {
    var quote         = $(this).closest('.quote');
    var quote_content = quote.children('.quote__content');
    var old_height    = quote_content.height();

    quote.removeClass('quote__m-expanded');
    quote.attr('data-full-content', quote_content.html());
    quote_content.html(quote.attr('data-short-content'));

    var new_height = quote_content.height();

    quote_content
      .stop()
      .css({ height: old_height })
      .animate({ height: new_height }, 'fast', function () {
        quote_content.css({ height: '' });
      });
  });
});


// Add localized titles to control buttons
//
N.wire.on([ 'navigate.done', 'navigate.update' ], function translate_titles(data) {
  (data.$ || $(document)).find('.quote__controls [data-i18n-title]').each(function () {
    var $tag = $(this);

    $tag.attr('title', N.runtime.t('common.blocks.markup.quote.' + $tag.attr('data-i18n-title')));
    $tag.removeAttr('data-i18n-title');
  });
});


// Replace user nick name (in case it's changed and we didn't rebuild posts yet)
//
N.wire.on([ 'navigate.done', 'navigate.update' ], function replace_nick(data) {
  var users;

  if (data.locals) {
    // page generated on client-side, so we have all the locals
    users = data.locals.users;
  } else {
    // page generated on server-side with users provided through page_data
    users = N.runtime.page_data.users;
  }

  if (!users) return;

  (data.$ || $(document)).find('.quote__author-name[data-user-id]').each(function () {
    var $tag = $(this);
    var user_id = $tag.attr('data-user-id');

    if (users[user_id]) {
      $tag.text(users[user_id].nick);
    }

    $tag.removeAttr('data-user-id');
  });
});
