// Update meta tags when user moves to a new page
//

'use strict';


N.wire.on('navigate.done', function update_meta(data) {
  if (!data.locals) return;

  // Remove meta tags from previous page, i.e. loop through all link
  // and meta tags and remove known ones
  //
  $('head meta, head link').filter(function (n, el) {
    var $el = $(el);

    if ($el.prop('tagName') === 'LINK') {
      return ($el.attr('rel') || '').match(/^(canonical|prev|next)$/i);
    }

    return ($el.attr('name') || '').match(/^(title|description|keywords|robots)$/i) ||
           ($el.attr('property') || '').match(/^og:/i) ||
           ($el.attr('name') || '').match(/^twitter:/i);
  }).remove();

  // Add meta tags for this page
  //
  $('head').append($(N.runtime.render(module.apiPath, data.locals)));
});
