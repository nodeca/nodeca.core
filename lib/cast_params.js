// Takes a string and tries to parse it as number, null or boolean.
// If it cannot be parsed - returns the original string.
//


'use strict';


var _ = require('lodash');


module.exports = function castParams(inputValue) {
  var parsedValue;

  if (_.isArray(inputValue)) {
    return _.map(inputValue, castParams);

  } else if (_.isObject(inputValue)) {
    parsedValue = {};

    _.forEach(inputValue, function (value, key) {
      parsedValue[key] = castParams(value);
    });

    return parsedValue;

  } else if ('null' === inputValue) {
    return null;

  } else if ('true' === inputValue) {
    return true;

  } else if ('false' === inputValue) {
    return false;

  } else if (/^[0-9\.\-]+$/.test(inputValue)) {
    parsedValue = Number(inputValue);
    return String(parsedValue) === inputValue ? parsedValue : inputValue;

  } else {
    return inputValue;
  }
};
