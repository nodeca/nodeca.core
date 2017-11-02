// Inline text editor
//
// example:
//   N.wire.emit('common.blocks.microedit', {
//     selector: '.forum-topic-title',
//     value: 'value to edit',
//     update: newValue => N.io.rpc(/*params*/)
//   });
//
// options:
//
// - selector - CSS selector of replaced element
// - update(value, callback) - value update function
// - value - text value
//
'use strict';


let $form;
let $elem;
let params;
let resolve;
let reject;


function destroy(err) {
  $form.fadeOut('fast', () => {
    $form.remove();
    $form = null;
    params = null;

    $elem.fadeIn('fast', () => {
      $elem = null;
    });

    if (!err) resolve();
    else reject(err);

    resolve = null;
    reject = null;
  });
}


N.wire.once(module.apiPath, function microedit_once() {

  // Submit handler
  //
  N.wire.on(module.apiPath + ':submit', function microedit_submit(data) {
    return params.update(data.fields.value)
      .then(() => destroy())
      .catch(err => {
        if (typeof err === 'string') {
          $form
            .find('.microedit__input')
            .addClass('is-invalid');

          $form
            .find('.microedit__error')
            .text(err);

        } else {
          destroy(err);
        }
      });
  });
});


N.wire.on(module.apiPath, function microedit_init(data) {
  params = data;
  $elem = $(data.selector);
  $form = $(N.runtime.render(module.apiPath, params));

  let $input = $form.find('.microedit__input');

  // hack, move cursor to end of text
  $input.focus(function () {
    setTimeout(() => {
      this.selectionStart = this.selectionEnd = 10000;
    }, 0);
  });

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

  return new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
});
