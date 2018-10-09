'use strict';


require('ekko-lightbox/dist/ekko-lightbox.js');


$(document).on('click', '[data-toggle="lightbox"]', function (event) {
  event.preventDefault();
  $(this).ekkoLightbox();
});
