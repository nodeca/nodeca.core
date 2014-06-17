/**
 *  Assigns handlers/listeners for `[data-action]` links.
 *
 *  Actions associated with a link will be invoked via Wire with the jQuery
 *  event object as an argument.
 **/


'use strict';


// Emits specified event
//
// data - event payload
//
function handleAction(apiPath, data) {
  N.loader.loadAssets(apiPath.split('.')[0], function () {
    if (N.wire.has(apiPath)) {
      N.wire.emit(apiPath, data);
    } else {
      N.logger.error('Unknown client Wire channel: %s', apiPath);
    }
  });
}


N.wire.once('navigate.done', function () {

  // add the dataTransfer property for use with the native `drop` event
  // to capture information about files dropped into the browser window
  // http://api.jquery.com/category/events/event-object/
  jQuery.event.props.push('dataTransfer');

  $(document)
    .on(
    'dragenter.nodeca.data-api dragleave.nodeca.data-api dragover.nodeca.data-api drop.nodeca.data-api',
    '[data-on-dragdrop]',
    function (event) {
      var apiPath = $(this).data('onDragdrop');
      handleAction(apiPath, event);
      event.preventDefault();
    });

  $(document).on('click.nodeca.data-api', '[data-on-click]', function (event) {
    var apiPath = $(this).data('onClick');
    handleAction(apiPath, event);
    event.preventDefault();
  });

  $(document).on('submit.nodeca.data-api', '[data-on-submit]', function (event) {
    var apiPath = $(this).data('onSubmit');
    var $form = $(event.currentTarget);

    var data = {
      'fields': {},
      'data': $form.data() // all data attributes
    };

    // Fill fields
    $.each($form.serializeArray(), function () {
      data.fields[this.name] = this.value;
    });

    handleAction(apiPath, data);
    event.preventDefault();
  });

  $(document).on('input.nodeca.data-api', '[data-on-input]', function (event) {
    var apiPath = $(this).data('onInput');
    handleAction(apiPath, event);
    event.preventDefault();
  });

  $(document).on('change.nodeca.data-api', '[data-on-change]', function (event) {
    var apiPath = $(this).data('onChange');
    handleAction(apiPath, event);
    event.preventDefault();
  });
});
