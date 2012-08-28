/**
 * PowerTip
 *
 * @fileoverview  jQuery plugin that creates hover tooltips.
 * @link          http://stevenbenner.github.com/jquery-powertip/
 * @author        Steven Benner (http://stevenbenner.com/)
 * @version       1.1.0
 * @requires      jQuery 1.7+
 *
 * @license jQuery PowerTip Plugin v1.1.0
 * http://stevenbenner.github.com/jquery-powertip/
 * Copyright 2012 Steven Benner (http://stevenbenner.com/)
 * Released under the MIT license.
 * <https://raw.github.com/stevenbenner/jquery-powertip/master/LICENSE.txt>
 */

(function($) {
  'use strict';

  // useful private variables
  var $document = $(document),
  $window = $(window),
  $body = $('body');

  /**
   * Session data
   * Private properties global to all powerTip instances
   * @type Object
   */
  var session = {
    isTipOpen: false,
    isFixedTipOpen: false,
    isClosing: false,
    tipOpenImminent: false,
    activeHover: null,
    currentX: 0,
    currentY: 0,
    previousX: 0,
    previousY: 0,
    desyncTimeout: null,
    mouseTrackingActive: false
  };

  /**
   * Display hover tooltips on the matched elements.
   * @param {Object} opts The options object to use for the plugin.
   * @return {Object} jQuery object for the matched selectors.
   */
  $.fn.powerTip = function(opts) {

    // don't do any work if there were no matched elements
    if (!this.length) {
      return this;
    }

    // extend options
    var options = $.extend({}, $.fn.powerTip.defaults, opts),
    tipController = new TooltipController(options);

    // hook mouse tracking
    initMouseTracking();

    // destroy associated powertips
    if ('destroy' === opts) {
      return this.off('.powertip').each(function destroy() {
        var $this = $(this);

        if (!$this.attr('title')) {
          $this.attr('title', $this.data('originalTitle'));
        }

        $this.removeData([
                         'powertip',
                         'powertipjq',
                         'powertiptarget',
                         'displayController'
        ]);
      });
    }

    // setup the elements
    this.each(function elementSetup() {
      var $this = $(this),
      dataPowertip = $this.data('powertip'),
      dataElem = $this.data('powertipjq'),
      dataTarget = $this.data('powertiptarget'),
      title = $this.attr('title');

      // attempt to use title attribute text if there is no data-powertip,
      // data-powertipjq or data-powertiptarget. If we do use the title
      // attribute, delete the attribute so the browser will not show it
      if (!dataPowertip && !dataTarget && !dataElem && title) {
        $this.data({powertip: title, originalTitle: title}).removeAttr('title');
      }

      // create hover controllers for each element
      $this.data(
        'displayController',
        new DisplayController($this, options, tipController)
      );
    });

    // attach hover events to all matched elements
    this.on({
      // mouse events
      'mouseenter.powertip': function elementMouseEnter(event) {
        trackMouse(event);
        session.previousX = event.pageX;
        session.previousY = event.pageY;
        $(this).data('displayController').show();
      },
      'mouseleave.powertip': function elementMouseLeave() {
        $(this).data('displayController').hide();
      },

      // keyboard events
      'focus.powertip': function elementFocus() {
        $(this).data('displayController').show(true);
      },
      'blur.powertip': function elementBlur() {
        $(this).data('displayController').hide(true);
      },
      'keydown.powertip': function elementKeyDown(event) {
        // close tooltip when the escape key is pressed
        if (event.keyCode === 27) {
          $(this).data('displayController').hide(true);
        }
      }
    });

    return this;

  };

  /**
   * Default options for the powerTip plugin.
   * @type Object
   */
  $.fn.powerTip.defaults = {
    fadeInTime: 200,
    fadeOutTime: 100,
    popupId: 'powerTip',
    intentSensitivity: 7,
    intentPollInterval: 100,
    closeDelay: 100,
    offset: 10,
    mouseOnToPopup: false
  };


  /**
   * Public API
   * @type Object
   */
  $.powerTip = {

    /**
     * Attempts to show the tooltip for the specified element.
     * @public
     * @param {Object} element The element that the tooltip should for.
     */
    showTip: function apiShowTip(element) {
      // grab only the first matched element and ask it to show its tip
      element = element.first();
      element.data('displayController').show(true, true);
    },

    /**
     * Attempts to close any open tooltips.
     * @public
     */
    closeTip: function apiCloseTip() {
      $document.triggerHandler('closePowerTip');
    }

  };

  /**
   * Creates a new tooltip display controller.
   * @private
   * @constructor
   * @param {Object} element The element that this controller will handle.
   * @param {Object} options Options object containing settings.
   * @param {TooltipController} tipController The TooltipController for this instance.
   */
  function DisplayController(element, options, tipController) {
    var hoverTimer = null;

    /**
     * Begins the process of showing a tooltip.
     * @private
     * @param {Boolean=} immediate Skip intent testing (optional).
     * @param {Boolean=} forceOpen Ignore cursor position and force tooltip to open (optional).
     */
    function openTooltip(immediate, forceOpen) {
      cancelTimer();
      if (!element.data('hasActiveHover')) {
        if (!immediate) {
          session.tipOpenImminent = true;
          hoverTimer = setTimeout(
            function intentDelay() {
            hoverTimer = null;
            checkForIntent(element);
          },
          options.intentPollInterval
          );
        } else {
          if (forceOpen) {
            element.data('forcedOpen', true);
          }
          tipController.showTip(element);
        }
      }
    }

    /**
     * Begins the process of closing a tooltip.
     * @private
     * @param {Boolean=} disableDelay Disable close delay (optional).
     */
    function closeTooltip(disableDelay) {
      cancelTimer();
      session.tipOpenImminent = false;
      if (element.data('hasActiveHover')) {
        element.data('forcedOpen', false);
        if (!disableDelay) {
          hoverTimer = setTimeout(
            function closeDelay() {
            hoverTimer = null;
            tipController.hideTip(element);
          },
          options.closeDelay
          );
        } else {
          tipController.hideTip(element);
        }
      }
    }

    /**
     * Checks mouse position to make sure that the user intended to hover
     * on the specified element before showing the tooltip.
     * @private
     */
    function checkForIntent() {
      // calculate mouse position difference
      var xDifference = Math.abs(session.previousX - session.currentX),
      yDifference = Math.abs(session.previousY - session.currentY),
      totalDifference = xDifference + yDifference;

      // check if difference has passed the sensitivity threshold
      if (totalDifference < options.intentSensitivity) {
        tipController.showTip(element);
      } else {
        // try again
        session.previousX = session.currentX;
        session.previousY = session.currentY;
        openTooltip();
      }
    }

    /**
     * Cancels active hover timer.
     * @private
     */
    function cancelTimer() {
      hoverTimer = clearTimeout(hoverTimer);
    }

    // expose the methods
    return {
      show: openTooltip,
      hide: closeTooltip,
      cancel: cancelTimer
    };
  }

  /**
   * Creates a new tooltip controller.
   * @private
   * @constructor
   * @param {Object} options Options object containing settings.
   */
  function TooltipController(options) {

    // build and append tooltip div if it does not already exist
    var tipElement = $('#' + options.popupId);
    if (tipElement.length === 0) {
      tipElement = $('<div/>', { id: options.popupId });
      // grab body element if it was not populated when the script loaded
      // this hack exists solely for jsfiddle support
      if ($body.length === 0) {
        $body = $('body');
      }
      $body.append(tipElement);
    }

    // if we want to be able to mouse onto the tooltip then we need to
    // attach hover events to the tooltip that will cancel a close request
    // on hover and start a new close request on mouseleave
    if (options.mouseOnToPopup) {
      tipElement.on({
        mouseenter: function tipMouseEnter() {
          // we only let the mouse stay on the tooltip if it is set
          // to let users interact with it
          if (tipElement.data('mouseOnToPopup')) {
            // check activeHover in case the mouse cursor entered
            // the tooltip during the fadeOut and close cycle
            if (session.activeHover) {
              session.activeHover.data('displayController').cancel();
            }
          }
        },
        mouseleave: function tipMouseLeave() {
          // check activeHover in case the mouse cursor entered
          // the tooltip during the fadeOut and close cycle
          if (session.activeHover) {
            session.activeHover.data('displayController').hide();
          }
        }
      });
    }

    /**
     * Gives the specified element the active-hover state and queues up
     * the showTip function.
     * @private
     * @param {Object} element The element that the tooltip should target.
     */
    function beginShowTip(element) {
      element.data('hasActiveHover', true);
      // show tooltip, asap
      tipElement.queue(function queueTipInit(next) {
        showTip(element);
        next();
      });
    }

    /**
     * Shows the tooltip, as soon as possible.
     * @private
     * @param {Object} element The element that the tooltip should target.
     */
    function showTip(element) {
      // it is possible, especially with keyboard navigation, to move on
      // to another element with a tooltip during the queue to get to
      // this point in the code. if that happens then we need to not
      // proceed or we may have the fadeout callback for the last tooltip
      // execute immediately after this code runs, causing bugs.
      if (!element.data('hasActiveHover')) {
        return;
      }

      // if the tooltip is open and we got asked to open another one then
      // the old one is still in its fadeOut cycle, so wait and try again
      if (session.isTipOpen) {
        if (!session.isClosing) {
          hideTip(session.activeHover);
        }
        tipElement.delay(100).queue(function queueTipAgain(next) {
          showTip(element);
          next();
        });
        return;
      }

      // trigger powerTipPreRender event
      element.trigger('powerTipPreRender');

      var tipText = element.data('powertip'),
      tipTarget = element.data('powertiptarget'),
      tipElem = element.data('powertipjq'),
      tipContent = tipTarget ? $('#' + tipTarget) : [];

      // set tooltip content
      if (tipText) {
        tipElement.html(tipText);
      } else if (tipElem && tipElem.length > 0) {
        tipElement.empty();
        tipElem.clone(true, true).appendTo(tipElement);
      } else if (tipContent && tipContent.length > 0) {
        tipElement.html($('#' + tipTarget).html());
      } else {
        // we have no content to display, give up
        return;
      }

      // trigger powerTipRender event
      element.trigger('powerTipRender');

      // hook close event for triggering from the api
      $document.on('closePowerTip', function closePowerTipEvent() {
        element.data('displayController').hide(true);
      });

      session.activeHover = element;
      session.isTipOpen = true;

      tipElement.data('mouseOnToPopup', options.mouseOnToPopup);

      positionTipOnElement(element);
      session.isFixedTipOpen = true;

      // fadein
      tipElement.fadeIn(options.fadeInTime, function fadeInCallback() {
        // start desync polling
        if (!session.desyncTimeout) {
          session.desyncTimeout = setInterval(closeDesyncedTip, 500);
        }

        // trigger powerTipOpen event
        element.trigger('powerTipOpen');
      });
    }

    /**
     * Hides the tooltip.
     * @private
     * @param {Object} element The element that the tooltip should target.
     */
    function hideTip(element) {
      session.isClosing = true;
      element.data('hasActiveHover', false);
      element.data('forcedOpen', false);
      // reset session
      session.activeHover = null;
      session.isTipOpen = false;
      // stop desync polling
      session.desyncTimeout = clearInterval(session.desyncTimeout);
      // unhook close event api listener
      $document.off('closePowerTip');
      // fade out
      tipElement.fadeOut(options.fadeOutTime, function fadeOutCallback() {
        session.isClosing = false;
        session.isFixedTipOpen = false;
        tipElement.removeClass();

        // trigger powerTipClose event
        element.trigger('powerTipClose');
      });
    }

    /**
     * Checks for a tooltip desync and closes the tooltip if one occurs.
     * @private
     */
    function closeDesyncedTip() {
      // It is possible for the mouse cursor to leave an element without
      // firing the mouseleave or blur event. This most commonly happens
      // when the element is disabled under mouse cursor. If this happens
      // it will result in a desynced tooltip because the tooltip was
      // never asked to close. So we should periodically check for a
      // desync situation and close the tip if such a situation arises.
      if (session.isTipOpen && !session.isClosing) {
        var isDesynced = false;
        // user moused onto another tip or active hover is disabled
        if (session.activeHover.data('hasActiveHover') === false || session.activeHover.is(':disabled')) {
          isDesynced = true;
        } else {
          // hanging tip - have to test if mouse position is not over
          // the active hover and not over a tooltip set to let the
          // user interact with it.
          // for keyboard navigation: this only counts if the element
          // does not have focus.
          // for tooltips opened via the api: we need to check if it
          // has the forcedOpen flag.
          if (!isMouseOver(session.activeHover) && !session.activeHover.is(":focus") && !session.activeHover.data('forcedOpen')) {
            if (tipElement.data('mouseOnToPopup')) {
              if (!isMouseOver(tipElement)) {
                isDesynced = true;
              }
            } else {
              isDesynced = true;
            }
          }
        }

        if (isDesynced) {
          // close the desynced tip
          hideTip(session.activeHover);
        }
      }
    }


    /**
     * Sets the tooltip to the correct position relative to the specified
     * target element. Based on options settings.
     * @private
     * @param {Object} element The element that the tooltip should target.
     */
    function positionTipOnElement(element) {
      var finalPlacement;


      // iterate over the priority list and use the first placement
      // option that does not collide with the view port. if they all
      // collide then the last placement in the list will be used.
      $.each(['nw', 'ne', 'sw', 'se'], function(idx, pos) {
        // place tooltip and find collisions
        var collisions = getViewportCollisions(
          placeTooltip(element, pos),
          tipElement.outerWidth(),
          tipElement.outerHeight()
        );

        // update the final placement variable
        finalPlacement = pos;

        // break if there were no collisions
        if (collisions.length === 0) {
          return false;
        }
      });

      // add placement as class for CSS arrows
      tipElement.addClass(finalPlacement);
    }

    /**
     * Sets the tooltip position to the appropriate values to show the tip
     * at the specified placement. This function will iterate and test the
     * tooltip to support elastic tooltips.
     * @private
     * @param {Object} element The element that the tooltip should target.
     * @param {String} placement The placement for the tooltip.
     * @retun {Object} An object with the top, left, and right position values.
     */
    function placeTooltip(element, placement) {
      var iterationCount = 0, tipWidth, tipHeight, coords;

      // for the first iteration: set the tip to 0,0 to get the full
      // expanded width and set the iterationCount to 0
      tipElement.css({ top: 0, left: 0, right: 'auto', bottom: 'auto' });

      // to support elastic tooltips we need to check for a change in
      // the rendered dimensions after the tooltip has been positioned
      do {
        // grab the current tip dimensions
        tipWidth  = tipElement.outerWidth();
        tipHeight = tipElement.outerHeight();

        // get placement coordinates
        coords = computePlacementCoords(element, placement, tipWidth, tipHeight);

        // place the tooltip
        tipElement.css(coords);
      } while (
        // sanity check: limit to 5 iterations, and...
        ++iterationCount <= 5 &&
          // try again if the dimensions changed after placement
          (tipWidth !== tipElement.outerWidth() || tipHeight !== tipElement.outerHeight())
      );

      return coords;
    }

    /**
     * Compute the top/left/right CSS position to display the tooltip at the
     * specified placement relative to the specified element.
     * @private
     * @param {Object} element The element that the tooltip should target.
     * @param {String} placement The placement for the tooltip.
     * @param {Number} tipWidth Width of the tooltip element in pixels.
     * @param {Number} tipHeight Height of the tooltip element in pixels.
     * @retun {Object} An object with the top, left, and right position values.
     */
    function computePlacementCoords(element, placement, tipWidth, tipHeight) {
      // grab measurements
      var objectOffset = element.offset(),
          objectWidth  = element.outerWidth(),
          objectHeight = element.outerHeight(),
          top, left, right, bottom;

      switch (placement) {
        case 'nw':
          left    = Math.round(objectOffset.left);
          top = Math.round(objectOffset.top - tipHeight - options.offset);
          break;
        case 'ne':
          top = Math.round(objectOffset.top - tipHeight - options.offset);
          left = Math.round(objectOffset.left - tipWidth + objectWidth);
          break;
        case 'sw':
          left = Math.round(objectOffset.left);
          top = Math.round(objectOffset.top + objectHeight + options.offset);
          break;
        case 'se':
          top = Math.round(objectOffset.top + objectHeight + options.offset);
          left = Math.round(objectOffset.left - tipWidth + objectWidth);
          break;
      }

      return {
        top:    top || 'auto',
        left:   left || 'auto',
        right:  'auto',
        bottom: 'auto'
      };
    }

    // expose methods
    return {
      showTip: beginShowTip,
      hideTip: hideTip
    };
  }

  /**
   * Hooks mouse position tracking to mousemove and scroll events.
   * Prevents attaching the events more than once.
   * @private
   */
  function initMouseTracking() {
    var lastScrollX = 0,
    lastScrollY = 0;

    if (!session.mouseTrackingActive) {
      session.mouseTrackingActive = true;

      // grab the current scroll position on load
      $(function getScrollPos() {
        lastScrollX = $document.scrollLeft();
        lastScrollY = $document.scrollTop();
      });

      // hook mouse position tracking
      $document.on({
        mousemove: trackMouse,
        scroll: function trackScroll() {
          var x = $document.scrollLeft(),
          y = $document.scrollTop();
          if (x !== lastScrollX) {
            session.currentX += x - lastScrollX;
            lastScrollX = x;
          }
          if (y !== lastScrollY) {
            session.currentY += y - lastScrollY;
            lastScrollY = y;
          }
        }
      });
    }
  }

  /**
   * Saves the current mouse coordinates to the session object.
   * @private
   * @param {Object} event The mousemove event for the document.
   */
  function trackMouse(event) {
    session.currentX = event.pageX;
    session.currentY = event.pageY;
  }

  /**
   * Tests if the mouse is currently over the specified element.
   * @private
   * @param {Object} element The element to check for hover.
   * @return {Boolean}
   */
  function isMouseOver(element) {
    var elementPosition = element.offset();
    return session.currentX >= elementPosition.left &&
      session.currentX <= elementPosition.left + element.outerWidth() &&
      session.currentY >= elementPosition.top &&
      session.currentY <= elementPosition.top + element.outerHeight();
  }

  /**
   * Finds any viewport collisions that an element (the tooltip) would have
   * if it were absolutely positioned at the specified coordinates.
   * @private
   * @param {Object} coords Coordinates for the element. (e.g. {top: 123, left: 123})
   * @param {Number} elementWidth Width of the element in pixels.
   * @param {Number} elementHeight Height of the element in pixels.
   * @return {Array} Array of words representing directional collisions.
   */
  function getViewportCollisions(coords, elementWidth, elementHeight) {
    var scrollLeft = $window.scrollLeft(),
    scrollTop = $window.scrollTop(),
    windowWidth = $window.width(),
    windowHeight = $window.height(),
    collisions = [];

    if (coords.top < scrollTop) {
      collisions.push('top');
    }
    if (coords.top + elementHeight > scrollTop + windowHeight) {
      collisions.push('bottom');
    }
    if (coords.left < scrollLeft || coords.right + elementWidth > scrollLeft + windowWidth) {
      collisions.push('left');
    }
    if (coords.left + elementWidth > scrollLeft + windowWidth || coords.right < scrollLeft) {
      collisions.push('right');
    }

    return collisions;
  }

}(jQuery));
