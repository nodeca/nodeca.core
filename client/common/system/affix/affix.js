/**
 *  Assigns affix tracker on every page load.
 *  Required for dynamically updated content.
 *
 *  Tracked elements should have `_affix` class
 *
 *  Options:
 *  - data-affix - json:
 *    - top: top offset in pixels, default 0
 *    - bottom: bottom offset in pixels
 *    - wire: name of 'wire' channel to send event
 *    - throttle: throttle ms., default 50
 *    - class: DOM element class name, default is 'affix'
 *
 **/


'use strict';

var trackers = [];


// Initialize trackers for elements with class '_affix'
//
N.wire.on('navigate.done', function affix_init() {
  $('._affix').each(function (idx, el) {
    var $el = $(el);

    var params = $el.data('affix') || {};

    var position = (params.bottom !== undefined) ? 'bottom' : 'top';
    var offset = (position === 'top') ? params.top || 0 : params.bottom || 0;
    var wireChannel = params.wire;
    var throttle = params.throttle || 50;
    var className = params.class || 'affix';

    var steadyMin = new window.Steady({
      throttle: throttle,
      handler: function (values, done) {
        $el.addClass(className);

        if (wireChannel && position === 'top') {
          N.wire.emit(wireChannel, {}, function () {
            done();
          });
          return;
        }

        done();
      }
    });

    trackers.push(steadyMin);

    var steadyMax = new window.Steady({
      throttle: throttle,
      handler: function (values, done) {
        $el.removeClass(className);

        if (wireChannel && position === 'bottom') {
          N.wire.emit(wireChannel, {}, function () {
            done();
          });
          return;
        }

        done();
      }
    });

    trackers.push(steadyMax);

    var setConditions = function () {
      var elementPosition;

      if (position === 'top') {
        elementPosition = $el.offset().top + offset;
      } else {
        elementPosition = $(document).height() - $el.height() - $el.offset().top + offset;
      }

      steadyMin.addCondition('min-' + position, elementPosition);
      steadyMax.addCondition('max-' + position, elementPosition);

      steadyMin._onScrollHandler();
      steadyMax._onScrollHandler();
    };

    setConditions();

    // Update conditions when window resized
    $(window).on('resize.nd.affix', setConditions);
  });
});


// Remove all event listeners
//
N.wire.on('navigate.exit', function affix_free() {
  $(window).off('resize.nd.affix');

  trackers.forEach(function (steady) {
    steady.stop();
  });

  trackers = [];
});
