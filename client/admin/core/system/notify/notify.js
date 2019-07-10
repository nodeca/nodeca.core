/*
 * Show bulb notification on wire 'notify' events
 *
 * Parameters:
 *
 *   options (String) - show text in default (`error`) style
 *
 *   options (Object)
 *
 *   - message         - text to display (can be html)
 *   - autohide        - timeout (ms), 0 for infinite
 *   - closeable       - show close element, if set
 *   - deduplicate     - skip the same messages, if set
 *   - type            - message style 'error' (default), 'info'
 *
 * Sugar methods:
 *
 * 'notify.info' -> ('notify', { type: info })
 *
 */

'use strict';


const DEFAULT_TYPE = 'error';


var DEFAULT_OPTIONS = {
  info: {
    closable: false,
    autohide: 5000,
    style:    'info'
  },
  error: {
    closable: false,
    autohide: 10000,
    style:    'danger'
  }
};

// track notices for deduplication
// key - message text
let tracker = {};


function wrapOptions(options) {
  if (!options) return {};
  if (typeof options === 'string') return { message: options };
  return $.extend({}, options);
}


/* eslint-disable no-redeclare */
function Notification(options) {
  let type = options.type || DEFAULT_TYPE;

  options = $.extend({}, DEFAULT_OPTIONS[type], options);

  if (options.deduplicate) {
    this.track_id = JSON.stringify(options);

    let previous = tracker[this.track_id];

    if (previous) {
      // restart timeout
      clearTimeout(previous.timeout);

      previous.timeout = setTimeout(() => {
        previous.$element.alert('close');
      }, options.autohide);

      return;
    }
  }

  this.$element = $(N.runtime.render(module.apiPath, {
    message: options.message || '',
    style: (DEFAULT_OPTIONS[type] || {}).style
  }));

  // get container, where to insert notice
  if (options.container) {
    this.$container  = $(options.container);
  } else {
    // Lazily create default container if not exists
    this.$container = $('.notifications');
    if (this.$container.length === 0) {
      this.$container = $('<div class="notifications" />').appendTo('body');
    }
  }

  this.$element.on('closed.bs.alert', () => {
    if (this.timeout)  clearTimeout(this.timeout);
    if (this.track_id) delete tracker[this.track_id];
  });

  if (options.autohide) {
    this.timeout = setTimeout(() => {
      this.$element.alert('close');
    }, options.autohide);
  }

  // Show
  if (this.track_id) tracker[this.track_id] = this;

  this.$element
    .appendTo(this.$container)
    .addClass('show')
    // init closer
    .alert();
}


/*eslint-disable no-new*/

N.wire.on('notify', function notification(options) {
  new Notification(wrapOptions(options));
});


N.wire.on('notify.info', function notification(options) {
  N.wire.emit('notify', $.extend({ type: 'info' }, wrapOptions(options)));
});
