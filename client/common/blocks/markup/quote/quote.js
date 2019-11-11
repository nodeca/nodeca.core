// Expand/collapse a quote
//

'use strict';


N.wire.once('navigate.done', function () {

  $(document).on('click', '.quote__expand', function () {
    let quote         = $(this).closest('.quote');
    let quote_content = quote.children('.quote__content');
    let old_height    = quote_content.height();

    if (quote.attr('data-full-content')) {
      // we previously expanded this post, so get it from cache
      quote.addClass('quote__m-expanded');

      // Use `quote.attr('data-X')` instead of `quote.data('X')` to force
      // jQuery to write data to DOM. Otherwise nested quotes would fail
      // to expand/collapse sometimes.
      quote.attr('data-short-content', quote_content.html());
      quote_content.html(quote.attr('data-full-content'));

      let new_height = quote_content.height();

      quote_content
        .stop()
        .css({ height: old_height })
        .animate({ height: new_height }, 'fast', function () {
          quote_content.css({ height: '' });
        });

      return;
    }

    N.io.rpc('common.content.get', { url: quote.attr('cite') }).then(res => {

      let $content = $('<div class="quote__content"></div>');

      $content.html(res.html);

      quote.addClass('quote__m-expanded');
      quote.attr('data-short-content', quote_content.html());

      return N.wire.emit('navigate.content_update', {
        $: $content,
        locals: res,
        $replace: quote_content
      }).then(() => {
        let new_height = $content.height();

        quote_content
          .stop()
          .css({ height: old_height })
          .animate({ height: new_height }, 'fast', function () {
            $content.css({ height: '' });
          });
      });
    });
  });

  $(document).on('click', '.quote__collapse', function () {
    let quote         = $(this).closest('.quote');
    let quote_content = quote.children('.quote__content');
    let old_height    = quote_content.height();

    quote.removeClass('quote__m-expanded');
    quote.attr('data-full-content', quote_content.html());
    quote_content.html(quote.attr('data-short-content'));

    let new_height = quote_content.height();

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
function translate_titles(selector) {
  selector.find('.quote__controls [data-i18n-title]').each(function () {
    let $tag = $(this);

    $tag.attr('title', N.runtime.t('common.blocks.markup.quote.' + $tag.attr('data-i18n-title')));
    $tag.removeAttr('data-i18n-title');
  });
}


// Replace user nick name (in case it's changed and we didn't rebuild posts yet)
//
function replace_nick(selector, users) {
  if (!users) return;

  selector.find('.quote__author-name[data-user-id]').each(function () {
    let $tag = $(this);
    let user_id = $tag.attr('data-user-id');

    if (users[user_id]) {
      $tag.text(users[user_id].nick);
    }

    $tag.removeAttr('data-user-id');
  });
}


N.wire.once('navigate.done', function fix_quotes(data) {
  if (!data.first_load) return; // already handled by content_update

  // page generated on server-side with users provided through page_data
  translate_titles($(document));
  replace_nick($(document), N.runtime.page_data.users);
});


N.wire.on('navigate.content_update', function fix_quotes(data) {
  translate_titles(data.$);
  replace_nick(data.$, data.locals.users);
});
