'use strict';

module.exports = function promise_from_event(emitter, event_name) {
  return new Promise(resolve => {
    emitter.on(event_name, () => resolve());
  });
};
