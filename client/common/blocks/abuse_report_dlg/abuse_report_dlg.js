// Popup dialog to report moderator
//
// - placeholder - custom placeholder for textarea
// - messages - array of messages string (first line is title)
//
'use strict';


let $dialog;
let custom_controls;
let selected_control;
let params;
let result;


N.wire.once(module.apiPath, function init_handlers() {

  // Call submit if a custom control is selected
  //
  N.wire.before(module.apiPath + ':submit', function abuse_report_dlg_custom_submit() {
    if (!selected_control) return;
    return N.wire.emit(selected_control + ':submit', params);
  });


  // Submit button handler
  //
  N.wire.on(module.apiPath + ':submit', function submit_abuse_report_dlg(form) {
    form.$this.addClass('was-validated');

    // only validate textarea if custom element isn't selected
    $('.abuse-report-dlg__message').attr('required', !selected_control);

    if (form.$this[0].checkValidity() === false) return;

    if (!selected_control) params.message = form.fields.message;
    result = params;
    $dialog.modal('hide');
  });


  // Parse metadata for selected quick fill item
  //
  N.wire.before(module.apiPath + ':quick_fill', { priority: -20 }, function quick_fill_parse(data) {
    let value = data.$this.val();
    let title = null, text = null;

    selected_control = null;

    if (value) {
      // First line is a title, second line may be text or a custom apiPath
      let lines = value.split('\n');
      title = lines.shift();

      if ((lines[0] || '').trim().match(/^@[\w_.]+$/)) {
        selected_control = lines.shift().trim().slice(1);
      }

      text = lines.join('\n');
    }

    data.message = { title, text };

    // hide all controls
    for (let $control of Object.values(custom_controls)) $control.hide();
    $dialog.find('.abuse-report-dlg__default-control').hide();
  });


  // Render custom control if apiPath is defined
  //
  N.wire.before(module.apiPath + ':quick_fill', function quick_fill_render_control(data) {
    if (!selected_control) return;
    if (custom_controls[selected_control]) return;
    let context = { message: data.message, params };

    $dialog.find('.abuse-report-dlg__loading-placeholder').show();

    return N.wire.emit(selected_control + ':render', context).then(() => {
      let $control = $(context.html);

      custom_controls[selected_control] = $control;
      $dialog.find('.abuse-report-dlg__controls').append($control);
      $dialog.find('.abuse-report-dlg__loading-placeholder').hide();
    });
  });


  // Template select handler
  //
  N.wire.on(module.apiPath + ':quick_fill', function template_select_abuse_report_dlg(data) {
    if (!data.message.title) {
      // user selected first (empty) menu item
      $dialog.find('.abuse-report-dlg__default-control').show();

    } else if (selected_control) {
      // custom control
      let $control = custom_controls[selected_control];
      $control.show();

      // maybe call `${selected_control}:select` on wire to initialize custom control,
      // but it's not needed right now

    } else {
      // default control
      $dialog.find('.abuse-report-dlg__default-control').show();
      $dialog.find('.abuse-report-dlg__message').val(data.message.text);
    }
  });


  // Close dialog on sudden page exit (if user click back button in browser)
  //
  N.wire.on('navigate.exit', function teardown_page() {
    if ($dialog) {
      $dialog.modal('hide');
    }
  });
});


// Init dialog
//
N.wire.on(module.apiPath, function show_abuse_report_dlg(options) {
  params = options;
  $dialog = $(N.runtime.render(module.apiPath, params));
  custom_controls = {};
  selected_control = null;

  $('body').append($dialog);

  return new Promise((resolve, reject) => {
    $dialog
      .on('shown.bs.modal', () => {
        $dialog.find('.btn-secondary').focus();
      })
      .on('hidden.bs.modal', () => {
        // When dialog closes - remove it from body and free resources
        $dialog.remove();
        $dialog = null;
        params = null;
        custom_controls = null;

        if (result) resolve(result);
        else reject('CANCELED');

        result = null;
      })
      .modal('show');
  });
});
