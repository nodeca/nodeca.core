// Implementation for `number_short` helper
//
'use strict';


// Converts a number to specified format
//
module.exports = function numeral_helper(number) {
  // 1234567890 -> 123m
  if (number > 10000000) {
    return (number / 1000000).toFixed(0) + 'm';
  }

  // 123456 -> 1.2m
  if (number > 1000000) {
    return (number / 1000000).toFixed(1) + 'm';
  }

  // 123456 -> 123k
  if (number > 10000) {
    return (number / 1000).toFixed(0) + 'k';
  }

  // 1234 -> 1.2k
  if (number > 1000) {
    return (number / 1000).toFixed(1) + 'k';
  }

  return number.toFixed(0);
};
