/**
 *  Assigns affix tracker on every page load.
 *  Required for dynamically updated content.
 *
 *  Tracked elements should have `_affix` class
 *
 *  Options:
 *  - data-affix-top - json,
 *  - data-affix-bottom - json:
 *    - offset:      offset in pixels, default 0
 *    - wire_above:  name of 'wire' channel to send event to when user scrolls above offset
 *    - wire_below:  name of 'wire' channel to send event to when user scrolls below offset
 *    - throttle:    throttle ms., default 50
 *    - class_above: DOM element class name if viewport is above offset
 *    - class_below: DOM element class name if viewport is below offset
 *
 **/


'use strict';


const Steady = require('steady');


let trackers = [];


function add_tracker($element, position, params) {
  let offset   = params.offset || 0;
  let throttle = params.throttle || 50;

  let steadyMin = new Steady({
    throttle,
    handler(values, done) {
      // Steady has an inverted axis for bottom, where 0 means user sees
      // bottom boundary and positive value means further up.
      //
      // So we check direction each time, add bottom class when we would remove
      // top and vice versa.
      //
      if (params.class_above) {
        if (position === 'top') {
          $element.removeClass(params.class_above);
        } else {
          $element.addClass(params.class_above);
        }
      }

      if (params.class_below) {
        if (position === 'bottom') {
          $element.removeClass(params.class_below);
        } else {
          $element.addClass(params.class_below);
        }
      }

      if (position === 'bottom' && params.wire_above) {
        N.wire.emit(params.wire_above, () => done());
        return;
      }

      if (position === 'top' && params.wire_below) {
        N.wire.emit(params.wire_below, () => done());
        return;
      }

      done();
    }
  });

  trackers.push(steadyMin);

  var steadyMax = new Steady({
    throttle,
    handler(values, done) {
      // Steady has an inverted axis for bottom, where 0 means user sees
      // bottom boundary and positive value means further up.
      //
      // So we check direction each time, add bottom class when we would remove
      // top and vice versa.
      //
      if (params.class_above) {
        if (position === 'top') {
          $element.addClass(params.class_above);
        } else {
          $element.removeClass(params.class_above);
        }
      }

      if (params.class_below) {
        if (position === 'bottom') {
          $element.addClass(params.class_below);
        } else {
          $element.removeClass(params.class_below);
        }
      }

      if (position === 'top' && params.wire_above) {
        N.wire.emit(params.wire_above, () => done());
        return;
      }

      if (position === 'bottom' && params.wire_below) {
        N.wire.emit(params.wire_below, () => done());
        return;
      }

      done();
    }
  });

  trackers.push(steadyMax);

  function setConditions() {
    var elementPosition;

    if (position === 'top') {
      elementPosition = $element.offset().top + offset;
    } else {
      elementPosition = $(document).height() - $element.height() - $element.offset().top + offset;
    }

    steadyMin.addCondition('min-' + position, elementPosition);
    steadyMax.addCondition('max-' + position, elementPosition);

    steadyMin._onScrollHandler();
    steadyMax._onScrollHandler();
  }

  setConditions();

  // Update conditions when window resized
  $(window).on('resize.nd.affix', setConditions);
}


// Initialize trackers for elements with class '_affix'
//
N.wire.after('navigate.done:*', function affix_init() {
  $('._affix').each(function (idx, el) {
    let $el = $(el);

    if ($el.data('affix-top'))    add_tracker($el, 'top',    $el.data('affix-top'));
    if ($el.data('affix-bottom')) add_tracker($el, 'bottom', $el.data('affix-bottom'));
  });
});


// Remove all event listeners
//
N.wire.on('navigate.exit', function affix_free() {
  $(window).off('resize.nd.affix');

  trackers.forEach(steady => steady.stop());
  trackers = [];
});
