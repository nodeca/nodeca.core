// Inline text editor
//
// example:
//   N.wire.emit('common.blocks.microedit', {
//     selector: '.forum-topic-title',
//     value: 'value to edit',
//     update: function (newValue, callback) {
//       N.io.rpc(..., callback);
//     }
//   }, function () {
//     // microedit finished
//   });
//
// options:
// - selector - CSS selector of replaced element
// - update(value, callback) - value update function
// - value - text value
//
'use strict';

var $form;
var $elem;
var doneCallback;
var params;


function destroy(callback) {
  if (!$form) return;

  $form.fadeOut('fast', function () {
    doneCallback = null;
    $form.remove();
    $form = null;
    params = null;

    if (typeof callback === 'function') {
      callback();
    }

    $elem.fadeIn('fast', function () {
      $elem = null;
    });
  });
}


N.wire.once('common.blocks.microedit', function microedit_once() {

  // Submit handler
  //
  N.wire.on('common.blocks.microedit:submit', function microedit_submit(data) {
    params.update(data.fields.value, function (err) {
      if (!err) {
        destroy(doneCallback);
        return;
      }

      $form
        .find('.microedit__input-container')
        .addClass('has-error')
        .find('.microedit__error')
        .text((typeof err === 'string') ? err : '');
    });
  });
});


N.wire.on('common.blocks.microedit', function microedit_init(data, callback) {
  params = data;
  doneCallback = callback;

  $form = $(N.runtime.render('common.blocks.microedit', params));
  $elem = $(data.selector);

  var $input = $form.find('.microedit__input');

  $input
    .blur(function (e) {
      if (e.relatedTarget === $form.find('.btn-primary').get(0)) {
        $input.focus();
        return;
      }

      destroy();
    })
    .keyup(function (e) {
      // Close form on `esc` key
      if (e.which === 27) {
        destroy();
      }
    });

  $elem.after($form);

  $form.fadeOut(0);
  $elem.fadeOut('fast', function () {
    $form.fadeIn('fast', function () {
      $input.focus();
    });
  });
});
