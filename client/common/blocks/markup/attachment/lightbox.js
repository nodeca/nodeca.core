// Show lightbox gallery for all image attachments in a post
//

'use strict';


const glightbox = require('glightbox');


N.wire.once('navigate.done', function () {

  $(document).on('click', '.attach-img', function () {
    let $container = $(this).closest('.markup');
    let nodes;

    if ($container.length) {
      nodes = $container.find('.attach-img').toArray();
    } else {
      nodes = [ this ];
    }

    let elements = [];

    nodes.forEach(node => {
      elements.push({
        href: N.router.linkTo('core.gridfs', { bucket: $(node).data('nd-media-id') }),
        type: 'image'
      });
    });

    let index = nodes.indexOf(this);

    glightbox({ elements }).openAt(index);

    return false;
  });
});
