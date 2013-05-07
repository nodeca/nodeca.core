// Knockout extension for observables with modifications tracking.
//
// Modified from original code by Ryan Niemeyer.
// http://www.knockmeout.net/2011/05/creating-smart-dirty-flag-in-knockoutjs.html
//


'use strict';


var ko = require('knockout');


ko.extenders.dirty = function (target, isInitiallyDirty) {
  var _initialState     = ko.observable(JSON.stringify(target()))
    , _isInitiallyDirty = ko.observable(isInitiallyDirty);

  target.isDirty = ko.computed(function() {
    return _isInitiallyDirty() || _initialState() !== JSON.stringify(target());
  });

  target.markClean = function() {
    _initialState(JSON.stringify(target()));
    _isInitiallyDirty(false);
  };

  return target;
};
