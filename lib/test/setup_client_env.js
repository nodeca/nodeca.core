// Client utils for test environment (PhantomJS)

'use strict';

/*global window, NodecaLoader, $*/
/*eslint no-console: 0*/


// Expose assert
window.assert = window.chai.assert;


var oldAssertionErrorToString = window.chai.AssertionError.prototype.toString;

window.chai.AssertionError.prototype.toString = function () {
  // Error handler in PhantomJS automatically call `toString`. To get whole error
  // data send serialized error through console handler.
  console.log('AssertionError:' + JSON.stringify(this.toJSON()));

  // Call default `toString` method
  return oldAssertionErrorToString.call(this);
};


// Do click by element and wait for finish
//
// - selector (String) - css selector of element
// - wireChannel (String) - optional, channel to listen for operation finish (from `data-on-click` by default)
// - event (String) - optional, HTML event name (click by default)
// - callback - function to execute on complete
//
//
//   .evaluateAsync(function (done) {
//     trigger('[data-on-click="users.albums_root.create_album"]', function () {
//       $('input[name="album_name"]').val('new test album!');
//
//       trigger('.modal-dialog button[type="submit"]', 'io.complete:users.albums_root.list', function () {
//         assert.equal($('.user-albumlist li:last .thumb-caption__line:first').text(), 'new test album!');
//         done();
//       });
//     });
//   })
//
window.trigger = function (selector, wireChannel, event, callback) {

  // Normalize arguments
  if (arguments.length === 2) {
    callback = wireChannel;
    wireChannel = undefined;
  } else if (arguments.length === 3) {
    callback = event;
    event = undefined;
  }

  var $element = $(selector);
  var channel = wireChannel ? wireChannel : $element.data('onClick');

  NodecaLoader.N.wire.once(channel, { priority: 999 }, callback);

  $element.trigger(event ? event : 'click');
};
