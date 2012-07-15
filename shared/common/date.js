'use strict';


/*global nodeca, _*/


////////////////////////////////////////////////////////////////////////////////


module.exports = function date(locale, value, format) {
  var d = new Date(Date.parse(value));
  return d.toLocaleString();
};
